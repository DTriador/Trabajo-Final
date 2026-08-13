# backend/app/api/router_contenido.py
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional
from app.utils.engines import FileEngine
from app.core.database import supabase
from app.services.rag_orchestrator import RAGOrchestrator
from app.services.ai_service import SYSTEM_PROMPT_XLSX
from app.api.generacion_utils import process_and_upload
from io import BytesIO
from fastapi.responses import StreamingResponse
from app.utils.storage import construir_ruta_storage

# ── Helpers, generadores y conversor PDF extraídos a sus propios módulos ────
from app.api.contenido_helpers import _datos_escuela_materia, _contexto_biblio, _encabezado_documento
from app.api.contenido_generadores import (
    generar_apunte_docx, generar_preguntas_docx, generar_examen_docx,
    generar_podcast_docx, generar_presentacion_pptx,
)
from app.api.contenido_pdf_export import (
    ExportarPDFRequest, _detectar_conversor, convertir_docx_url_a_pdf,
)

router = APIRouter()


# ── planilla ──────────────────────────────────────────────────────────────────

@router.post("/planilla")
async def generar_planilla(tema: str, id_docente: str):
    try:
        prompt = f"Generá un cronograma de clases para el tema {tema}"
        datos_json = await RAGOrchestrator.get_context_and_generate(
            prompt,
            SYSTEM_PROMPT_XLSX,
            id_docente=id_docente,
        )
        archivo_binario = FileEngine.create_xlsx(datos_json)
        return await process_and_upload(archivo_binario, f"Plan_{tema}", tema, "xlsx", id_docente, "RAG_XLSX")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── apunte ────────────────────────────────────────────────────────────────────

@router.post("/apunte")
async def generar_apunte(
    tema: str = Form(...),
    id_docente: str = Form(...),
    file: Optional[UploadFile] = File(None),
    id_escuela: Optional[str] = Form(None),
    id_curso: Optional[str] = Form(None),
    fecha: Optional[str] = Form(None),
):
    try:
        docx_bytes, nombre_archivo = await generar_apunte_docx(
            tema, id_docente, file, id_escuela, id_curso, fecha
        )
        return await process_and_upload(
            docx_bytes, nombre_archivo, tema, "docx", id_docente, "RAG_APUNTE"
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"DEBUG ERROR APUNTE: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ── preguntas guía ────────────────────────────────────────────────────────────

@router.post("/preguntas")
async def generar_preguntas(
    tema: str = Form(...),
    id_docente: str = Form(...),
    nombre_guia: str = Form(...),
    numero_preguntas: int = Form(10),
    file: Optional[UploadFile] = File(None),
    id_escuela: Optional[str] = Form(None),
    id_curso: Optional[str] = Form(None),
    fecha: Optional[str] = Form(None),
):
    try:
        docx_bytes, nombre_archivo = await generar_preguntas_docx(
            tema, id_docente, nombre_guia, numero_preguntas, file, id_escuela, id_curso, fecha
        )
        return await process_and_upload(
            docx_bytes, nombre_archivo, tema, "docx", id_docente, "RAG_PREGUNTAS"
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"DEBUG ERROR PREGUNTAS: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ── examen ────────────────────────────────────────────────────────────────────

@router.post("/examen")
async def generar_examen(
    id_docente: str = Form(...),
    materia: Optional[str] = Form(None),
    fecha_examen: str = Form(...),
    tipos: str = Form(...),
    file: Optional[UploadFile] = File(None),
    id_escuela: Optional[str] = Form(None),
    id_curso: Optional[str] = Form(None),
):
    try:
        docx_bytes, nombre_archivo, nombre_materia = await generar_examen_docx(
            id_docente, materia, fecha_examen, tipos, file, id_escuela, id_curso
        )
        return await process_and_upload(
            docx_bytes, nombre_archivo, nombre_materia, "docx", id_docente, "RAG_EXAMEN"
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"DEBUG ERROR EXAMEN: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ── podcast ───────────────────────────────────────────────────────────────────

@router.post("/podcast")
async def generar_podcast(
    tema: str = Form(...),
    id_docente: str = Form(...),
    file: Optional[UploadFile] = File(None),
    id_escuela: Optional[str] = Form(None),
    id_curso: Optional[str] = Form(None),
    fecha: Optional[str] = Form(None),
):
    try:
        docx_bytes, nombre_archivo = await generar_podcast_docx(
            tema, id_docente, file, id_escuela, id_curso, fecha
        )
        return await process_and_upload(
            docx_bytes, nombre_archivo, tema, "docx", id_docente, "RAG_PODCAST"
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"DEBUG ERROR PODCAST: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ── presentacion ──────────────────────────────────────────────────────────────

@router.post("/presentacion")
async def generar_presentacion(
    tema: str = Form(...),
    id_docente: str = Form(...),
    file: UploadFile = File(None),
):
    """Genera un PPTX a partir de un tema y, opcionalmente, un PDF de contexto."""
    try:
        return await generar_presentacion_pptx(tema, id_docente, file)
    except Exception as e:
        print(f"❌ Error generando presentación: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al generar presentación: {str(e)}")


# ── Endpoint: exportar a PDF ──────────────────────────────────────────────────

@router.post("/exportar_pdf")
async def exportar_pdf(body: ExportarPDFRequest):
    """
    Descarga el .docx desde Supabase Storage, lo convierte a PDF
    con el mejor conversor disponible y lo devuelve como descarga directa.
    """
    pdf_bytes, safe_name, _conversor = await convertir_docx_url_a_pdf(
        body.url_docx, body.nombre_archivo
    )

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}.pdf"',
            "Content-Length":      str(len(pdf_bytes)),
        },
    )


# ── Endpoint: diagnóstico del conversor ──────────────────────────────────────

@router.get("/exportar_pdf/info")
async def info_conversor():
    """
    Devuelve qué conversor detectó el servidor.
    Llamalo después de deployar para verificar la calidad de conversión.
    """
    conversor = _detectar_conversor()
    msgs = {
        "libreoffice": "✅ Alta calidad — preserva tablas, fuentes y estilos",
        "docx2pdf":    "✅ Alta calidad — preserva formato completo",
        "ninguno":     "⚠️ Solo texto plano (ReportLab). Instalá LibreOffice: sudo apt install libreoffice",
    }
    return {
        "conversor": conversor,
        "detalle":   msgs.get(conversor, "desconocido"),
    }
