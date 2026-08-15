# backend/app/api/router_calendario.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, time, timedelta, datetime
from app.core.database import supabase

router = APIRouter()

# ── Modelos ───────────────────────────────────────────────────────────────────

class EventoRecurrenteCreate(BaseModel):
    id_docente: str
    titulo: Optional[str] = None  # Opcional, solo si es necesario
    materia: Optional[str] = None
    id_escuela: Optional[str] = None
    nombre_escuela: Optional[str] = None
    hora_inicio: str        # "13:00"
    hora_fin: str           # "14:30"
    dias_semana: List[int]  # [1, 4] lunes y jueves
    fecha_inicio: str       # "2025-03-01"
    fecha_fin: Optional[str] = None
    color: Optional[str] = "#f472b6"
    descripcion: Optional[str] = None  # Breve descripción opcional
    recordatorio: Optional[str] = None  # Recordatorio programado opcional

class ExcepcionCreate(BaseModel):
    id_evento: str
    fecha_original: str
    fecha_nueva: Optional[str] = None
    hora_inicio: Optional[str] = None
    hora_fin: Optional[str] = None
    motivo: Optional[str] = None

class FeriadoCreate(BaseModel):
    id_docente: Optional[str] = None
    nombre: str
    fecha_inicio: str
    fecha_fin: str
    tipo: str = "feriado"   # 'feriado' | 'vacaciones' | 'otro'

# ── Helpers ───────────────────────────────────────────────────────────────────

def _calcular_horario(fecha_programada: str, duracion_str: str):
    """
    A partir de 'fecha_programada' (que trae hora embebida, ej. '2026-03-11T14:00:00')
    y la duración de la clase en minutos (ej. '45'), calcula hora_inicio y hora_fin
    como strings 'HH:MM'. Si no hay hora o la duración no es un número, devuelve ('', '').
    """
    try:
        dt = datetime.fromisoformat((fecha_programada or "")[:19])
        try:
            minutos = int(duracion_str)
        except (TypeError, ValueError):
            minutos = 60  # fallback razonable si no hay duración cargada
        hora_inicio = dt.strftime("%H:%M")
        hora_fin    = (dt + timedelta(minutes=minutos)).strftime("%H:%M")
        return hora_inicio, hora_fin
    except Exception:
        return "", ""

# ── Eventos recurrentes ───────────────────────────────────────────────────────

