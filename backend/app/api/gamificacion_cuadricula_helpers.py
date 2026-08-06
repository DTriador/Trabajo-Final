# backend/app/api/gamificacion_cuadricula_helpers.py
"""Utilidades compartidas por los generadores de actividades de gamificación
(crucigrama, unir con flechas, sopa de letras)."""
import re
from typing import Optional

from app.services.rag_orchestrator import RAGOrchestrator
from app.core.database import supabase


def _normalizar(p: str) -> str:
    p = (p or "").upper().strip()
    repl = {"Á": "A", "É": "E", "Í": "I", "Ó": "O", "Ú": "U", "Ü": "U", "Ñ": "N"}
    for k, v in repl.items():
        p = p.replace(k, v)
    return re.sub(r"[^A-Z]", "", p)


def _wrap_text(text, ancho):
    palabras = (text or "").split()
    lineas, actual = [], ""
    for p in palabras:
        if len(actual) + len(p) + 1 <= ancho:
            actual = (actual + " " + p).strip()
        else:
            lineas.append(actual)
            actual = p
    if actual:
        lineas.append(actual)
    return lineas


def _datos_escuela_materia(id_escuela: Optional[str], id_curso: Optional[str]):
    """Devuelve (nombre_escuela, nombre_materia, division, contenido_minimo, bibliografia)."""
    nombre_escuela = "Institución Educativa"
    nombre_materia = "Materia General"
    division = "-"
    contenido_minimo = ""
    bibliografia = []

    if id_escuela:
        try:
            res = supabase.table("escuelas").select("nombre_escuela").eq("id_escuela", id_escuela).single().execute()
            nombre_escuela = (res.data or {}).get("nombre_escuela", nombre_escuela)
        except Exception as e:
            print(f"⚠️ No pude obtener escuela: {e}")

    if id_curso:
        try:
            res = supabase.table("cursos").select(
                "nombre_materia,division,contenido_minimo,bibliografia"
            ).eq("id_curso", id_curso).single().execute()
            if res.data:
                nombre_materia = res.data.get("nombre_materia", nombre_materia)
                division = res.data.get("division", division)
                contenido_minimo = res.data.get("contenido_minimo", "") or ""
                bibliografia = res.data.get("bibliografia", []) or []
        except Exception as e:
            print(f"⚠️ No pude obtener curso: {e}")

    return nombre_escuela, nombre_materia, division, contenido_minimo, bibliografia


def _contexto_biblio(contenido_minimo: str, bibliografia: list) -> str:
    """Arma el texto de contexto cuando no hay PDF."""
    partes = []
    if contenido_minimo:
        partes.append(f"Contenido mínimo de la materia:\n{contenido_minimo}")
    if bibliografia:
        items = [b if isinstance(b, str) else str(b) for b in bibliografia]
        partes.append("Bibliografía:\n" + "\n".join(f"- {i}" for i in items))
    return "\n\n".join(partes) if partes else "Sin contenido específico. Generá basándote en el tema indicado."


async def _generar_json_ia(
    file,
    prompt_personalizado: str,
    system_prompt: str,
    id_docente: str,
    contenido_minimo: str,
    bibliografia: list,
):
    """
    Punto único que decide si generar el JSON a partir de un PDF subido
    o a partir del contenido mínimo / bibliografía del curso.

    Reproduce exactamente el mismo comportamiento que antes estaba
    duplicado en cada uno de los tres endpoints (crucigrama, unir_flechas,
    sopa_letras): si hay `file`, se usa RAG sobre el archivo; si no, se
    arma el contexto con `_contexto_biblio` y se usa el contexto del curso.
    """
    if file is not None:
        pdf_content = await file.read()
        return await RAGOrchestrator.get_context_from_file_and_generate(
            pdf_content, prompt_personalizado, system_prompt,
            id_docente=id_docente,
        )

    ctx = _contexto_biblio(contenido_minimo, bibliografia)
    return await RAGOrchestrator.get_context_and_generate(
        f"{prompt_personalizado}\n\n{ctx}", system_prompt,
        id_docente=id_docente,
    )
