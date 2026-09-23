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


def _es_dia_habil(fecha: date, feriados: list) -> bool:
    """Lunes a viernes y fuera de los rangos de feriados configurados."""
    return fecha.weekday() < 5 and not _es_feriado(fecha.isoformat(), feriados)


def _ajustar_dia_habil(fecha: date, feriados: list, direccion: int = 1, dias_max: int = 60) -> date:
    """
    Normaliza una fecha que cayó en fin de semana o feriado.

    Para desplazamientos hacia adelante se busca el siguiente día hábil; para
    desplazamientos hacia atrás, el día hábil anterior. Esto evita que una
    cascada del cronograma termine en sábados o domingos.
    """
    direccion = 1 if direccion >= 0 else -1
    actual = fecha
    for _ in range(dias_max):
        if _es_dia_habil(actual, feriados):
            return actual
        actual += timedelta(days=direccion)
    raise ValueError("No se encontró un día hábil dentro del límite de búsqueda")


def _desplazar_a_dia_habil(fecha: date, delta_dias: int, feriados: list) -> date:
    """Aplica el delta calendario y corrige fines de semana/feriados."""
    if delta_dias == 0:
        return _ajustar_dia_habil(fecha, feriados, direccion=1)
    fecha_calculada = fecha + timedelta(days=delta_dias)
    return _ajustar_dia_habil(
        fecha_calculada,
        feriados,
        direccion=1 if delta_dias > 0 else -1,
    )


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
