# backend/app/api/router_alumnos.py
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from app.core.database import supabase
from app.services.email_service import enviar_email
from typing import List, Optional
from pydantic import BaseModel
import csv, io, json

router = APIRouter()


# ── Modelos ───────────────────────────────────────────────────────────────────

class AlumnoIn(BaseModel):
    id_docente: str
    nombre: str
    apellido: str | None = None
    email: str
    id_curso: str | None = None

class ColumnaIn(BaseModel):
    id_docente: str
    nombre: str
    tipo: str = "manual"
    orden: int = 0

class NotaIn(BaseModel):
    id_alumno: str
    id_columna: str
    id_docente: str
    valor: str  # string para soportar "8.5", "A", "-", etc.

class AsistenciaIn(BaseModel):
    id_alumno: str
    id_docente: str
    fecha: str   # "YYYY-MM-DD"
    estado: str  # "P" | "A" | "-"

class BulkAsistenciaIn(BaseModel):
    registros: List[AsistenciaIn]


# ── Alumnos ───────────────────────────────────────────────────────────────────

@router.get("/{id_docente}")
async def listar_alumnos(id_docente: str):
    res = supabase.table("alumnos").select("*").eq("id_docente", id_docente).order("apellido").execute()
    return res.data or []


@router.post("")
async def crear_alumno(alumno: AlumnoIn):
    res = supabase.table("alumnos").insert(alumno.dict()).execute()
    return res.data[0] if res.data else {}


@router.put("/{id_alumno}")
async def actualizar_alumno(id_alumno: str, alumno: AlumnoIn):
    res = supabase.table("alumnos").update(alumno.dict()).eq("id_alumno", id_alumno).execute()
    return res.data[0] if res.data else {}


@router.delete("/{id_alumno}")
async def eliminar_alumno(id_alumno: str):
    supabase.table("alumnos").delete().eq("id_alumno", id_alumno).execute()
    return {"status": "ok"}


@router.post("/importar-csv")
async def importar_csv(
    id_docente: str = Form(...),
    id_curso: str = Form(None),
    file: UploadFile = File(...),
):
    try:
        contenido = (await file.read()).decode("utf-8")
        reader = csv.DictReader(io.StringIO(contenido))
        creados, errores = 0, []
        for row in reader:
            try:
                supabase.table("alumnos").insert({
                    "id_docente": id_docente,
                    "id_curso":   id_curso,
                    "nombre":     row.get("nombre",   "").strip(),
                    "apellido":   row.get("apellido", "").strip(),
                    "email":      row.get("email",    "").strip(),
                }).execute()
                creados += 1
            except Exception as e:
                errores.append(f"{row.get('email')}: {str(e)}")
        return {"creados": creados, "errores": errores}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/enviar-material")
async def enviar_material_a_alumnos(
    id_archivo:   str = Form(...),
    id_docente:   str = Form(...),
    ids_alumnos:  str = Form(...),
    mensaje:      str = Form(""),
):
    ids     = json.loads(ids_alumnos)
    archivo = supabase.table("archivos_generados").select("*").eq("id_archivo", id_archivo).single().execute().data
    if not archivo:
        raise HTTPException(404, "Archivo no encontrado")

    alumnos = supabase.table("alumnos").select("nombre, email").in_("id_alumno", ids).execute().data or []
    if not alumnos:
        raise HTTPException(400, "Sin destinatarios")

    docente        = supabase.table("docentes").select("nombre").eq("id_docente", id_docente).single().execute().data
    nombre_docente = docente.get("nombre", "Tu docente") if docente else "Tu docente"

    cuerpo = f"""
    <div style="font-family:Arial;max-width:600px;margin:auto;padding:20px;background:#fff;">
        <h2 style="color:#f472b6;">📚 Nuevo material de tu profe</h2>
        <p>Hola, <b>{nombre_docente}</b> te compartió un material:</p>
        <p><b>📎 {archivo.get('nombre_archivo')}</b></p>
        {f"<p><i>{archivo.get('tema_especifico')}</i></p>" if archivo.get('tema_especifico') else ""}
        {f"<div style='background:#fef3c7;padding:12px;border-radius:8px;'><b>Mensaje:</b><br>{mensaje}</div>" if mensaje else ""}
        <p style="margin-top:20px;">
            <a href="{archivo.get('url_descarga')}" style="background:#f472b6;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;">⬇ Descargar material</a>
        </p>
        <p style="font-size:12px;color:#999;margin-top:30px;">Enviado a través de Kōkua</p>
    </div>
    """
    enviados, errores = 0, []
    for alumno in alumnos:
        try:
            enviar_email(
                destinatarios=[alumno["email"]],
                asunto=f"📚 {nombre_docente} te compartió un material - Kōkua",
                cuerpo_html=cuerpo,
                archivo_url=archivo.get("url_descarga"),
                nombre_archivo=archivo.get("nombre_archivo"),
            )
            enviados += 1
        except Exception as e:
            errores.append(f"{alumno['email']}: {str(e)}")
    return {"enviados": enviados, "errores": errores}


# ── Calificaciones ────────────────────────────────────────────────────────────

