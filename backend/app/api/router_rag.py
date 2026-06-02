from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Form
import shutil
import os
from typing import List
# Comentado porque no existe app.core.security en tu estructura actual
# from app.core.security import get_current_user 

from datetime import datetime
from app.core.database import supabase
router = APIRouter()

# Carpeta base para los PDFs de los docentes en Linux
# Usamos una ruta relativa que funcionará bien en tu carpeta Documentos
UPLOAD_DIR = "storage/pdfs"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/subir")
async def subir_documento(
    files: List[UploadFile] = File(...),
    id_docente: str = Form(...),
):
    """
    Acepta uno o varios archivos y los guarda en `storage/pdfs`.
    Registra cada archivo en la tabla `archivos_generados`.
    """
    resultados = []
    try:
        for file in files:
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
                print(f"⚠️ No pude registrar {filename} en BD: {e}")

            resultados.append({"filename": filename, "path": file_path, "size_mb": tamanio_mb})

        return {"status": "success", "uploaded": resultados}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar: {str(e)}")
