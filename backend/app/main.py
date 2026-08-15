# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
load_dotenv()

# ── Routers modulares ─────────────────────────────────────────────────────────
from app.api import (
    router_auth,
    router_bi,
    router_proyectos,
    router_external,
    router_generacion,
    router_multimedia,
    router_rag,
    router_ai,
    router_planning,
)
from app.api.router_gamificacion_cuadricula import router as gamificacion_cuadricula_router
from app.api.router_gamificacion_texto      import router as gamificacion_texto_router
from app.api.router_calendario              import router as calendario_router, _calcular_horario
from app.api                                import router_alumnos

# ── Scheduler ─────────────────────────────────────────────────────────────────
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from app.core.database import supabase
from app.services.email_service import enviar_email

# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Kōkua - Plataforma de Asistencia Docente con IA",
    description="Backend modular para la gestión y generación de materiales pedagógicos",
    version="1.0.0",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://kokua-dt.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.get("/")
@app.head("/")
async def health_check():
    return {"status": "ok", "service": "Kōkua Backend"}

# ── Rutas ─────────────────────────────────────────────────────────────────────

# Auth y perfil
app.include_router(router_auth.router,       prefix="/api/v1/auth",        tags=["Seguridad"])

# Documentos y RAG
app.include_router(router_rag.router,        prefix="/api/v1/documentos",  tags=["Gestión de Archivos"])

# Asistente IA (chatbot)
app.include_router(router_ai.router,         prefix="/api/v1/asistente",   tags=["Asistente IA"])

# Generación de materiales (planificación, apunte, preguntas, examen, presentación…)
# ⚠️  TODAS las herramientas de ToolForm apuntan a /api/v1/generar/*
app.include_router(router_generacion.router, prefix="/api/v1/generar",     tags=["Motores de Generación"])

# Multimedia y podcast
app.include_router(router_multimedia.router, prefix="/api/v1/multimedia",  tags=["Multimedia"])

# BI y estadísticas
app.include_router(router_bi.router,         prefix="/api/v1/stats",       tags=["Dashboard & BI"])

# Integraciones externas
app.include_router(router_external.router,   prefix="/api/v1/externo",     tags=["Interoperabilidad"])

# Gestión institucional (escuelas, cursos, archivos)
app.include_router(router_proyectos.router,  prefix="/api/v1/proyectos",   tags=["Gestión de Proyectos"])

# Gamificación — cuadrículas (crucigrama, sopa de letras, unir flechas)
# ⚠️  El frontend llama a /api/v1/generar/crucigrama, /sopa_letras, /unir_flechas
#     → registramos TAMBIÉN bajo /api/v1/generar para que coincidan
app.include_router(gamificacion_cuadricula_router, prefix="/api/v1/generar",     tags=["Gamificación - Cuadrículas"])
app.include_router(gamificacion_cuadricula_router, prefix="/api/v1/gamificacion", tags=["Gamificación - Cuadrículas (legacy)"])

# Gamificación — textos
app.include_router(gamificacion_texto_router, prefix="/api/v1/generar",          tags=["Gamificación - Textos"])
app.include_router(gamificacion_texto_router, prefix="/api/v1/gamificacion",      tags=["Gamificación - Textos (legacy)"])

# Calendario
app.include_router(calendario_router,        prefix="/api/v1/calendario",  tags=["Calendario"])

# Planificación académica
app.include_router(router_planning.router,   prefix="/api/v1/planning",    tags=["Planificación Académica"])

# Alumnos
app.include_router(router_alumnos.router,    prefix="/api/v1/alumnos",     tags=["Alumnos"])


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "status":  "Online",
        "service": "Kōkua Backend Engine",
        "version": "1.0.0",
        "docs":    "/docs",
    }


# ── Scheduler de recordatorios ────────────────────────────────────────────────
scheduler = BackgroundScheduler()

