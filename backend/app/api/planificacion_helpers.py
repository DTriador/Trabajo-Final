# backend/app/api/planificacion_helpers.py
"""
Funciones auxiliares del módulo de Planificación: manejo de feriados,
búsqueda de planificación por id, y formateo de fechas para mostrar
en los documentos generados (Word/PDF).
Extraído sin cambios de lógica desde router_planificacion.py.
"""
from datetime import date, timedelta, datetime
from app.core.database import supabase


DIAS_ES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]


def _es_feriado(fecha_iso: str, feriados: list) -> bool:
    """Devuelve True si la fecha cae en algún feriado."""
    try:
        dt = date.fromisoformat(fecha_iso)
        for f in feriados:
            inicio = date.fromisoformat(f["fecha_inicio"][:10])
            fin    = date.fromisoformat(f["fecha_fin"][:10])
            if inicio <= dt <= fin:
                return True
    except Exception:
        pass
    return False


def _siguiente_habil(fecha_iso: str, feriados: list, dias_max: int = 60) -> str:
    """
    Dado un YYYY-MM-DD, avanza de a 1 día hasta encontrar
    una fecha que no sea feriado ni fin de semana (sáb/dom).
    Devuelve la fecha hábil como string.
    """
    dt = date.fromisoformat(fecha_iso)
    for _ in range(dias_max):
        dt += timedelta(days=1)
        iso = dt.isoformat()
        if dt.weekday() < 5 and not _es_feriado(iso, feriados):
            return iso
    return fecha_iso  # fallback: misma fecha si no encontró


def _obtener_planificacion_por_id(id_plan: str, client=None):
    """Busca la planificación por id_planificacion o por id, por compatibilidad con distintos esquemas."""
    db = client or supabase
    for column in ("id_planificacion", "id"):
        try:
            res = db.table("planificacion").select("*").eq(column, id_plan).single().execute()
            data = getattr(res, "data", None)
            if data:
                return data
        except Exception:
            continue
    return None


def _cargar_feriados(id_docente: str) -> list:
    """Carga feriados nacionales + propios del docente."""
    try:
        nacionales = supabase.table("feriados").select("*").is_("id_docente", "null").execute().data or []
        propios    = supabase.table("feriados").select("*").eq("id_docente", id_docente).execute().data or []
        return nacionales + propios
    except Exception:
        return []


def _formatear_fecha_clase(fecha_str: str) -> str:
    """
    Convierte '2026-03-11T14:00:00' → 'Miércoles 11/03 - 14hs'.
    Si no puede parsear, devuelve el string original recortado.
    """
    if not fecha_str:
        return "—"
    try:
        # Soporta con o sin hora
        dt = datetime.fromisoformat(fecha_str[:19])
        dia = DIAS_ES[dt.weekday()]
        return f"{dia} {dt.day:02d}/{dt.month:02d} - {dt.hour}hs"
    except Exception:
        return fecha_str[:10]  # fallback: solo la fecha
