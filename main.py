import os
import base64
import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

app = FastAPI(title="Aura Backend - Senior Flow Specialist")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalysisRequest(BaseModel):
    image: str
    url: str

# Função simples para logar as respostas
def salvar_log_aura(url, resposta):
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_entry = f"[{timestamp}] URL: {url}\nAURA: {resposta}\n{'-'*50}\n"
    with open("aura_responses.log", "a", encoding="utf-8") as f:
        f.write(log_entry)

@app.post("/analyze")
async def analyze_screen(request: AnalysisRequest):
    try:
        if "," in request.image:
            header, encoded = request.image.split(",", 1)
        else:
            encoded = request.image

        missing_padding = len(encoded) % 4
        if missing_padding:
            encoded += '=' * (4 - missing_padding)

        image_bytes = base64.b64decode(encoded)

        # PROMPT REFINADO: Foco em brevidade e objetividade (PT-BR)
        prompt_text = (
            "Você é a Aura, assistente brasileira do Senior Flow. "
            "Sua tarefa: Analise o print e dê uma dica CURTA e OBJETIVA. "
            "Regras: Máximo de 3 frases. Sem introduções longas. Direto ao ponto. "
            "Use Português do Brasil. Foco em produtividade. "
            f"URL: {request.url}"
        )

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_text(text=prompt_text),
                        types.Part.from_bytes(data=image_bytes, mime_type="image/png")
                    ]
                )
            ]
        )

        advice = response.text if response.text else "Não consegui analisar agora."
        
        # Salva a resposta no arquivo de log antes de retornar
        salvar_log_aura(request.url, advice)

        return {"advice": advice}

    except Exception as e:
        error_msg = f"Erro no Python: {str(e)}"
        salvar_log_aura(request.url, error_msg)
        raise HTTPException(status_code=500, detail=error_msg)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)