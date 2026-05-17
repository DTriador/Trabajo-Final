# seed_data.py
import asyncio
from app.core.database import supabase

async def cargar_datos_demo():
    print("Iniciando carga de datos demo para la defensa...")
    
    # IMPORTANTE: Reemplazá este ID por tu ID de usuario de Supabase Auth
    ID_DOCENTE_DEMO = "tu_uuid_aqui" 

    archivos_demo = [
        {
            "id_docente": ID_DOCENTE_DEMO,
            "nombre_archivo": "Planificacion_Fisica_Cinematica.pptx",
            "tipo_formato": "pptx",
            "tema_especifico": "Cinemática y MRU",
            "categoria_ia": "RAG_Generacion"
        },
        {
            "id_docente": ID_DOCENTE_DEMO,
            "nombre_archivo": "Examen_Literatura_MioCid.docx",
            "tipo_formato": "docx",
            "tema_especifico": "Cantar de Mio Cid",
            "categoria_ia": "Evaluacion"
        },
        {
            "id_docente": ID_DOCENTE_DEMO,
            "nombre_archivo": "Guion_Podcast_Historia.json",
            "tipo_formato": "podcast_script",
            "tema_especifico": "Revolución de Mayo",
            "categoria_ia": "Multimedia"
        }
    ]

    for archivo in archivos_demo:
        try:
            supabase.table("archivos_generados").insert(archivo).execute()
            print(f"Cargado: {archivo['nombre_archivo']}")
        except Exception as e:
            print(f"Error en {archivo['nombre_archivo']}: {e}")

if __name__ == "__main__":
    asyncio.run(cargar_datos_demo())