@router.get("/calificaciones/columnas/{id_docente}")
async def listar_columnas(id_docente: str):
    """Devuelve las columnas de calificaciones del docente ordenadas."""
    res = (
        supabase.table("calificaciones_columnas")
        .select("*")
        .eq("id_docente", id_docente)
        .order("orden", desc=False)
        .execute()
    )
    return res.data or []


@router.post("/calificaciones/columnas")
async def agregar_columna(col: ColumnaIn):
    """Agrega una columna nueva (Examen 1, TP, etc.)."""
    # Calcular el orden: max actual + 1
    existing = (
        supabase.table("calificaciones_columnas")
        .select("orden")
        .eq("id_docente", col.id_docente)
        .order("orden", desc=True)
        .limit(1)
        .execute()
        .data or []
    )
    nuevo_orden = (existing[0]["orden"] + 1) if existing else 0
    res = supabase.table("calificaciones_columnas").insert({
        "id_docente": col.id_docente,
        "nombre":     col.nombre,
        "tipo":       col.tipo,
        "orden":      nuevo_orden,
    }).execute()
    return res.data[0] if res.data else {}


@router.delete("/calificaciones/columnas/{id_columna}")
async def eliminar_columna(id_columna: str):
    """Elimina una columna y en cascada sus notas."""
    supabase.table("calificaciones_columnas").delete().eq("id", id_columna).execute()
    return {"status": "ok"}


@router.get("/calificaciones/notas/{id_docente}")
async def listar_notas(id_docente: str):
    """
    Devuelve todas las notas del docente.
    El frontend las agrupa por alumno + columna.
    """
    res = (
        supabase.table("calificaciones")
        .select("id, id_alumno, id_columna, valor")
        .eq("id_docente", id_docente)
        .execute()
    )
    return res.data or []


@router.put("/calificaciones/nota")
async def guardar_nota(nota: NotaIn):
    """
    Upsert de una nota: si existe la actualiza, si no la crea.
    Usa la restricción UNIQUE(id_alumno, id_columna).
    """
    existing = (
        supabase.table("calificaciones")
        .select("id")
        .eq("id_alumno",  nota.id_alumno)
        .eq("id_columna", nota.id_columna)
        .execute()
        .data or []
    )
    if existing:
        supabase.table("calificaciones").update({
            "valor": nota.valor,
        }).eq("id", existing[0]["id"]).execute()
    else:
        supabase.table("calificaciones").insert({
            "id_alumno":  nota.id_alumno,
            "id_columna": nota.id_columna,
            "id_docente": nota.id_docente,
            "valor":      nota.valor,
        }).execute()
    return {"status": "ok"}


# ── Asistencia ────────────────────────────────────────────────────────────────

@router.get("/asistencia/{id_docente}")
async def listar_asistencia(id_docente: str):
    """Devuelve todos los registros de asistencia del docente."""
    res = (
        supabase.table("asistencia")
        .select("id, id_alumno, fecha, estado")
        .eq("id_docente", id_docente)
        .order("fecha", desc=False)
        .execute()
    )
    return res.data or []


@router.put("/asistencia/registro")
async def guardar_asistencia(reg: AsistenciaIn):
    """Upsert de un registro de asistencia (un alumno, una fecha)."""
    existing = (
        supabase.table("asistencia")
        .select("id")
        .eq("id_alumno", reg.id_alumno)
        .eq("fecha",     reg.fecha)
        .execute()
        .data or []
    )
    if existing:
        supabase.table("asistencia").update({
            "estado": reg.estado,
        }).eq("id", existing[0]["id"]).execute()
    else:
        supabase.table("asistencia").insert({
            "id_alumno":  reg.id_alumno,
            "id_docente": reg.id_docente,
            "fecha":      reg.fecha,
            "estado":     reg.estado,
        }).execute()
    return {"status": "ok"}


@router.post("/asistencia/fecha")
async def agregar_fecha_asistencia(id_docente: str = Form(...), fecha: str = Form(...)):
    """
    Agrega una nueva columna de fecha a la asistencia:
    inicializa todos los alumnos del docente con estado '-'.
    """
    alumnos = (
        supabase.table("alumnos")
        .select("id_alumno")
        .eq("id_docente", id_docente)
        .execute()
        .data or []
    )
    creados = 0
    for a in alumnos:
        existing = (
            supabase.table("asistencia")
            .select("id")
            .eq("id_alumno", a["id_alumno"])
            .eq("fecha", fecha)
            .execute()
            .data or []
        )
        if not existing:
            supabase.table("asistencia").insert({
                "id_alumno":  a["id_alumno"],
                "id_docente": id_docente,
                "fecha":      fecha,
                "estado":     "-",
            }).execute()
            creados += 1
    return {"status": "ok", "creados": creados, "fecha": fecha}


@router.delete("/asistencia/fecha/{id_docente}/{fecha}")
async def eliminar_fecha_asistencia(id_docente: str, fecha: str):
    """Elimina todos los registros de asistencia de una fecha para el docente."""
    supabase.table("asistencia").delete().eq("id_docente", id_docente).eq("fecha", fecha).execute()
    return {"status": "ok"}