def revisar_recordatorios():
    """Corre cada minuto. Busca recordatorios pendientes y los envía."""
    try:
        ahora     = datetime.now().isoformat()
        pendientes = (
            supabase.table("recordatorios_clase")
            .select("*, planificacion(nombre_clase, fecha, tema, duracion), docentes(nombre, email)")
            .eq("enviado", False)
            .lte("fecha_envio", ahora)
            .execute().data or []
        )
        for r in pendientes:
            try:
                docente = r.get("docentes") or {}
                plan    = r.get("planificacion") or {}   # ← era "planificaciones" (plural), corregido
                if not docente.get("email"):
                    continue
                cuerpo = f"""
                <div style="font-family:Arial;max-width:600px;margin:auto;padding:20px;">
                    <h2 style="color:#f472b6;">📅 Recordatorio de clase</h2>
                    <p>Hola <b>{docente.get('nombre','Profe')}</b>, te recordamos:</p>
                    <div style="background:#fef3c7;padding:15px;border-radius:10px;">
                        <p><b>📚 Clase:</b> {plan.get('nombre_clase')}</p>
                        <p><b>📌 Tema:</b> {plan.get('tema')}</p>
                        <p><b>📅 Fecha:</b> {plan.get('fecha')}</p>
                        {f"<p><b>⏱ Duración:</b> {plan.get('duracion')}</p>" if plan.get('duracion') else ""}
                    </div>
                    <p style="font-size:12px;color:#999;margin-top:30px;">— Kōkua</p>
                </div>
                """
                enviar_email(
                    destinatarios=[docente["email"]],
                    asunto=f"📅 Recordatorio: {plan.get('nombre_clase')}",
                    cuerpo_html=cuerpo,
                )
                supabase.table("recordatorios_clase") \
                    .update({"enviado": True}) \
                    .eq("id_recordatorio", r["id_recordatorio"]) \
                    .execute()
            except Exception as e:
                print(f"❌ Error enviando recordatorio {r.get('id_recordatorio')}: {e}")
    except Exception as e:
        print(f"❌ Error en scheduler: {e}")


# ── Scheduler de resumen diario ("clases de mañana") ──────────────────────────
# Corre una vez por día a las 18:00 (hora Argentina). Busca TODAS las clases
# programadas para el día siguiente (cronograma_clases, sea tipo 'clase',
# 'examen' o 'recuperatorio'), las agrupa por docente, y le manda a cada
# docente UN solo mail resumen con todas sus clases de mañana.

DIAS_ES_RESUMEN  = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
MESES_ES_RESUMEN = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
                     "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

def _formatear_fecha_larga(f):
    return f"{DIAS_ES_RESUMEN[f.weekday()]} {f.day} de {MESES_ES_RESUMEN[f.month - 1]}"

def _etiqueta_tipo_clase(tipo, numero):
    base = "Examen" if tipo == "examen" else "Recuperatorio" if tipo == "recuperatorio" else "Clase"
    return f"{base} {numero}".strip()

