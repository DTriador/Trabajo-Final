# backend/app/api/router_ai.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.rag_orchestrator import RAGOrchestrator
from app.core.database import supabase
import re

router = APIRouter()

class ChatRequest(BaseModel):
    mensaje: str
    id_docente: str

# Comandos rápidos disponibles desde el chat
COMANDOS = {
    "/ppt":       "Generar una presentación PowerPoint",
    "/resumen":   "Resumir tus documentos sobre un tema",
    "/preguntas": "Generar preguntas de repaso sobre un tema",
    "/examen":    "Crear un examen rápido sobre un tema",
    "/ayuda":     "Ver lista de comandos",
}

def detectar_comando(mensaje: str):
    """Devuelve (comando, argumento) si el mensaje empieza con un / conocido."""
    m = re.match(r"^(/\w+)\s*(.*)", mensaje.strip())
    if not m:
        return None, None
    comando = m.group(1).lower()
    argumento = m.group(2).strip()
    return (comando, argumento) if comando in COMANDOS else (None, None)


@router.post("/chat")
async def chat_asistente(request: ChatRequest):
    """Asistente Kōkua: responde con RAG sobre los documentos del docente,
    y reconoce comandos rápidos para disparar generaciones."""
    try:
        comando, argumento = detectar_comando(request.mensaje)

        # ===== CASO 1: COMANDO =====
        if comando == "/ayuda":
            lista = "\n".join([f"• `{cmd}` — {desc}" for cmd, desc in COMANDOS.items()])
            return {"status": "success", "tipo": "texto",
                    "respuesta": f"Estos son los comandos que entiendo:\n\n{lista}\n\nEjemplo: `/ppt sistema solar`"}

        if comando in ("/ppt", "/resumen", "/preguntas", "/examen"):
            if not argumento:
                return {"status": "success", "tipo": "texto",
                        "respuesta": f"Decime sobre qué tema. Ejemplo: `{comando} fotosíntesis`"}

            # Mapeamos el comando a una acción que el FRONT debe disparar
            mapa = {
                "/ppt":       {"accion": "generar", "endpoint": "/generar/presentacion", "tipo": "PPT",     "icono": "📊"},
                "/resumen":   {"accion": "generar", "endpoint": "/generar/apunte",       "tipo": "Apunte",  "icono": "📄"},
                "/preguntas": {"accion": "generar", "endpoint": "/generar/preguntas",    "tipo": "Guía",    "icono": "❓"},
                "/examen":    {"accion": "generar", "endpoint": "/generar/examen",       "tipo": "Examen",  "icono": "📝"},
            }
            info = mapa[comando]
            return {
                "status": "success",
                "tipo": "accion",
                "accion": info["accion"],
                "endpoint": info["endpoint"],
                "tema": argumento,
                "respuesta": f"{info['icono']} Dale, voy a generar un {info['tipo']} sobre **{argumento}**. Esto puede tardar unos segundos…",
            }

        # ===== CASO 2: PREGUNTA NORMAL → RAG =====
        try:
            respuesta_rag = await RAGOrchestrator.generar_respuesta_pedagogica(
                request.mensaje, request.id_docente
            )
            return {"status": "success", "tipo": "texto", "respuesta": respuesta_rag}
        except Exception as e:
            print(f"⚠️ RAG falló, uso fallback: {e}")
            return {
                "status": "success",
                "tipo": "texto",
                "respuesta": (
                    f"Recibí tu consulta: «{request.mensaje}». "
                    "Probá subiendo primero un PDF con el clip 📎 para que pueda responderte "
                    "basándome en tus materiales. También podés escribir `/ayuda` para ver qué más puedo hacer."
                ),
            }

    except Exception as e:
        print(f"Error en Chatbot: {str(e)}")
        raise HTTPException(status_code=500, detail="Error interno en el asistente de IA")