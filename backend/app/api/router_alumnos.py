# backend/app/api/router_alumnos.py
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from app.core.database import supabase
from app.services.email_service import enviar_email
from typing import List, Optional
from pydantic import BaseModel
import csv, io, json
import re

router = APIRouter()


# ── Modelos ───────────────────────────────────────────────────────────────────

class AlumnoIn(BaseModel):
    id_docente: str
    nombre: str
    apellido: str | None = None
    email: str
    id_curso: str | None = None
    id_escuela: str | None = None

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

    @classmethod
    def validate_estado(cls, value):
        if value not in {"P", "A", "-"}:
            raise ValueError("El estado debe ser P, A o -")
        return value

class BulkAsistenciaIn(BaseModel):
    registros: List[AsistenciaIn]


def _validar_asignacion_alumno(id_docente: str, id_escuela: Optional[str], id_curso: Optional[str]):
    """Valida que el curso pertenezca a la escuela elegida por este docente."""
    escuela_id = (id_escuela or "").strip() or None
    curso_id = (id_curso or "").strip() or None

    if curso_id:
        cursos = (
            supabase.table("cursos")
            .select("id_curso, id_escuela")
            .eq("id_curso", curso_id)
            .limit(1)
            .execute()
            .data or []
        )
        if not cursos:
            raise HTTPException(status_code=400, detail="La asignatura seleccionada no existe.")

        escuela_del_curso = cursos[0].get("id_escuela")
        if escuela_id and escuela_del_curso != escuela_id:
            raise HTTPException(
                status_code=400,
                detail="La asignatura seleccionada no pertenece a la institución indicada.",
            )
        escuela_id = escuela_del_curso

    if escuela_id:
        escuelas = (
            supabase.table("escuelas")
            .select("id_escuela")
            .eq("id_escuela", escuela_id)
            .eq("id_docente", id_docente)
            .limit(1)
            .execute()
            .data or []
        )
        if not escuelas:
            raise HTTPException(
                status_code=400,
                detail="La institución seleccionada no pertenece a este docente.",
            )

    return escuela_id, curso_id


def _alumnos_del_docente(id_docente: str):
    """Devuelve todos los alumnos del docente (id, email, curso y escuela), paginando de a 1000."""
    filas, desde = [], 0
    while True:
        lote = (
            supabase.table("alumnos")
            .select("id_alumno, email, id_curso, id_escuela")
            .eq("id_docente", id_docente)
            .range(desde, desde + 999)
            .execute()
            .data or []
        )
        filas.extend(lote)
        if len(lote) < 1000:
            break
        desde += 1000
    return filas


# ── Alumnos ───────────────────────────────────────────────────────────────────

@router.get("/{id_docente}")
async def listar_alumnos(id_docente: str):
    res = supabase.table("alumnos").select("*").eq("id_docente", id_docente).order("apellido").execute()
    return res.data or []


@router.post("")
async def crear_alumno(alumno: AlumnoIn):
    datos = alumno.model_dump()
    datos["id_escuela"], datos["id_curso"] = _validar_asignacion_alumno(
        alumno.id_docente, alumno.id_escuela, alumno.id_curso
    )
    res = supabase.table("alumnos").insert(datos).execute()
    return res.data[0] if res.data else {}


