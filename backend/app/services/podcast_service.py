from app.services.rag_orchestrator import RAGOrchestrator
from app.services.ai_service import SYSTEM_PROMPT_PODCAST

class PodcastService:
    @staticmethod
    async def generar_guion_educativo(tema: str):
        # Usamos el orquestador RAG para que el guion tenga "base científica" del PDF
        datos_guion = await RAGOrchestrator.get_context_and_generate(
            user_prompt=f"Generá un guion de podcast sobre el tema: {tema}. Enfócate en lo más importante para un examen.",
            system_instruction=SYSTEM_PROMPT_PODCAST
        )
        return datos_guion