from fastapi import APIRouter

router = APIRouter()

@router.get("/sugerir-herramienta")
def sugerir_externa(tipo_tarea: str):
    herramientas = {
        "diseno_pro": {
            "nombre": "Gamma", 
            "url": "https://gamma.app", 
            "motivo": "Diseño visual avanzado y presentaciones interactivas."
        },
        "chat_extenso": {
            "nombre": "ChatGPT", 
            "url": "https://chatgpt.com", 
            "motivo": "Modelos de lenguaje alternativos para textos muy extensos."
        },
        "mapas_mentales": {
            "nombre": "Whimsical", 
            "url": "https://whimsical.com", 
            "motivo": "Diagramación fluida y mapas conceptuales dinámicos."
        }
    }
    return herramientas.get(tipo_tarea, {"error": "Tarea no categorizada", "sugerencia": "Consulta con el asistente general."})