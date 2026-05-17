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
from app.api.router_calendario              import router as calendario_router
from app.api                                import router_alumnos

# ── Scheduler ─────────────────────────────────────────────────────────────────
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
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
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


@app.on_event("startup")
def iniciar_scheduler():
    scheduler.add_job(revisar_recordatorios, "interval", minutes=1)
    scheduler.start()
    print("⏰ Scheduler de recordatorios iniciado")


@app.on_event("shutdown")
def parar_scheduler():
    scheduler.shutdown()