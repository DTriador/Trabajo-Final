# backend/app/services/rag_orchestrator.py
import json
import re
import fitz  # PyMuPDF
import os
from openai import OpenAI

from app.core.database import supabase
from dotenv import load_dotenv

load_dotenv()

# 🔐 CLIENTE 1: OpenAI (SOLO para Embeddings - requiere tu clave de OpenAI)
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# 🔐 CLIENTE 2: Groq (SOLO para Generación - requiere tu clave de Groq)
groq_client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1"
)

class RAGOrchestrator:

    # =========================
    # PDF TEXT EXTRACTION
    # =========================
    @staticmethod
    def _extraer_texto_pdf(pdf_bytes):
        try:
            texto = ""
            with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
                for pagina in doc:
                    texto += pagina.get_text()
            return texto
        except Exception as e:
            print(f"Error extrayendo PDF: {e}")
            return ""

    # =========================
    # EMBEDDINGS (USANDO CLIENTE OPENAI)
    # =========================
    @staticmethod
    def _get_embedding(texto: str):
        try:
            # Importante: Usamos el cliente nativo de OpenAI para evitar el 404 en Groq
            response = openai_client.embeddings.create(
                input=texto,
                model="text-embedding-3-small"
            )
            return response.data[0].embedding
        except Exception as e:
            print(f"⚠️ API de Embeddings falló. Activando Bypass seguro. Error ignorado: {e}")
            return None 

    # =========================
    # GENERATION (USANDO CLIENTE GROQ)
    # =========================
    @staticmethod
    def _generate(prompt: str):
        modelos_a_probar = [
                "llama-3.3-70b-versatile", 
                "llama-3.1-8b-instant"
        ]
        
        errores = [] 
        
        for modelo in modelos_a_probar:
            try:
                print(f"⏳ Intentando generar la clase con el modelo: {modelo}...")
                response = groq_client.chat.completions.create(
                    model=modelo,
                    messages=[
                        {"role": "user", "content": prompt}
                    ]
                )
                print(f"✅ ¡Éxito con el modelo {modelo}!")
                return response.choices[0].message.content
            except Exception as e:
                error_real = str(e)
                print(f"⚠️ El modelo {modelo} falló. ERROR EXACTO: {error_real}")
                errores.append(error_real)
                continue
        
        print("\n❌ RESUMEN DE ERRORES DE GROQ:")
        for err in errores:
            print(f"- {err}")
            
        raise Exception("Groq rechazó la conexión. Revisá la consola para leer el error exacto.")

    # =========================
    # UTILIDAD: PARSER JSON (Faltaba en tu código)
    # =========================
    @staticmethod
    def _parse_json(text: str):
        try:
            # Busca bloques de JSON si el modelo incluyó texto extra
            match = re.search(r'\{.*\}', text, re.DOTALL)
            if match:
                return json.loads(match.group())
            return json.loads(text)
        except Exception as e:
            print(f"Error parseando JSON: {e}")
            return {"resumen": text[:100], "palabras": []}

    # =========================
    # WITH FILE (RAG)
    # =========================
    @classmethod
    async def get_context_from_file_and_generate(
        cls,
        file_content: bytes,
        user_prompt: str,
        system_instruction: str,
        id_docente: str  # <-- Agregado para el filtro de Supabase
    ):
        texto_archivo = cls._extraer_texto_pdf(file_content)
        query_vector = cls._get_embedding(user_prompt)

        context_db = ""
        if query_vector: 
            result = supabase.table('chunks_rag').select('contenido_chunk').filter(
                'id_docente', 'eq', id_docente
            ).order(
                'embedding <-> \'{}\''.format(','.join(map(str, query_vector)))
            ).limit(4).execute()
            context_db = "\n".join([row['contenido_chunk'] for row in result.data]) if result.data else ""

        full_prompt = f"""
{system_instruction}

CONTENIDO DEL ARCHIVO PDF ADJUNTO (PRIORIDAD ALTA):
{texto_archivo if texto_archivo else "No se pudo leer el archivo."}

CONTEXTO EXTRA:
{context_db}

PEDIDO:
{user_prompt}
"""
        raw_text = cls._generate(full_prompt)
        return cls._parse_json(raw_text)

    # =========================
    # WITHOUT FILE (RAG)
    # =========================
    @classmethod
    async def get_context_and_generate(
        cls,
        user_prompt: str,
        system_instruction: str,
        id_docente: str = None # <-- Agregado para consistencia
    ):
        query_vector = cls._get_embedding(user_prompt)

        context_text = ""
        if query_vector:
            # Si tienes id_docente, filtramos para que el RAG sea más preciso
            query = supabase.table('chunks_rag').select('contenido_chunk')
            if id_docente:
                query = query.filter('id_docente', 'eq', id_docente)
            
            result = query.order(
                'embedding <-> \'{}\''.format(','.join(map(str, query_vector)))
            ).limit(6).execute()
            context_text = "\n".join([row['contenido_chunk'] for row in result.data]) if result.data else ""

        full_prompt = f"""
{system_instruction}

CONTEXTO:
{context_text}

PEDIDO:
{user_prompt}
"""
        raw_text = cls._generate(full_prompt)
        return cls._parse_json(raw_text)

    # =========================
    # PEDAGOGICAL RESPONSE (CHAT)
    # =========================
    @classmethod
    async def generar_respuesta_pedagogica(
        cls,
        user_prompt: str,
        id_docente: str
    ):
        query_vector = cls._get_embedding(user_prompt)

        context_text = ""
        if query_vector:
            result = supabase.table('chunks_rag').select('contenido_chunk').filter(
                'id_docente', 'eq', id_docente
            ).order(
                'embedding <-> \'{}\''.format(','.join(map(str, query_vector)))
            ).limit(6).execute()
            context_text = "\n".join([row['contenido_chunk'] for row in result.data]) if result.data else ""

        system_instruction = """
        Sos un asistente pedagógico experto llamado Kōkua. Respondé de manera amigable, clara y útil.
        Basáte en el contexto proporcionado para dar respuestas precisas sobre temas educativos.
        Si no hay contexto suficiente, pedí más información o sugerí subir documentos.
        """

        full_prompt = f"""
{system_instruction}

CONTEXTO DE TUS MATERIALES:
{context_text}

CONSULTA DEL DOCENTE:
{user_prompt}
"""
        raw_text = cls._generate(full_prompt)
        return raw_text