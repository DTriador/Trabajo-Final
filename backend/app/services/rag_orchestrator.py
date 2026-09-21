# backend/app/services/rag_orchestrator.py
import json
import re
import fitz
import os
from openai import OpenAI
from google import genai as google_genai

from app.core.database import supabase
from dotenv import load_dotenv

load_dotenv()

# 🔐 Gemini para embeddings (gratis)
_gemini_client = google_genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# 🔐 Groq para generación
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
    # EMBEDDINGS (GEMINI)
    # =========================
    @staticmethod
    def _get_embedding(texto: str):
        try:
            r = _gemini_client.models.embed_content(
                model="models/gemini-embedding-001",
                contents=texto,
            )
            return r.embeddings[0].values
        except Exception as e:
            print(f"⚠️ Embedding Gemini falló. Bypass activado. Error: {e}")
            return None

    # =========================
    # GENERATION (GROQ)
    # =========================
    @staticmethod
    def _generate(prompt: str, max_chars: int = 14000):

        # Evitar prompts excesivamente largos
        if len(prompt) > max_chars:
            print(
                f"⚠️ Prompt truncado de "
                f"{len(prompt)} a {max_chars} caracteres"
            )
            prompt = prompt[:max_chars]

        modelos_a_probar = [
            "openai/gpt-oss-120b",
            "openai/gpt-oss-20b",
            "qwen/qwen3.6-27b",
        ]

        errores = []

        espera_json = any(
            marca in prompt.upper()
            for marca in (
                "JSON VÁLIDO",
                "JSON VALIDO",
                "EXCLUSIVAMENTE CON UN JSON",
                "FORMATO JSON",
                "JSON A DEVOLVER",
            )
        )

        for modelo in modelos_a_probar:

            try:
                print(
                    f"⏳ Intentando generar con el modelo: "
                    f"{modelo}..."
                )

                request = {
                    "model": modelo,
                    "messages": [
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    # 1500 tokens cortaba los apuntes, las guías y las
                    # presentaciones antes de cerrar el JSON.
                    "max_tokens": 5000,
                }
                if espera_json:
                    request["response_format"] = {"type": "json_object"}

                try:
                    response = groq_client.chat.completions.create(**request)
                except Exception:
                    # Algunos modelos/proxies no exponen response_format.
                    # Reintentamos el mismo modelo sin esa opción antes de
                    # pasar al siguiente.
                    if "response_format" not in request:
                        raise
                    request.pop("response_format", None)
                    response = groq_client.chat.completions.create(**request)

                print(f"✅ ¡Éxito con el modelo {modelo}!")

                return response.choices[0].message.content

            except Exception as e:

                error_real = str(e)

                print(
                    f"⚠️ El modelo {modelo} falló. "
                    f"ERROR: {error_real}"
                )

                errores.append(
                    f"{modelo}: {error_real}"
                )

                continue

        print("\n❌ RESUMEN DE ERRORES DE GROQ:")

        for err in errores:
            print(f"- {err}")

        raise Exception(
            "No fue posible generar una respuesta con "
            "ninguno de los modelos configurados en Groq."
        )

    # =========================
    # UTILIDAD: PARSER JSON
    # =========================
    @staticmethod
    def _parse_json(text: str):
        """Parsea JSON aunque el modelo agregue markdown o texto alrededor.

        El parser anterior convertía cualquier error en
        ``{"resumen": ..., "palabras": []}``. Eso hacía que los generadores
        parecieran funcionar, pero luego no encontraran ``secciones`` o
        ``preguntas`` y devolvieran documentos vacíos. Conservamos el texto
        crudo para que cada generador pueda aplicar su fallback.
        """
        if isinstance(text, (dict, list)):
            return text
        if not isinstance(text, str):
            return {"_raw": str(text or "")}

        limpio = text.strip()
        limpio = re.sub(r"^```(?:json)?\s*", "", limpio, flags=re.IGNORECASE)
        limpio = re.sub(r"\s*```$", "", limpio).strip()

        try:
            return json.loads(limpio)
        except Exception:
            pass

        # Extrae el primer objeto/lista JSON completo, sin usar una expresión
        # greedy que mezcle dos objetos o falle con llaves dentro de strings.
        decoder = json.JSONDecoder()
        for indice, caracter in enumerate(limpio):
            if caracter not in "{[":
                continue
            try:
                valor, _ = decoder.raw_decode(limpio[indice:])
                return valor
            except Exception:
                continue

        print("Error parseando JSON: la respuesta quedó incompleta o no era JSON")
        return {"_raw": limpio}

    # =========================
    # WITH FILE (RAG)
    # =========================
    @classmethod
    async def get_context_from_file_and_generate(
        cls,
        file_content: bytes,
        user_prompt: str,
        system_instruction: str,
        id_docente: str,
    ):
        texto_archivo = cls._extraer_texto_pdf(file_content)
        query_vector = cls._get_embedding(user_prompt)

        context_db = ""
        if query_vector:
            try:
                result = supabase.table('chunks_rag').select('contenido_chunk').filter(
                    'id_docente', 'eq', id_docente
                ).order(
                    'embedding <-> \'{}\''.format(','.join(map(str, query_vector)))
                ).limit(4).execute()
                context_db = "\n".join([row['contenido_chunk'] for row in result.data]) if result.data else ""
            except Exception as rag_err:
                print(f"⚠️ RAG no disponible, generando sin contexto: {rag_err}")
                context_db = ""

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
        id_docente: str = None,
    ):
        query_vector = cls._get_embedding(user_prompt)

        context_text = ""
        if query_vector:
            try:
                query = supabase.table('chunks_rag').select('contenido_chunk')
                if id_docente:
                    query = query.filter('id_docente', 'eq', id_docente)
                result = query.order(
                    'embedding <-> \'{}\''.format(','.join(map(str, query_vector)))
                ).limit(6).execute()
                context_text = "\n".join([row['contenido_chunk'] for row in result.data]) if result.data else ""
            except Exception as rag_err:
                print(f"⚠️ RAG no disponible, generando sin contexto: {rag_err}")
                context_text = ""

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
        id_docente: str,
    ):
        query_vector = cls._get_embedding(user_prompt)

        context_text = ""
        if query_vector:
            try:
                result = supabase.table('chunks_rag').select('contenido_chunk').filter(
                    'id_docente', 'eq', id_docente
                ).order(
                    'embedding <-> \'{}\''.format(','.join(map(str, query_vector)))
                ).limit(6).execute()
                context_text = "\n".join([row['contenido_chunk'] for row in result.data]) if result.data else ""
            except Exception as rag_err:
                print(f"⚠️ RAG no disponible: {rag_err}")
                context_text = ""

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