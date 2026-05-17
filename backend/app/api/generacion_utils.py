# backend/app/api/generacion_utils.py
from app.utils.engines import FileEngine
from app.core.database import supabase
from app.utils.storage import sanitizar_clave_storage


async def process_and_upload(archivo_binario, nombre_base, tema, formato, id_docente, categoria):
    """
    Sube un archivo generado a Supabase Storage y lo registra en la tabla
    archivos_generados.

    El nombre del archivo se sanitiza automáticamente para evitar errores de
    InvalidKey en Supabase (caracteres como °, ñ, tildes, espacios, etc.).
    """
    # Sanitizar ANTES de construir la clave — fix para N°1, Física, Práctico, etc.
    nombre_limpio   = sanitizar_clave_storage(f"{nombre_base}_{id_docente[:5]}.{formato}")
    nombre_archivo  = nombre_limpio

    upload_result = FileEngine.upload_to_supabase(archivo_binario, nombre_archivo, id_docente)
    if not upload_result:
        raise Exception("La subida a Supabase Storage falló. No se registró el archivo.")

    storage_path = upload_result["path"]
    download_url = upload_result["url"]

    info_espacio = FileEngine.get_storage_usage(id_docente)
    uso_final    = info_espacio.get('usado_mb', 0)
    porcentaje   = info_espacio.get('porcentaje_uso', 0)

    registro = {
        "id_docente":    id_docente,
        "nombre_archivo": nombre_archivo,
        "url_descarga":  download_url,
        "tipo_formato":  formato,
        "tema_especifico": tema,
        "categoria_ia":  categoria,
        "uso_mb":        uso_final,
    }
    supabase.table("archivos_generados").insert(registro).execute()

    return {
        "status":       "success",
        "download_url": download_url,
        "nombre":       nombre_archivo,
        "uso_mb":       uso_final,
        "alerta":       "crítico" if porcentaje > 90 else "ok",
    }