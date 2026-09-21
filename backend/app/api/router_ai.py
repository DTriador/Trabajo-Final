# backend/app/api/router_ai.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.rag_orchestrator import RAGOrchestrator
from app.core.database import supabase
import re
import json

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
    "/podcast":   "Generar un podcast educativo en audio",
    "/crucigrama": "Generar un crucigrama",
    "/sopa":      "Generar una sopa de letras",
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


def detectar_generacion_natural(mensaje: str):
    """Reconoce pedidos de archivo escritos sin slash.

    El chat antes solo generaba materiales cuando el usuario conocía los
    comandos rápidos. Las preguntas normales siempre terminaban en texto,
    aunque fueran pedidos explícitos de una presentación, apunte o guía.
    """
    texto = (mensaje or "").strip()
    minuscula = texto.lower()
    tipos = (
        ("/ppt", ("ppt", "powerpoint", "presentación", "presentacion")),
        ("/resumen", ("apunte", "resumen")),
        ("/preguntas", ("preguntas guía", "preguntas guia", "guía de preguntas", "guia de preguntas")),
        ("/examen", ("examen", "evaluación", "evaluacion")),
        ("/podcast", ("podcast",)),
        ("/crucigrama", ("crucigrama",)),
        ("/sopa", ("sopa de letras", "sopa letras")),
    )
    for comando, palabras in tipos:
        if any(palabra in minuscula for palabra in palabras):
            match = re.search(r"(?:sobre|acerca de|de)\s+(.+)$", texto, flags=re.IGNORECASE)
            tema = match.group(1).strip() if match else texto
            return comando, tema
    return None, None


def _accion_generacion(comando: str, tema: str):
    parametros = {}
    if comando == "/preguntas":
        parametros = {
            "nombre_guia": f"Guía de preguntas - {tema}",
            "numero_preguntas": "10",
        }
    elif comando == "/examen":
        parametros = {
            "fecha_examen": "",
            "temas": json.dumps([tema]),
            "tipos": json.dumps({
                "desarrollo": {"activo": True, "cantidad": 5},
                "multiple": {"activo": False, "cantidad": 0},
                "completar": {"activo": False, "cantidad": 0},
                "verdadero_falso": {"activo": False, "cantidad": 0},
            }),
        }

    mapa = {
        "/ppt":       {"endpoint": "/generar/presentacion", "tipo": "PPT",     "icono": "📊"},
        "/resumen":   {"endpoint": "/generar/apunte",       "tipo": "Apunte",  "icono": "📄"},
        "/preguntas": {"endpoint": "/generar/preguntas",    "tipo": "Guía",    "icono": "❓"},
        "/examen":    {"endpoint": "/generar/examen",       "tipo": "Examen",  "icono": "📝"},
        "/podcast":   {"endpoint": "/generar/podcast",      "tipo": "Podcast en audio", "icono": "🎧"},
        "/crucigrama": {"endpoint": "/generar/crucigrama",  "tipo": "Crucigrama", "icono": "➕"},
        "/sopa":       {"endpoint": "/generar/sopa_letras", "tipo": "Sopa de letras", "icono": "🔠"},
    }
    info = mapa[comando]
    return {
        "accion": "generar",
        "endpoint": info["endpoint"],
        "tipo": info["tipo"],
        "icono": info["icono"],
        "parametros": parametros,
    }


@router.post("/chat")
async def chat_asistente(request: ChatRequest):
    """Asistente Kōkua: responde con RAG sobre los documentos del docente,
    y reconoce comandos rápidos para disparar generaciones."""
    try:
        comando, argumento = detectar_comando(request.mensaje)
        if comando is None:
            comando, argumento = detectar_generacion_natural(request.mensaje)

        # ===== CASO 1: COMANDO =====
        if comando == "/ayuda":
            lista = "\n".join([f"• `{cmd}` — {desc}" for cmd, desc in COMANDOS.items()])
            return {"status": "success", "tipo": "texto",
                    "respuesta": f"Estos son los comandos que entiendo:\n\n{lista}\n\nEjemplo: `/ppt sistema solar`"}

        if comando in ("/ppt", "/resumen", "/preguntas", "/examen", "/podcast", "/crucigrama", "/sopa"):
            if not argumento:
                return {"status": "success", "tipo": "texto",
                        "respuesta": f"Decime sobre qué tema. Ejemplo: `{comando} fotosíntesis`"}

            info = _accion_generacion(comando, argumento)
            return {
                "status": "success",
                "tipo": "accion",
                **info,
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