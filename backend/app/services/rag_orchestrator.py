# backend/app/services/rag_orchestrator.py
import json
import logging
import re
import fitz
import os
from openai import OpenAI
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.core.database import supabase
from dotenv import load_dotenv
from app.services.rag_service import PDFExtractionError
from app.services.embeddings import embed_texts, EMBEDDING_DIM

load_dotenv()

logger = logging.getLogger("kokua.rag")
PROMPT_MAX_CHARS = 14000
PDF_MAX_CHARS = 8000
_RESERVA_PROMPT = 600
MAX_CHUNKS_SELECCION = 800

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
        if not pdf_bytes:
            raise PDFExtractionError("El PDF está vacío.")

        try:
            texto_paginas = []
            with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
                if not len(doc):
                    raise PDFExtractionError("El PDF no contiene páginas.")
                for numero, pagina in enumerate(doc, start=1):
                    try:
                        texto = pagina.get_text().strip()
                    except Exception as error:
                        raise PDFExtractionError(
                            f"No se pudo extraer el texto de la página {numero}: {error}"
                        ) from error
                    if texto:
                        texto_paginas.append(f"Página {numero}:\n{texto}")
        except PDFExtractionError:
            raise
        except Exception as error:
            raise PDFExtractionError(f"No se pudo leer el PDF: {error}") from error

        if not texto_paginas:
            raise PDFExtractionError("El PDF no contiene texto extraíble.")
        return "\n\n".join(texto_paginas)

    # =========================
    # EMBEDDINGS (GEMINI)
    # =========================
    @staticmethod
    def _get_embedding(texto: str):
        try:
            return embed_texts([texto], "consulta")[0]
        except Exception:
            logger.exception("Falló la generación del embedding de consulta")
            return None

    @staticmethod
    def _buscar_fragmentos(query_vector, id_docente, k) -> list[str]:
        if not query_vector:
            return []
        if not id_docente:
            print("[RAG] No se buscan fragmentos: falta id_docente")
            return []
        try:
            result = supabase.rpc(
                "match_chunks",
                {
                    "query_embedding": query_vector,
                    "p_id_docente": id_docente,
                    "match_count": k,
                },
            ).execute()
            fragmentos = [
                fila["contenido_chunk"] for fila in (result.data or [])
            ]
            print(f"[RAG] {len(fragmentos)} fragmentos recuperados para el docente")
            return fragmentos
        except Exception:
            logger.exception("Falló la búsqueda de fragmentos RAG")
            return []

    @staticmethod
    def _presupuesto_contexto(system_instruction, user_prompt) -> int:
        base = len(system_instruction) + len(user_prompt)
        if base > PROMPT_MAX_CHARS:
            print("[RAG] La instrucción y el pedido superan el límite del prompt")
        return max(0, PROMPT_MAX_CHARS - base - _RESERVA_PROMPT)

    @staticmethod
    def _recortar_fragmentos(fragmentos: list[str], presupuesto: int) -> str:
        if presupuesto <= 0:
            return ""
        seleccionados = []
        longitud = 0
        for fragmento in fragmentos:
            longitud_nueva = longitud + len(fragmento) + (1 if seleccionados else 0)
            if longitud_nueva > presupuesto:
                break
            seleccionados.append(fragmento)
            longitud = longitud_nueva
        return "\n".join(seleccionados)

    @staticmethod
    def _seleccionar_fragmentos_pdf(
        texto, consulta, max_chars
    ) -> tuple[str, bool]:
        if len(texto) <= max_chars:
            return texto, False
        if max_chars <= 0:
            return "", True

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=100,
        )
        fragmentos = splitter.split_text(texto)
        if len(fragmentos) > MAX_CHUNKS_SELECCION:
            print(
                f"[RAG] PDF dividido en {len(fragmentos)} fragmentos; "
                "se usará el inicio sin vectorizar todo el documento"
            )
            return texto[:max_chars], True

        try:
            vectores = embed_texts(fragmentos, "documento")
            vector_consulta = embed_texts([consulta[:2000]], "consulta")[0]
            puntajes = [
                sum(valor * vector_consulta[indice] for indice, valor in enumerate(vector))
                for vector in vectores
            ]
            posiciones = sorted(
                range(len(fragmentos)),
                key=lambda posicion: puntajes[posicion],
                reverse=True,
            )
            elegidos = []
            longitud = 0
            for posicion in posiciones:
                separador = len("\n[...]\n") if elegidos else 0
                longitud_nueva = longitud + separador + len(fragmentos[posicion])
                if longitud_nueva <= max_chars:
                    elegidos.append(posicion)
                    longitud = longitud_nueva
            elegidos.sort()
            return "\n[...]\n".join(fragmentos[posicion] for posicion in elegidos), True
        except Exception:
            logger.exception("Falló la selección semántica de fragmentos del PDF")
            return texto[:max_chars], True

    # =========================
    # GENERATION (GROQ)
    # =========================
    @staticmethod
    def _generate(prompt: str, max_chars: int = PROMPT_MAX_CHARS):

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
                logger.exception("Falló la generación con el modelo %s", modelo)

                continue

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
        presupuesto = cls._presupuesto_contexto(system_instruction, user_prompt)
        presupuesto_pdf = min(PDF_MAX_CHARS, presupuesto)
        texto_pdf, recortado = cls._seleccionar_fragmentos_pdf(
            texto_archivo, user_prompt, presupuesto_pdf
        )
        presupuesto_extra = max(0, presupuesto - len(texto_pdf))
        fragmentos_db = cls._buscar_fragmentos(query_vector, id_docente, 4)
        context_db = cls._recortar_fragmentos(fragmentos_db, presupuesto_extra)
        bloque_pdf = texto_pdf
        if recortado:
            bloque_pdf = (
                "(Se incluyen los fragmentos más relevantes del PDF, no el documento completo.)\n"
                + texto_pdf
            )
        print(
            f"[RAG] PDF de {len(texto_archivo)} caracteres: "
            f"se usaron {len(texto_pdf)}"
        )

        full_prompt = f"""
{system_instruction}

CONTENIDO DEL ARCHIVO PDF ADJUNTO (PRIORIDAD ALTA):
{bloque_pdf if bloque_pdf else "No se pudo leer el archivo."}

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
        presupuesto = cls._presupuesto_contexto(system_instruction, user_prompt)
        fragmentos = cls._buscar_fragmentos(query_vector, id_docente, 6)
        context_text = cls._recortar_fragmentos(fragmentos, presupuesto)

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
        system_instruction = """
        Sos un asistente pedagógico experto llamado Kōkua. Respondé de manera amigable, clara y útil.
        Basáte en el contexto proporcionado para dar respuestas precisas sobre temas educativos.
        Si no hay contexto suficiente, pedí más información o sugerí subir documentos.
        """

        presupuesto = cls._presupuesto_contexto(system_instruction, user_prompt)
        fragmentos = cls._buscar_fragmentos(query_vector, id_docente, 6)
        context_text = cls._recortar_fragmentos(fragmentos, presupuesto)

        full_prompt = f"""
{system_instruction}

CONTEXTO DE TUS MATERIALES:
{context_text}

CONSULTA DEL DOCENTE:
{user_prompt}
"""
        raw_text = cls._generate(full_prompt)
        return raw_text