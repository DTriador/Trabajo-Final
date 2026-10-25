# backend/app/services/rag_service.py
import os
from io import BytesIO
from PyPDF2 import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from app.services.embeddings import embed_texts

from google import genai as google_genai

_gemini_client = google_genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


class PDFExtractionError(ValueError):
    pass


def extract_pdf_pages(pdf_bytes: bytes) -> list[tuple[int, str]]:
    if not pdf_bytes:
        raise PDFExtractionError("El PDF está vacío.")

    try:
        reader = PdfReader(BytesIO(pdf_bytes))
        if not reader.pages:
            raise PDFExtractionError("El PDF no contiene páginas.")

        pages = []
        for page_number, page in enumerate(reader.pages, start=1):
            try:
                text = page.extract_text() or ""
            except Exception as error:
                raise PDFExtractionError(
                    f"No se pudo extraer el texto de la página {page_number}: {error}"
                ) from error
            if text.strip():
                pages.append((page_number, text.strip()))
    except PDFExtractionError:
        raise
    except Exception as error:
        raise PDFExtractionError(f"No se pudo leer el PDF: {error}") from error

    if not pages:
        raise PDFExtractionError(
            "El PDF no contiene texto extraíble (puede ser un escaneo)"
        )
    return pages


class RAGService:

    @staticmethod
    def process_pdf(file_path: str):
        """
        Extrae el texto de un PDF, lo trocea y genera los embeddings
        de cada fragmento. Usa el mismo modelo de embeddings que
        RAGOrchestrator._get_embedding (rag_orchestrator.py) para que
        los vectores sean comparables en la búsqueda por similitud.
        """
        with open(file_path, "rb") as pdf_file:
            pages = extract_pdf_pages(pdf_file.read())

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=100,
        )
        chunks = [
            f"Página {page_number}:\n{chunk}"
            for page_number, page_text in pages
            for chunk in text_splitter.split_text(page_text)
        ]
        vectores = embed_texts(chunks, "documento")

        return chunks, vectores

    @staticmethod
    async def process_audio(file_path: str):
        """
        Transcribe un audio y extrae los conceptos clave usando Gemini.
        """
        audio_file = _gemini_client.files.upload(file=file_path)

        response = _gemini_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[
                audio_file,
                "Transcribí este audio y extraé los conceptos clave para una clase secundaria.",
            ],
        )

        return response.text