@router.post("/eventos")
async def crear_evento(evento: EventoRecurrenteCreate):
    try:
        result = supabase.table("eventos_recurrentes").insert({
            "id_docente":     evento.id_docente,
            "titulo":         evento.titulo,
            "materia":        evento.materia,
            "id_escuela":     evento.id_escuela,
            "nombre_escuela": evento.nombre_escuela,
            "hora_inicio":    evento.hora_inicio,
            "hora_fin":       evento.hora_fin,
            "dias_semana":    evento.dias_semana,
            "fecha_inicio":   evento.fecha_inicio,
            "fecha_fin":      evento.fecha_fin,
            "color":          evento.color,
            "descripcion":    evento.descripcion,
            "recordatorio":   evento.recordatorio,
            "activo":         True,
        }).execute()
        return {"status": "success", "evento": result.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/eventos/{id_docente}")
async def get_eventos(id_docente: str):
    try:
        result = supabase.table("eventos_recurrentes") \
            .select("*, excepciones_evento(*)") \
            .eq("id_docente", id_docente) \
            .eq("activo", True) \
            .execute()
        return {"status": "success", "eventos": result.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/eventos/{id_evento}")
async def actualizar_evento(id_evento: str, evento: EventoRecurrenteCreate):
    try:
        result = supabase.table("eventos_recurrentes").update({
            "titulo":         evento.titulo,
            "materia":        evento.materia,
            "id_escuela":     evento.id_escuela,
            "nombre_escuela": evento.nombre_escuela,
            "hora_inicio":    evento.hora_inicio,
            "hora_fin":       evento.hora_fin,
            "dias_semana":    evento.dias_semana,
            "fecha_inicio":   evento.fecha_inicio,
            "fecha_fin":      evento.fecha_fin,
            "color":          evento.color,
            "descripcion":    evento.descripcion,
            "recordatorio":   evento.recordatorio,
        }).eq("id_evento", id_evento).execute()
        return {"status": "success", "evento": result.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/eventos/{id_evento}")
async def eliminar_evento(id_evento: str):
    try:
        supabase.table("eventos_recurrentes") \
            .update({"activo": False}) \
            .eq("id_evento", id_evento).execute()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Excepciones (replanificación puntual) ────────────────────────────────────

@router.post("/excepciones")
async def crear_excepcion(exc: ExcepcionCreate):
    try:
        result = supabase.table("excepciones_evento").insert({
            "id_evento":      exc.id_evento,
            "fecha_original": exc.fecha_original,
            "fecha_nueva":    exc.fecha_nueva,
            "hora_inicio":    exc.hora_inicio,
            "hora_fin":       exc.hora_fin,
            "motivo":         exc.motivo,
        }).execute()
        return {"status": "success", "excepcion": result.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Feriados ──────────────────────────────────────────────────────────────────

@router.post("/feriados")
async def crear_feriado(feriado: FeriadoCreate):
    try:
        result = supabase.table("feriados").insert({
            "id_docente":   feriado.id_docente,
            "nombre":       feriado.nombre,
            "fecha_inicio": feriado.fecha_inicio,
            "fecha_fin":    feriado.fecha_fin,
            "tipo":         feriado.tipo,
        }).execute()
        return {"status": "success", "feriado": result.data[0]}
    except Exception as e:
        print(f"❌ ERROR feriados insert: {repr(e)}")   # ← agregar esta línea
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/feriados/{id_docente}")
async def get_feriados(id_docente: str):
    """Devuelve feriados nacionales (id_docente null) + los del docente."""
    try:
        # Feriados nacionales
        nacionales = supabase.table("feriados") \
            .select("*").is_("id_docente", "null").execute()
        # Feriados/vacaciones del docente
        propios = supabase.table("feriados") \
            .select("*").eq("id_docente", id_docente).execute()
        todos = (nacionales.data or []) + (propios.data or [])
        return {"status": "success", "feriados": todos}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/feriados/{id_feriado}")
async def eliminar_feriado(id_feriado: str):
    try:
        supabase.table("feriados").delete().eq("id_feriado", id_feriado).execute()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Vista mensual completa ────────────────────────────────────────────────────

@router.get("/mes/{id_docente}/{anio}/{mes}")
async def get_mes_completo(id_docente: str, anio: int, mes: int):
    """
    Devuelve todos los eventos expandidos del mes:
    recurrentes + planificaciones + feriados + cronograma de clases
    (este último ya enriquecido con materia, escuela y horario calculado).
    """
    try:
        from calendar import monthrange
        _, dias_mes = monthrange(anio, mes)
        fecha_inicio = date(anio, mes, 1)
        fecha_fin    = date(anio, mes, dias_mes)
        fecha_fin_dt = f"{fecha_fin.isoformat()}T23:59:59"

        # 1) Eventos recurrentes del docente
        ev_result = supabase.table("eventos_recurrentes") \
            .select("*, excepciones_evento(*)") \
            .eq("id_docente", id_docente) \
            .eq("activo", True).execute()
        eventos = ev_result.data or []

        # 2) Expandir recurrencias en el mes
        dias_expandidos = []
        for ev in eventos:
            excepciones = {
                e["fecha_original"]: e
                for e in (ev.get("excepciones_evento") or [])
            }
            ev_inicio = date.fromisoformat(ev["fecha_inicio"])
            ev_fin    = date.fromisoformat(ev["fecha_fin"]) if ev.get("fecha_fin") else fecha_fin
            dias_semana = ev["dias_semana"]  # [1,4] = lunes, jueves

            cur = fecha_inicio
            while cur <= fecha_fin:
                iso = cur.isoformat()
                # isoweekday(): 1=lun ... 7=dom
                if cur.isoweekday() in dias_semana and ev_inicio <= cur <= ev_fin:
                    if iso in excepciones:
                        exc = excepciones[iso]
                        if exc["fecha_nueva"]:
                            # Movido a otra fecha — lo agregamos en esa fecha si es del mes
                            nueva = date.fromisoformat(exc["fecha_nueva"])
                            if fecha_inicio <= nueva <= fecha_fin:
                                dias_expandidos.append({
                                    "fecha": exc["fecha_nueva"],
                                    "titulo": ev["titulo"],
                                    "materia": ev["materia"],
                                    "nombre_escuela": ev["nombre_escuela"],
                                    "hora_inicio": exc.get("hora_inicio") or ev["hora_inicio"],
                                    "hora_fin":    exc.get("hora_fin")    or ev["hora_fin"],
                                    "color": ev["color"],
                                    "tipo": "evento",
                                    "id_evento": ev["id_evento"],
                                    "replanificado": True,
                                    "motivo": exc.get("motivo"),
                                })
                        # Si fecha_nueva es None = cancelado, no se agrega
                    else:
                        dias_expandidos.append({
                            "fecha": iso,
                            "titulo": ev["titulo"],
                            "materia": ev["materia"],
                            "nombre_escuela": ev["nombre_escuela"],
                            "hora_inicio": ev["hora_inicio"],
                            "hora_fin":    ev["hora_fin"],
                            "color": ev["color"],
                            "tipo": "evento",
                            "id_evento": ev["id_evento"],
                            "replanificado": False,
                        })
                cur += timedelta(days=1)

        # 3) Clases planificadas del mes
        plan_result = supabase.table("planificacion") \
            .select("id_planificacion, fecha, nombre_clase, tema, duracion, estado") \
            .eq("id_docente", id_docente) \
            .gte("fecha", fecha_inicio.isoformat()) \
            .lte("fecha", fecha_fin.isoformat()) \
            .execute()
        planificaciones = [
            {**p, "tipo": "planificacion", "color": "#818cf8"}
            for p in (plan_result.data or [])
        ]

        # 4) Feriados del mes
        fer_result = supabase.table("feriados") \
            .select("*") \
            .or_(f"id_docente.eq.{id_docente},id_docente.is.null") \
            .lte("fecha_inicio", fecha_fin.isoformat()) \
            .gte("fecha_fin",    fecha_inicio.isoformat()) \
            .execute()
        feriados = [
            {**f, "tipo": f["tipo"], "color": "#fb923c"}
            for f in (fer_result.data or [])
        ]

        # 5) Cronograma de clases del mes, enriquecido con materia/escuela/horario
        all_plans_res = supabase.table("planificacion") \
            .select("id_planificacion, nombre_clase, id_curso, id_escuela, duracion") \
            .eq("id_docente", id_docente) \
            .execute()
        all_plans = {
            p["id_planificacion"]: p
            for p in (all_plans_res.data or [])
        }

        # Traer materia (cursos) y nombre de escuela (escuelas) para las
        # planificaciones involucradas, para poder mostrarlas en el detalle
        # de cada clase sin tener que guardarlas duplicadas en cronograma_clases.
        ids_curso   = list({p["id_curso"]   for p in all_plans.values() if p.get("id_curso")})
        ids_escuela = list({p["id_escuela"] for p in all_plans.values() if p.get("id_escuela")})

        materia_por_curso = {}
        if ids_curso:
            cursos_res = supabase.table("cursos") \
                .select("id_curso, nombre_materia") \
                .in_("id_curso", ids_curso) \
                .execute()
            materia_por_curso = {
                c["id_curso"]: c.get("nombre_materia", "")
                for c in (cursos_res.data or [])
            }

        escuela_por_id = {}
        if ids_escuela:
            escuelas_res = supabase.table("escuelas") \
                .select("id_escuela, nombre_escuela") \
                .in_("id_escuela", ids_escuela) \
                .execute()
            escuela_por_id = {
                e["id_escuela"]: e.get("nombre_escuela", "")
                for e in (escuelas_res.data or [])
            }

        cronograma = []
        if all_plans:
            cron_res = supabase.table("cronograma_clases") \
                .select("*") \
                .in_("id_planificacion", list(all_plans.keys())) \
                .gte("fecha_programada", fecha_inicio.isoformat()) \
                .lte("fecha_programada", fecha_fin_dt) \
                .order("fecha_programada", desc=False) \
                .execute()

            for c in (cron_res.data or []):
                plan_info = all_plans.get(c["id_planificacion"], {})
                hora_inicio, hora_fin = _calcular_horario(
                    c.get("fecha_programada"), plan_info.get("duracion")
                )
                cronograma.append({
                    **c,
                    "nombre_plan":    plan_info.get("nombre_clase", ""),
                    "materia":        materia_por_curso.get(plan_info.get("id_curso"), ""),
                    "nombre_escuela": escuela_por_id.get(plan_info.get("id_escuela"), ""),
                    "hora_inicio":    hora_inicio,
                    "hora_fin":       hora_fin,
                    "color": (
                        "#f59e0b" if c.get("tipo") == "examen"
                        else "#22c55e" if c.get("tipo") == "recuperatorio"
                        else "#818cf8"
                    ),
                })

        return {
            "status":         "success",
            "eventos":        dias_expandidos,
            "planificaciones": planificaciones,
            "feriados":       feriados,
            "cronograma":     cronograma,
        }
    except Exception as e:
        print(f"DEBUG ERROR MES: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))