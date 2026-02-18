import os
from google import genai
from dotenv import load_dotenv

# Carrega a chave do .env
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

def listar_e_testar():
    if not api_key:
        print("❌ Chave GEMINI_API_KEY não encontrada no .env")
        return

    print(f"📡 Testando chave: {api_key[:10]}...")
    client = genai.Client(api_key=api_key)
    
    print("\n--- Modelos Disponíveis ---")
    try:
        # Lista apenas os nomes para evitar erros de atributo
        for model in client.models.list():
            print(f"✅ Disponível: {model.name}")
        
        print("\n--- Testando Geração de Conteúdo ---")
        # Usamos o nome padrão. Se der 404, tente 'gemini-1.5-flash'
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents="Oi! Responda apenas: Aura Online!"
        )
        print(f"🚀 Resultado: {response.text}")
        
    except Exception as e:
        print(f"❌ Erro na conexão: {e}")

if __name__ == "__main__":
    listar_e_testar()