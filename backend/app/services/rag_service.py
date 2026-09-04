# backend/app/services/rag_service.py
import os
from PyPDF2 import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from google import genai as google_genai

# Mismo SDK y mismo cliente que rag_orchestrator.py, para no mantener
# dos formas distintas de hablarle a la API de Gemini.
_gemini_client = google_genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


class RAGService:

    @staticmethod
    def process_pdf(file_path: str):
        """
        Extrae el texto de un PDF, lo trocea y genera los embeddings
        de cada fragmento. Usa el mismo modelo de embeddings que
        RAGOrchestrator._get_embedding (rag_orchestrator.py) para que
        los vectores sean comparables en la búsqueda por similitud.
        """
        # 1. Leer el PDF
        reader = PdfReader(file_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""

        # 2. Fragmentar el texto (para que quepa en la memoria de la IA)
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=100,
        )
        chunks = text_splitter.split_text(text)

        if not chunks:
            return [], []

        # 3. Generar embeddings — MISMO modelo que usa RAGOrchestrator
        #    al vectorizar la consulta, para que ambos vivan en el
        #    mismo espacio vectorial y la búsqueda por similitud sea válida.
        response = _gemini_client.models.embed_content(
            model="models/gemini-embedding-001",
            contents=chunks,
        )
        vectores = [e.values for e in response.embeddings]

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