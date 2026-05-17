from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Form
import shutil
import os
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
    file: UploadFile = File(...),
    id_docente: str = Form(...),          # ← agregar este parámetro
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF")
    file_path = os.path.join(UPLOAD_DIR, f"{id_docente}_{file.filename}")
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        tamanio_mb = round(os.path.getsize(file_path) / (1024 * 1024), 3)
        # ← ESTO ES LO QUE FALTABA: registrar en Supabase
        supabase.table("archivos_generados").insert({
            "id_docente":      id_docente,
            "nombre_archivo":  file.filename,
            "tipo_formato":    "pdf",
            "sub_tipo":        "bibliografia",
            "tema_especifico": "Bibliografía",
            "fecha_creacion":  datetime.now().isoformat(),
            "categoria_ia":    "BIBLIOGRAFIA",
            "url_descarga":    file_path,
            "uso_mb":          tamanio_mb,
            "descripcion":     "Documento de bibliografía subido por el docente",
        }).execute()
        return {
            "status":  "success",
            "message": f"Archivo {file.filename} recibido y registrado correctamente",
            "path":    file_path,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al guardar: {str(e)}")
