from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Form
import shutil
import os
from typing import List
# Comentado porque no existe app.core.security en tu estructura actual
# from app.core.security import get_current_user 
from datetime import datetime
import logging
from app.core.database import supabase
from app.services.rag_service import PDFExtractionError, RAGService, extract_pdf_pages  # ← agregado: indexación RAG

router = APIRouter()
logger = logging.getLogger(__name__)

# Carpeta base para los PDFs de los docentes en Linux
# Usamos una ruta relativa que funcionará bien en tu carpeta Documentos
UPLOAD_DIR = "storage/pdfs"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/subir")
async def subir_documento(
    files: List[UploadFile] | None = File(None),
    id_docente: str = Form(...),
    # Compatibilidad con el cliente antiguo, que enviaba `file` en singular.
    file: UploadFile | None = File(None),
):
    """
    Acepta uno o varios archivos y los guarda en storage/pdfs.
    Registra cada archivo en la tabla archivos_generados.
    Si el archivo es un PDF, además lo trocea y vectoriza para RAG,
    insertando los fragmentos en chunks_rag.
    """
    resultados = []
    try:
        archivos = list(files or [])
        if file is not None:
            archivos.append(file)
        if not archivos:
            raise HTTPException(status_code=400, detail="Seleccioná al menos un archivo PDF.")

        for file in archivos:
            filename = file.filename or 'file'
            ext = os.path.splitext(filename)[1].lower()
            # permitir varios tipos comunes además de PDF
            allowed = ['.pdf', '.docx', '.doc', '.pptx', '.ppt', '.xlsx', '.xls']
            if ext not in allowed:
                # si no está en la lista, lo guardamos pero marcamos tipo genérico
                tipo_formato = 'bin'
            else:
                tipo_formato = ext.replace('.', '')
            file_path = os.path.join(UPLOAD_DIR, f"{id_docente}_{filename}")
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            tamanio_mb = round(os.path.getsize(file_path) / (1024 * 1024), 3)
            sub_tipo = 'bibliografia' if ext == '.pdf' else 'material'
            categoria = 'BIBLIOGRAFIA' if ext == '.pdf' else 'MATERIAL'
            try:
                supabase.table("archivos_generados").insert({
                    "id_docente":      id_docente,
                    "nombre_archivo":  filename,
                    "tipo_formato":    tipo_formato,
                    "sub_tipo":        sub_tipo,
                    "tema_especifico": "Bibliografía" if ext == '.pdf' else None,
                    "fecha_creacion":  datetime.now().isoformat(),
                    "categoria_ia":    categoria,
                    "url_descarga":    file_path,
                    "uso_mb":          tamanio_mb,
                    "descripcion":     f"Archivo subido por el docente ({filename})",
                }).execute()
            except Exception as e:
                # no bloquear por fallo en el registro; seguimos con los demás
                logger.exception("No pude registrar %s en BD", filename)

            # ── Indexación RAG (solo PDFs) ──────────────────────────────────
            # Trocea el texto y genera embeddings para poder recuperarlo
            # luego como contexto en las consultas del asistente conversacional.
            chunks_indexados = 0
            indexado = False
            estado_indexacion = "not_applicable"
            error_indexacion = None
            if ext == '.pdf':
                estado_indexacion = "failed"
                try:
                    chunks, embeddings = RAGService.process_pdf(file_path)
                    supabase.table("chunks_rag").delete().eq(
                        "id_docente", id_docente
                    ).eq("nombre_original", filename).execute()
                    filas_chunks = [
                        {
                            "id_docente":      id_docente,
                            "nombre_original": filename,
                            "contenido_chunk": chunk_texto,
                            "embedding":       vector,
                        }
                        for chunk_texto, vector in zip(chunks, embeddings)
                    ]
                    for inicio in range(0, len(filas_chunks), 100):
                        supabase.table("chunks_rag").insert(
                            filas_chunks[inicio:inicio + 100]
                        ).execute()
                    chunks_indexados = len(filas_chunks)
                    indexado = True
                    estado_indexacion = "indexed"
                    print(f"[RAG] {filename}: {chunks_indexados} fragmentos indexados")
                except Exception as e:
                    # no bloquear la subida si falla la indexación: el archivo
                    # queda guardado igual, solo no estará disponible para RAG
                    logger.exception("No se pudo indexar %s para RAG", filename)
                    chunks_indexados = 0
                    indexado = False
                    error_indexacion = str(e)

            resultados.append({
                "filename": filename,
                "path": file_path,
                "size_mb": tamanio_mb,
                "chunks_indexados": chunks_indexados,
                "indexado": indexado,
                "estado_indexacion": estado_indexacion,
                "error_indexacion": error_indexacion,
            })
        return {"status": "success", "uploaded": resultados}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar: {str(e)}")