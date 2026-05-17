from fastapi import APIRouter, HTTPException
from app.services.podcast_service import PodcastService
from app.core.database import supabase

router = APIRouter()

@router.post("/generar/guion-podcast")
async def generar_guion(tema: str):
    try:
        guion_final = await PodcastService.generar_guion_educativo(tema)
        
        # Registro en BD para el BI (RF10)
        registro = {
            "nombre_archivo": f"Guion_{tema}.json",
            "tipo_formato": "podcast_script",
            "tema_especifico": tema,
            "categoria_ia": "RAG_Multimedia"
        }
        supabase.table("archivos_generados").insert(registro).execute()
        
        return guion_final
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))