@router.put("/{id_alumno}")
async def actualizar_alumno(id_alumno: str, alumno: AlumnoIn):
    datos = alumno.model_dump()
    datos["id_escuela"], datos["id_curso"] = _validar_asignacion_alumno(
        alumno.id_docente, alumno.id_escuela, alumno.id_curso
    )
    res = (
        supabase.table("alumnos")
        .update(datos)
        .eq("id_alumno", id_alumno)
        .eq("id_docente", alumno.id_docente)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Alumno no encontrado para este docente.")
    return res.data[0] if res.data else {}


@router.delete("/{id_alumno}")
async def eliminar_alumno(id_alumno: str):
    supabase.table("alumnos").delete().eq("id_alumno", id_alumno).execute()
    return {"status": "ok"}


@router.post("/importar-csv")
async def importar_csv(
    id_docente: str = Form(...),
    id_curso: str = Form(None),
    id_escuela: str = Form(None),
    file: UploadFile = File(...),
):
    try:
        escuela_id, curso_id = _validar_asignacion_alumno(
            id_docente, id_escuela, id_curso
        )
        contenido = (await file.read()).decode("utf-8-sig")
        muestra = contenido[:4096]
        try:
            dialecto = csv.Sniffer().sniff(muestra, delimiters=",;\t")
        except csv.Error:
            dialecto = csv.excel
        reader = csv.DictReader(io.StringIO(contenido), dialect=dialecto)
        if not reader.fieldnames:
            raise HTTPException(status_code=400, detail="El CSV no tiene encabezados")

        def normalizar_encabezado(valor):
            return re.sub(r"[^a-z0-9]", "", (valor or "").strip().lower())

        encabezados = {
            normalizar_encabezado(nombre): nombre
            for nombre in reader.fieldnames
        }
        nombre_col = encabezados.get("nombre")
        apellido_col = encabezados.get("apellido")
        email_col = encabezados.get("email") or encabezados.get("correo")
        if not nombre_col or not email_col:
            raise HTTPException(
                status_code=400,
                detail="El CSV debe incluir las columnas nombre y email (o correo)",
            )

        # Alumnos que el docente ya tiene, agrupados por email, para no duplicarlos.
        por_email = {}
        for existente in _alumnos_del_docente(id_docente):
            clave = (existente.get("email") or "").strip().lower()
            por_email.setdefault(clave, []).append(existente)

        creados, asignados, ya_existian, errores = 0, 0, 0, []
        for numero_fila, row in enumerate(reader, start=2):
            try:
                nombre = (row.get(nombre_col) or "").strip()
                apellido = (row.get(apellido_col) or "").strip() if apellido_col else ""
                email = (row.get(email_col) or "").strip().lower()
                if not nombre or not email or "@" not in email:
                    errores.append(f"Fila {numero_fila}: nombre y email válidos son obligatorios")
                    continue

                previos = por_email.setdefault(email, [])

                # 1) Ya está cargado en este mismo curso: no se duplica.
                if any(p.get("id_curso") == curso_id for p in previos):
                    ya_existian += 1
                    continue

                # 2) Importación sin curso: si el alumno ya existe, no se vuelve a crear.
                if curso_id is None and previos:
                    ya_existian += 1
                    continue

                # 3) Existe pero sin curso asignado: se le asigna el curso elegido.
                sin_curso = next((p for p in previos if not p.get("id_curso")), None)
                if sin_curso is not None:
                    (
                        supabase.table("alumnos")
                        .update({"id_curso": curso_id, "id_escuela": escuela_id})
                        .eq("id_alumno", sin_curso["id_alumno"])
                        .eq("id_docente", id_docente)
                        .execute()
                    )
                    sin_curso["id_curso"] = curso_id
                    sin_curso["id_escuela"] = escuela_id
                    asignados += 1
                    continue

                # 4) Alumno nuevo, o ya cargado en otra asignatura: se crea un registro para este curso.
                res = supabase.table("alumnos").insert({
                    "id_docente": id_docente,
                    "id_curso":   curso_id,
                    "id_escuela": escuela_id,
                    "nombre":     nombre,
                    "apellido":   apellido,
                    "email":      email,
                }).execute()
                nuevo = (res.data or [{}])[0] if res is not None else {}
                previos.append({
                    "id_alumno": nuevo.get("id_alumno"),
                    "email": email,
                    "id_curso": curso_id,
                    "id_escuela": escuela_id,
                })
                creados += 1
            except Exception as e:
                errores.append(f"{row.get(email_col) or numero_fila}: {str(e)}")
        return {
            "creados": creados,
            "asignados": asignados,
            "ya_existian": ya_existian,
            "errores": errores,
        }
    except HTTPException:
        raise
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
    if not nota.valor.strip():
        if existing:
            supabase.table("calificaciones").delete().eq("id", existing[0]["id"]).execute()
        return {"status": "ok", "eliminada": bool(existing)}
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
    if reg.estado not in {"P", "A", "-"}:
        raise HTTPException(status_code=400, detail="El estado debe ser P, A o -")
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