import os
import base64
import datetime
import google.generativeai as genai
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pinecone import Pinecone
from dotenv import load_dotenv

# ==========================================
# Configurações de Ambiente e Clientes
# ==========================================
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
pinecone_key = os.getenv("PINECONE_API_KEY")

genai.configure(api_key=api_key)
pc = Pinecone(api_key=pinecone_key)
index = pc.Index("senior-dap-knowledge") # O banco de 3072 dimensões

app = FastAPI(title="Aura Backend - Senior Flow RAG")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalysisRequest(BaseModel):
    image: str
    url: str
    prompt: str = "O que devo fazer nesta tela?" # Novo: O que o usuário digitou no chat

# Função de log mantida
def salvar_log_aura(url, pergunta, resposta):
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_entry = f"[{timestamp}] URL: {url}\nUSUÁRIO: {pergunta}\nAURA: {resposta}\n{'-'*50}\n"
    with open("aura_responses.log", "a", encoding="utf-8") as f:
        f.write(log_entry)

@app.post("/analyze")
async def analyze_screen(request: AnalysisRequest):
    try:
        # 1. Recupera o Contexto do Pinecone (RAG)
        print(f"🔍 Buscando no Pinecone por: '{request.prompt}'")
        
        # Transforma a pergunta do usuário em um vetor de 3072 dimensões
        embed_response = genai.embed_content(
            model="models/gemini-embedding-001",
            content=request.prompt,
            task_type="retrieval_query"
        )
        vetor_pergunta = embed_response['embedding']

        # Busca os 3 pedaços de manual mais relevantes
        resultados_busca = index.query(
            vector=vetor_pergunta,
            top_k=3,
            include_metadata=True
            # filter={"modulo": "GED"} <-- (Opcional) Poderia filtrar pela URL depois
        )

        contexto_manuais = ""
        if resultados_busca.matches:
            for match in resultados_busca.matches:
                contexto_manuais += f"Manual ({match.metadata['source']}): {match.metadata['text']}\n\n"
        
        print(f"📚 Contexto recuperado: {len(contexto_manuais)} caracteres.")

        # 2. Prepara a Imagem
        if "," in request.image:
            header, encoded = request.image.split(",", 1)
        else:
            encoded = request.image

        missing_padding = len(encoded) % 4
        if missing_padding:
            encoded += '=' * (4 - missing_padding)

        image_dict = {
            "mime_type": "image/png",
            "data": base64.b64decode(encoded)
        }

        # 3. Prompt RAG: Une a Imagem + Contexto + Pergunta
        prompt_final = f"""
Você é a Aura, assistente especialista do sistema Senior Flow.
O usuário está na URL: {request.url}

Abaixo estão trechos dos Manuais Oficiais da Senior Sistemas relevantes para a dúvida:
--- CONTEXTO OFICIAL ---
{contexto_manuais if contexto_manuais else "Nenhuma informação específica encontrada no manual. Use seu conhecimento geral."}
------------------------

Dúvida do Usuário: '{request.prompt}'

Sua Tarefa:
1. Analise a imagem da tela atual fornecida.
2. Leia o CONTEXTO OFICIAL.
3. Responda a dúvida do usuário cruzando a teoria do manual com o que você vê na tela.
4. Seja CURTA, OBJETIVA e use Português do Brasil. Fale diretamente com o usuário como uma guia.
"""

        # 4. Geração Final (Gemini Pro Vision/Flash)
        modelo_resposta = genai.GenerativeModel("gemini-1.5-flash") # 1.5-flash é excelente para visão+texto rápidos
        
        response = modelo_resposta.generate_content([prompt_final, image_dict])
        
        advice = response.text if response.text else "Desculpe, não consegui processar a orientação no momento."
        
        salvar_log_aura(request.url, request.prompt, advice)

        return {"advice": advice}

    except Exception as e:
        error_msg = f"Erro no Python: {str(e)}"
        print(error_msg)
        return {"advice": "Aura informa: Ocorreu um erro interno de RAG ou processamento."}