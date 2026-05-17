from PyPDF2 import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter
import google.generativeai as genai
import os

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

class RAGService:
    @staticmethod
    def process_pdf(file_path: str):
        # 1. Leer el PDF
        reader = PdfReader(file_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text()
            
        # 2. Fragmentar el texto (para que quepa en la memoria de la IA)
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=100
        )
        chunks = text_splitter.split_text(text)
        
        # 3. Generar Embeddings (Vectores)
        # Usamos el modelo gratuito de Google para esto
        embeddings = genai.embed_content(
            model="models/text-embedding-004",
            content=chunks,
            task_type="retrieval_document"
        )
        
        return chunks, embeddings['embedding']
@staticmethod
async def process_audio(file_path: str):
    # Gemini 1.5 Flash puede leer audio directamente.
    # 1. Subir el archivo a Google AI File Manager (Temporal)
    audio_file = genai.upload_file(path=file_path)
        
    # 2. Pedir transcripción y resumen pedagógico
    model = genai.GenerativeModel('gemini-1.5-flash')
    response = model.generate_content([audio_file, "Transcribí este audio y extraé los conceptos clave para una clase secundaria."])
        
    return response.text