def enviar_resumen_clases_manana():
    """Corre una vez por día. Manda un mail resumen a cada docente con sus clases de mañana."""
    try:
        manana = (datetime.now(ZoneInfo("America/Argentina/Buenos_Aires")) + timedelta(days=1)).date()
        desde  = f"{manana.isoformat()}T00:00:00"
        hasta  = f"{manana.isoformat()}T23:59:59"

        cron_res = (
            supabase.table("cronograma_clases")
            .select("*, planificacion(nombre_clase, tema, duracion, id_curso, id_escuela, id_docente)")
            .gte("fecha_programada", desde)
            .lte("fecha_programada", hasta)
            .order("fecha_programada", desc=False)
            .execute()
        )
        clases = cron_res.data or []
        if not clases:
            print("📭 Resumen diario: no hay clases programadas para mañana.")
            return

        # Agrupar por docente (vía planificacion.id_docente)
        por_docente = {}
        for c in clases:
            plan = c.get("planificacion") or {}
            id_docente = plan.get("id_docente")
            if not id_docente:
                continue
            por_docente.setdefault(id_docente, []).append(c)

        if not por_docente:
            return

        # Traer email/nombre de los docentes involucrados
        ids_docentes = list(por_docente.keys())
        docentes_res = (
            supabase.table("docentes")
            .select("id_docente, nombre, email")
            .in_("id_docente", ids_docentes)
            .execute()
        )
        docentes_map = {d["id_docente"]: d for d in (docentes_res.data or [])}

        # Materia/escuela para enriquecer cada clase (mismo patrón que /calendario/mes)
        ids_curso   = list({c["planificacion"]["id_curso"]   for c in clases if c.get("planificacion", {}).get("id_curso")})
        ids_escuela = list({c["planificacion"]["id_escuela"] for c in clases if c.get("planificacion", {}).get("id_escuela")})

        materia_por_curso = {}
        if ids_curso:
            cursos_res = supabase.table("cursos").select("id_curso, nombre_materia").in_("id_curso", ids_curso).execute()
            materia_por_curso = {c["id_curso"]: c.get("nombre_materia", "") for c in (cursos_res.data or [])}

        escuela_por_id = {}
        if ids_escuela:
            escuelas_res = supabase.table("escuelas").select("id_escuela, nombre_escuela").in_("id_escuela", ids_escuela).execute()
            escuela_por_id = {e["id_escuela"]: e.get("nombre_escuela", "") for e in (escuelas_res.data or [])}

        fecha_legible = _formatear_fecha_larga(manana)

        for id_docente, clases_docente in por_docente.items():
            docente = docentes_map.get(id_docente)
            if not docente or not docente.get("email"):
                continue

            clases_docente.sort(key=lambda c: c.get("fecha_programada") or "")

            filas_html = ""
            for c in clases_docente:
                plan = c.get("planificacion") or {}
                hora_inicio, hora_fin = _calcular_horario(c.get("fecha_programada"), plan.get("duracion"))
                materia   = materia_por_curso.get(plan.get("id_curso"), "")
                escuela   = escuela_por_id.get(plan.get("id_escuela"), "")
                etiqueta  = _etiqueta_tipo_clase(c.get("tipo"), c.get("numero"))
                tema      = c.get("tema_clase") or ""

                linea_horario = f" · {hora_inicio} a {hora_fin} hs" if hora_inicio and hora_fin else ""
                linea_materia = f" de {materia}" if materia else ""

                filas_html += f"""
                <div style="background:#fef3c7;padding:12px 15px;border-radius:10px;margin-bottom:10px;">
                    <p style="margin:0;font-weight:bold;">{etiqueta}{linea_materia}{linea_horario}</p>
                    {f'<p style="margin:4px 0 0;color:#555;">🏫 {escuela}</p>' if escuela else ""}
                    {f'<p style="margin:4px 0 0;color:#555;">📌 {tema}</p>' if tema else ""}
                </div>
                """

            cuerpo = f"""
            <div style="font-family:Arial;max-width:600px;margin:auto;padding:20px;">
                <h2 style="color:#f472b6;">📅 Tus clases de mañana</h2>
                <p>Hola <b>{docente.get('nombre', 'Profe')}</b>, este es tu resumen para <b>{fecha_legible}</b>:</p>
                {filas_html}
                <p style="font-size:12px;color:#999;margin-top:30px;">— Kōkua</p>
            </div>
            """

            try:
                enviar_email(
                    destinatarios=[docente["email"]],
                    asunto=f"📅 Tus clases de mañana ({fecha_legible})",
                    cuerpo_html=cuerpo,
                )
            except Exception as e:
                print(f"❌ Error enviando resumen diario a {docente.get('email')}: {e}")

    except Exception as e:
        print(f"❌ Error en scheduler de resumen diario: {e}")


@app.on_event("startup")
def iniciar_scheduler():
    scheduler.add_job(revisar_recordatorios, "interval", minutes=1)
    scheduler.add_job(
        enviar_resumen_clases_manana,
        "cron",
        hour=18,
        minute=0,
        timezone=ZoneInfo("America/Argentina/Buenos_Aires"),
    )
    scheduler.start()
    print("⏰ Scheduler de recordatorios iniciado")
    print("⏰ Scheduler de resumen diario (18:00 ART) iniciado")


@app.on_event("shutdown")
def parar_scheduler():
    scheduler.shutdown()