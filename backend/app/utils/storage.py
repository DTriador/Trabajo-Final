# backend/app/utils/storage.py
"""
Utilidades centralizadas para sanitizar nombres de archivo antes de subir
a Supabase Storage. Supabase rechaza caracteres Unicode especiales en las claves.
"""
import re
import unicodedata


def sanitizar_clave_storage(nombre: str) -> str:
    """
    Convierte cualquier nombre de archivo en una clave válida para Supabase Storage.

    Ejemplos:
        "Guía_N°1 Física.docx"  →  "Guia_N_1_Fisica.docx"
        "Trabajo Práctico N°3"  →  "Trabajo_Practico_N_3"
    """
    if '.' in nombre:
        base, ext = nombre.rsplit('.', 1)
    else:
        base, ext = nombre, ''

    base = unicodedata.normalize('NFKD', base)
    base = base.encode('ascii', 'ignore').decode('ascii')
    base = re.sub(r'[^\w\-]', '_', base)
    base = re.sub(r'_+', '_', base).strip('_')

    if ext:
        ext = unicodedata.normalize('NFKD', ext).encode('ascii', 'ignore').decode('ascii')
        ext = re.sub(r'[^\w]', '', ext)
        return f"{base}.{ext}"
    return base


def construir_ruta_storage(id_docente: str, prefijo: str, nombre_archivo: str) -> str:
    """
    Construye la ruta completa sanitizada para Supabase Storage.

    Ejemplo:
        construir_ruta_storage("abc-123", "Guia", "N°1 Física.docx")
        → "abc-123/Guia_N_1_Fisica.docx"
    """
    nombre_limpio = sanitizar_clave_storage(f"{prefijo}_{nombre_archivo}")
    return f"{id_docente}/{nombre_limpio}"