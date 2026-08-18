# backend/app/api/router_planificacion.py
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional, List
from app.core.database import supabase
from app.services.rag_orchestrator import RAGOrchestrator
from app.services.ai_service import SYSTEM_PROMPT_XLSX
from app.utils.engines import FileEngine
from app.api.generacion_utils import process_and_upload
from app.services.email_service import enviar_email
from datetime import datetime, timedelta, date
import io
from fastapi.responses import StreamingResponse

# ── Modelos, helpers y generadores extraídos a sus propios módulos ─────────
from app.api.planificacion_schemas import (
    ClaseWizard, ExamenWizard, FeriadoWizard, PlanificacionWizardPayload,
    ReplanificarClaseRequest, EstadoClaseRequest, SuspenderClaseRequest,
    UnidadInput, DistribuirPayload, ClaseDistribuida,
)
from app.api.planificacion_helpers import (
    DIAS_ES, _es_feriado, _siguiente_habil,
    _obtener_planificacion_por_id as _obtener_planificacion_por_id_helper,
    _cargar_feriados, _formatear_fecha_clase,
)
from app.api.planificacion_generadores import (
    _generar_docx_planificacion, _generar_pdf_planificacion,
)


router = APIRouter()


def _obtener_planificacion_por_id(id_plan: str):
    """Compatibilidad con el nombre histórico del router y con monkeypatching en tests."""
    return _obtener_planificacion_por_id_helper(id_plan, client=supabase)


# ── Endpoints ─────────────────────────────────────────────────────────────────

# IMPORTANTE: /planificacion/wizard debe ir ANTES de /planificacion/{id}/...
# para que FastAPI no confunda "wizard" con un UUID.

@router.post("/planificacion/wizard")
async def crear_planificacion_wizard(payload: PlanificacionWizardPayload):
    """
    Recibe la planificación completa desde el wizard.
    Persiste en `planificacion` + `cronograma_clases` + `examenes_planificacion`
    y guarda automáticamente el .docx en Mis Materiales (archivos_generados),
    igual que hacen crucigrama/sopa de letras/unir con flechas.
    """
    try:
        curso_res = (
            supabase.table("cursos")
            .select("id_escuela, nombre_materia")
            .eq("id_curso", payload.id_curso)
            .single()
            .execute()
        )
        if not curso_res.data:
            raise HTTPException(status_code=404, detail="Curso no encontrado")

        id_escuela = curso_res.data["id_escuela"]
        fecha_principal = payload.clases[0].fecha_programada if payload.clases else None

        plan_res = supabase.table("planificacion").insert({
            "id_docente":       payload.id_docente,
            "id_escuela":       id_escuela,
            "id_curso":         payload.id_curso,
            "titulo_plan":      payload.nombre_clase or payload.tema,   # ← esto faltaba
            "nombre_clase":     payload.nombre_clase,
            "fecha":            fecha_principal,
            "duracion":         payload.duracion or "",
            "tema":             payload.tema,
            "contenido_minimo": payload.contenido_minimo or "",
            "estado":           "activa",
        }).execute()

        if not plan_res.data:
            raise HTTPException(status_code=500, detail="No se pudo crear la planificación")

        plan_creada = plan_res.data[0]
        id_plan = plan_creada.get("id_planificacion") or plan_creada.get("id")

        # Clases individuales en cronograma_clases
        if payload.clases:
            supabase.table("cronograma_clases").insert([
                {
                    "id_planificacion": id_plan,
                    "numero":           c.numero,
                    "fecha_programada": c.fecha_programada,
                    "tema_clase":       c.tema_clase,
                    "tipo":             c.tipo,
                    "estado_clase":     c.estado_clase,
                }
                for c in payload.clases
            ]).execute()

        # Exámenes
        if payload.examenes:
            try:
                supabase.table("examenes_planificacion").insert([
                    {
                        "id_planificacion":    id_plan,
                        "numero":              ex.numero,
                        "clases_examen":       ex.clases_examen,
                        "tiene_recuperatorio": ex.tiene_recuperatorio,
                        "clases_recup_desde":  ex.clases_recup_desde,
                        "clases_recup_hasta":  ex.clases_recup_hasta,
                    }
                    for ex in payload.examenes
                ]).execute()
            except Exception as e:
                print(f"⚠️ examenes_planificacion: {e}")

        # ── Guardar el .docx en Mis Materiales ──────────────────────────────
        # No debe bloquear la creación de la planificación si falla: se avisa
        # con "material_guardado": False y un detalle, pero la planificación
        # ya quedó creada y visible en el Calendario.
        material_guardado = False
        material_error = None
        try:
            clases_guardadas_res = (
                supabase.table("cronograma_clases")
                .select("*")
                .eq("id_planificacion", id_plan)
                .order("numero", desc=False)
                .execute()
            )
            clases_guardadas = clases_guardadas_res.data or []

            docx_bytes = _generar_docx_planificacion(plan_creada, clases_guardadas)
            nombre_base = f"Planificacion_{payload.nombre_clase or payload.tema}"

            await process_and_upload(
                docx_bytes, nombre_base, payload.tema, "docx", payload.id_docente, "PLANIFICACION",
            )
            material_guardado = True
        except Exception as e:
            material_error = str(e)
            print(f"⚠️ No se pudo guardar la planificación en Mis Materiales: {e}")

        return {
            "ok": True,
            "id_planificacion": id_plan,
            "clases_creadas": len(payload.clases),
            "material_guardado": material_guardado,
            "material_error": material_error,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ ERROR wizard: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/planificacion/cronograma/{id_planificacion}")
async def get_cronograma(id_planificacion: str):
    """
    Devuelve todas las clases de una planificación ordenadas por número.
    Usado por CalendarioDocente (FullCalendar).
    """
    try:
        res = (
            supabase.table("cronograma_clases")
            .select("*")
            .eq("id_planificacion", id_planificacion)
            .order("numero", desc=False)
            .execute()
        )
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/planificacion/clase/{id_clase}/replanificar")
async def replanificar_clase(id_clase: str, body: ReplanificarClaseRequest):
    """
    Replanifica UNA clase individual.

    Si desplazar_siguientes=True (default):
      - Calcula el delta de días entre la fecha original y la nueva.
      - Aplica ese delta a TODAS las clases con número mayor, respetando feriados.
      - Los exámenes y recuperatorios también se desplazan porque son filas
        en cronograma_clases con tipo='examen'/'recuperatorio'.

    Si desplazar_siguientes=False:
      - Solo mueve la clase indicada.
    """
    try:
        # 1. Obtener la clase a replanificar
        clase_res = (
            supabase.table("cronograma_clases")
            .select("*")
            .eq("id_clase", id_clase)
            .single()
            .execute()
        )
        if not clase_res.data:
            raise HTTPException(status_code=404, detail="Clase no encontrada")

        clase = clase_res.data
        id_planificacion = clase["id_planificacion"]
        numero_clase     = clase["numero"]
        fecha_original   = clase["fecha_programada"]

        # 2. Calcular delta en días
        fecha_orig_dt  = date.fromisoformat(fecha_original[:10])
        fecha_nueva_dt = date.fromisoformat(body.nueva_fecha[:10])
        delta_dias     = (fecha_nueva_dt - fecha_orig_dt).days

        # 3. Actualizar la clase indicada
        supabase.table("cronograma_clases").update({
            "fecha_programada": body.nueva_fecha,
            "estado_clase":     "reprogramada",
            "motivo_reprogramacion": body.motivo or None,
        }).eq("id_clase", id_clase).execute()

        clases_afectadas = [{"id": id_clase, "nueva_fecha": body.nueva_fecha}]

        # 4. Si hay que desplazar las siguientes, recalcular en cascada
        if body.desplazar_siguientes and delta_dias != 0:
            # Obtener docente para cargar sus feriados
            plan_res = (
                supabase.table("planificacion")
                .select("id_docente")
                .eq("id_planificacion", id_planificacion)
                .single()
                .execute()
            )
            id_docente = (plan_res.data or {}).get("id_docente", "")
            feriados   = _cargar_feriados(id_docente)

            # Obtener todas las clases POSTERIORES a la replanificada
            siguientes_res = (
                supabase.table("cronograma_clases")
                .select("id_clase, numero, fecha_programada, tipo")
                .eq("id_planificacion", id_planificacion)
                .gt("numero", numero_clase)
                .order("numero", desc=False)
                .execute()
            )
            siguientes = siguientes_res.data or []

            for sig in siguientes:
                try:
                    fecha_actual_dt  = date.fromisoformat(sig["fecha_programada"][:10])
                    fecha_nueva_sig  = (fecha_actual_dt + timedelta(days=delta_dias)).isoformat()

                    # Si la nueva fecha cae en feriado, avanzar al siguiente hábil
                    if _es_feriado(fecha_nueva_sig, feriados):
                        fecha_nueva_sig = _siguiente_habil(fecha_nueva_sig, feriados)

                    supabase.table("cronograma_clases").update({
                        "fecha_programada": fecha_nueva_sig,
                        # Solo marcar como reprogramada si era clase normal
                        "estado_clase": "reprogramada" if sig["tipo"] == "clase" else sig.get("estado_clase", "programada"),
                    }).eq("id_clase", sig["id_clase"]).execute()

                    clases_afectadas.append({"id": sig["id_clase"], "nueva_fecha": fecha_nueva_sig})
                except Exception as e:
                    print(f"⚠️ No se pudo actualizar clase {sig['id_clase']}: {e}")

        return {
            "ok": True,
            "clase_replanificada": id_clase,
            "fecha_original": fecha_original,
            "nueva_fecha": body.nueva_fecha,
            "delta_dias": delta_dias,
            "clases_desplazadas": len(clases_afectadas) - 1,
            "detalle": clases_afectadas,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ ERROR replanificar: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/planificacion/agenda/{id_docente}")
async def get_agenda_docente(id_docente: str):
    """Devuelve todas las planificaciones del docente con sus clases, ordenadas por fecha."""
    try:
        # Primero traemos las planificaciones
        plans_res = (
            supabase.table("planificacion")
            .select("id_planificacion, nombre_clase, tema, duracion, id_curso, id_escuela, fecha, estado")
            .eq("id_docente", id_docente)
            .order("fecha", desc=False)
            .execute()
        )
        planes = plans_res.data or []

        # Para cada planificación traemos sus clases
        resultado = []
        for plan in planes:
            clases_res = (
                supabase.table("cronograma_clases")
                .select("id, numero, fecha_programada, tema_clase, tipo, estado_clase")
                .eq("id_planificacion", plan["id_planificacion"])
                .order("numero", desc=False)
                .execute()
            )
            resultado.append({
                **plan,
                "clases": clases_res.data or [],
            })

        return {"status": "success", "agenda": resultado}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/planificacion/proximas/{id_docente}")
async def proximas_clases(id_docente: str, dias: int = 30):
    """
    Devuelve las clases individuales programadas en los próximos N días.
    Consulta cronograma_clases directamente para tener fechas actualizadas.
    """
    try:
        desde = date.today().isoformat()
        hasta = (date.today() + timedelta(days=dias)).isoformat() + "T23:59:59"

        # Traer IDs de planificaciones del docente
        plans_ids = [
            p["id_planificacion"]
            for p in (
                supabase.table("planificacion")
                .select("id_planificacion")
                .eq("id_docente", id_docente)
                .execute()
                .data or []
            )
        ]

        if not plans_ids:
            return []

        # Traer clases en el rango de fechas
        res = (
            supabase.table("cronograma_clases")
            .select("*, planificacion(nombre_clase, tema, duracion, id_curso, id_escuela)")
            .in_("id_planificacion", plans_ids)
            .gte("fecha_programada", desde)
            .lte("fecha_programada", hasta)
            .order("fecha_programada", desc=False)
            .execute()
        )
        items = res.data or []

        # Enriquecer con materia (cursos) y nombre de escuela (escuelas), igual
        # que hacemos en /calendario/mes — acá la planificación viene anidada
        # bajo item["planificacion"] en vez de plana.
        ids_curso = list({
            item["planificacion"]["id_curso"]
            for item in items
            if item.get("planificacion") and item["planificacion"].get("id_curso")
        })
        ids_escuela = list({
            item["planificacion"]["id_escuela"]
            for item in items
            if item.get("planificacion") and item["planificacion"].get("id_escuela")
        })

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

        for item in items:
            plan = item.get("planificacion")
            if plan:
                plan["materia"] = materia_por_curso.get(plan.get("id_curso"), "")
                plan["nombre_escuela"] = escuela_por_id.get(plan.get("id_escuela"), "")

        return items

    except Exception as e:
        print(f"❌ proximas_clases: {e}")
        raise HTTPException(500, str(e))


@router.get("/planificacion/{id_planificacion}/detalle")
async def get_planificacion_detalle(id_planificacion: str):
    """Devuelve planificación + todas sus clases + exámenes."""
    try:
        plan = (
            supabase.table("planificacion")
            .select("*")
            .eq("id_planificacion", id_planificacion)
            .single()
            .execute()
        )
        if not plan.data:
            raise HTTPException(status_code=404, detail="Planificación no encontrada")

        clases = (
            supabase.table("cronograma_clases")
            .select("*")
            .eq("id_planificacion", id_planificacion)
            .order("numero", desc=False)
            .execute()
        )
        examenes = (
            supabase.table("examenes_planificacion")
            .select("*")
            .eq("id_planificacion", id_planificacion)
            .execute()
        )

        return {
            **plan.data,
            "clases":   clases.data or [],
            "examenes": examenes.data or [],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Recordatorios ─────────────────────────────────────────────────────────────

@router.post("/recordatorio")
async def crear_recordatorio(
    id_planificacion: str = Form(...),
    id_docente: str = Form(...),
    minutos_antes: int = Form(...),
):
    try:
        plan = supabase.table("planificacion").select("*").eq("id_planificacion", id_planificacion).single().execute().data
        if not plan:
            raise HTTPException(404, "Planificación no encontrada")

        fecha_clase = datetime.fromisoformat(plan["fecha"])
        fecha_envio = fecha_clase - timedelta(minutes=minutos_antes)

        if fecha_envio < datetime.now():
            raise HTTPException(400, "Ese recordatorio ya pasó. Elegí menos anticipación.")

        res = supabase.table("recordatorios_clase").insert({
            "id_planificacion": id_planificacion,
            "id_docente":       id_docente,
            "minutos_antes":    minutos_antes,
            "fecha_envio":      fecha_envio.isoformat(),
        }).execute()
        return {"status": "ok", "fecha_envio": fecha_envio.isoformat(), "data": res.data[0] if res.data else {}}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error al crear recordatorio: {str(e)}")


@router.get("/recordatorios/{id_docente}")
async def listar_recordatorios(id_docente: str):
    res = supabase.table("recordatorios_clase").select("*, planificacion(nombre_clase, fecha)").eq("id_docente", id_docente).execute()
    return res.data or []


@router.delete("/recordatorio/{id_recordatorio}")
async def eliminar_recordatorio(id_recordatorio: str):
    supabase.table("recordatorios_clase").delete().eq("id_recordatorio", id_recordatorio).execute()
    return {"status": "ok"}


@router.put("/planificacion/clase/{id_clase}/estado")
async def actualizar_estado_clase(id_clase: str, body: EstadoClaseRequest):
    """Actualiza el estado de una clase individual (dictada, cancelada, etc.)."""
    estados_validos = {"programada", "dictada", "cancelada", "reprogramada"}
    if body.estado not in estados_validos:
        raise HTTPException(status_code=400, detail=f"Estado inválido. Opciones: {estados_validos}")
    try:
        res = supabase.table("cronograma_clases") \
            .update({"estado_clase": body.estado}) \
            .eq("id_clase", id_clase) \
            .execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Clase no encontrada")
        return {"ok": True, "id": id_clase, "estado": body.estado}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ ERROR estado clase: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/planificacion/clase/{id_clase}/suspender")
async def suspender_clase(id_clase: str, body: SuspenderClaseRequest):
    """
    Suspende/cancela una clase (NO la elimina — conserva tema_clase,
    actividades_previstas, recursos_urls, etc.).

    - desplazar_siguientes=False (default): la clase queda marcada como
      'cancelada' con su motivo/observación, y el resto del cronograma
      mantiene sus fechas originales.
    - desplazar_siguientes=True: además, TODAS las clases posteriores
      (mismo id_planificacion, numero > numero_clase) se desplazan un día
      hacia adelante en cascada, respetando feriados — misma lógica que ya
      usa /replanificar, para mantener la secuencia pedagógica.
    """
    try:
        clase_res = (
            supabase.table("cronograma_clases")
            .select("*")
            .eq("id_clase", id_clase)
            .single()
            .execute()
        )
        if not clase_res.data:
            raise HTTPException(status_code=404, detail="Clase no encontrada")

        clase = clase_res.data
        id_planificacion = clase["id_planificacion"]
        numero_clase      = clase["numero"]

        # 1. Marcar la clase como suspendida/cancelada, guardando motivo y observación.
        #    El contenido pedagógico (tema_clase, actividades_previstas, recursos_urls)
        #    no se toca.
        supabase.table("cronograma_clases").update({
            "estado_clase":           "cancelada",
            "motivo_suspension":      body.motivo,
            "observacion_suspension": body.observacion or None,
        }).eq("id_clase", id_clase).execute()

        clases_afectadas = [{"id": id_clase, "estado": "cancelada"}]

        # 2. Si corresponde, desplazar las clases posteriores un día hacia
        #    adelante en cascada (misma lógica que /replanificar).
        if body.desplazar_siguientes:
            plan_res = (
                supabase.table("planificacion")
                .select("id_docente")
                .eq("id_planificacion", id_planificacion)
                .single()
                .execute()
            )
            id_docente = (plan_res.data or {}).get("id_docente", "")
            feriados   = _cargar_feriados(id_docente)

            siguientes_res = (
                supabase.table("cronograma_clases")
                .select("id_clase, numero, fecha_programada, tipo")
                .eq("id_planificacion", id_planificacion)
                .gt("numero", numero_clase)
                .order("numero", desc=False)
                .execute()
            )
            siguientes = siguientes_res.data or []

            for sig in siguientes:
                try:
                    fecha_actual_dt = date.fromisoformat(sig["fecha_programada"][:10])
                    fecha_nueva_sig = (fecha_actual_dt + timedelta(days=1)).isoformat()

                    if _es_feriado(fecha_nueva_sig, feriados):
                        fecha_nueva_sig = _siguiente_habil(fecha_nueva_sig, feriados)

                    supabase.table("cronograma_clases").update({
                        "fecha_programada": fecha_nueva_sig,
                        "estado_clase": "reprogramada" if sig["tipo"] == "clase" else sig.get("estado_clase", "programada"),
                    }).eq("id_clase", sig["id_clase"]).execute()

                    clases_afectadas.append({"id": sig["id_clase"], "nueva_fecha": fecha_nueva_sig})
                except Exception as e:
                    print(f"⚠️ No se pudo desplazar clase {sig['id_clase']}: {e}")

        return {
            "ok": True,
            "clase_suspendida": id_clase,
            "desplazo_siguientes": body.desplazar_siguientes,
            "clases_afectadas": len(clases_afectadas) - 1,
            "detalle": clases_afectadas,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ ERROR suspender clase: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/planificacion/clase/{id_clase}")
async def eliminar_clase(id_clase: str, incluir_siguientes: bool = False):
    """
    Elimina una clase del cronograma.

    - incluir_siguientes=False (default): elimina SOLO la clase indicada.
    - incluir_siguientes=True: elimina esa clase Y todas las posteriores
      (mismo id_planificacion, numero >= numero_clase) — por ejemplo, para
      cortar el resto de la cursada desde ese punto en adelante.

    Nota: no toca examenes_planificacion. Si algún examen referenciaba
    (por número) alguna de las clases borradas, esa referencia queda
    "colgando" — no se valida acá, es un caso a revisar manualmente si pasa.
    """
    try:
        clase_res = (
            supabase.table("cronograma_clases")
            .select("*")
            .eq("id_clase", id_clase)
            .single()
            .execute()
        )
        if not clase_res.data:
            raise HTTPException(status_code=404, detail="Clase no encontrada")

        clase = clase_res.data
        id_planificacion = clase["id_planificacion"]
        numero_clase     = clase["numero"]

        if incluir_siguientes:
            siguientes_res = (
                supabase.table("cronograma_clases")
                .select("id_clase")
                .eq("id_planificacion", id_planificacion)
                .gte("numero", numero_clase)
                .execute()
            )
            ids_a_borrar = [c["id_clase"] for c in (siguientes_res.data or [])]
            if ids_a_borrar:
                supabase.table("cronograma_clases").delete().in_("id_clase", ids_a_borrar).execute()
            eliminadas = len(ids_a_borrar)
        else:
            supabase.table("cronograma_clases").delete().eq("id_clase", id_clase).execute()
            eliminadas = 1

        return {
            "ok": True,
            "eliminadas": eliminadas,
            "incluyo_siguientes": incluir_siguientes,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ ERROR eliminar clase: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/planificacion/distribuir")
async def distribuir_temas(payload: DistribuirPayload):
    """
    Llama a Groq para distribuir los temas de cada unidad entre
    las clases disponibles. Devuelve una lista de ClaseDistribuida.
    """
    try:
        # ── Construir prompt ──────────────────────────────────────────────────
        unidades_txt = ""
        for u in payload.unidades:
            unidades_txt += f"\n### Unidad {u.numero}: {u.nombre}\n"
            unidades_txt += f"Contenido mínimo:\n{u.contenido}\n"
            if u.bibliografia_especifica:
                unidades_txt += f"Bibliografía específica:\n{u.bibliografia_especifica}\n"

        fechas_txt = "\n".join(
            [f"Clase {i+1}: {f}" for i, f in enumerate(payload.fechas[:payload.total_clases])]
        )

        system_prompt = """
Sos un experto en planificación pedagógica universitaria.
Tu tarea es distribuir los contenidos de una asignatura entre sus clases.
Respondé EXCLUSIVAMENTE con un JSON válido, sin texto extra, sin markdown.
El JSON debe tener esta estructura exacta:
{
  "clases": [
    {
      "numero": 1,
      "fecha": "YYYY-MM-DD",
      "unidad": 1,
      "tema": "Nombre breve y preciso del tema de esta clase (máx 80 caracteres)"
    }
  ]
}
Reglas:
- Cubrí TODOS los contenidos mínimos de todas las unidades.
- Distribuí las clases proporcionalmente: más clases a unidades con más contenido.
- Cada clase tiene UN solo tema principal, concreto y específico (no genérico).
- Los temas deben seguir el orden lógico de la asignatura.
- Podés usar varias clases para un mismo subtema si es complejo.
- No inventés temas que no estén en el contenido mínimo.
- Respetá el número y fecha de cada clase tal como se indica.
"""

        user_prompt = f"""
Asignatura: {payload.nombre_asignatura}

Contenido mínimo general:
{payload.contenido_minimo_general}

Bibliografía general:
{payload.bibliografia_general or "No especificada"}

Unidades:
{unidades_txt}

Clases disponibles ({payload.total_clases} en total):
{fechas_txt}

Distribuí los temas de todas las unidades entre estas {payload.total_clases} clases.
"""

        # ── Llamar a Groq ─────────────────────────────────────────────────────
        from app.services.rag_orchestrator import RAGOrchestrator
        import json, re

        full_prompt = f"{system_prompt}\n\n{user_prompt}"
        raw = RAGOrchestrator._generate(full_prompt)

        # Parsear JSON
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if not match:
            raise HTTPException(500, "La IA no devolvió un JSON válido")
        data = json.loads(match.group(0))

        clases = data.get("clases", [])
        if not clases:
            raise HTTPException(500, "La IA no generó clases")

        return {"ok": True, "clases": clases}

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ ERROR distribuir_temas: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Listar planificaciones del docente ────────────────────────────────────────
@router.get("/planificacion/lista/{id_docente}")
async def listar_planificaciones(id_docente: str):
    try:
        res = supabase.table("planificacion") \
            .select("id:id_planificacion, nombre_clase, duracion, contenido_minimo, created_at") \
            .eq("id_docente", id_docente) \
            .order("created_at", desc=True) \
            .execute()
        plans = res.data or []
        # Agregar total_clases de cronograma_clases
        for p in plans:
            try:
                clases_res = supabase.table("cronograma_clases") \
                    .select("id", count="exact") \
                    .eq("id_planificacion", p["id"]) \
                    .execute()
                p["total_clases"] = clases_res.count or 0
            except Exception:
                p["total_clases"] = 0
        return plans
    except Exception as e:
        print(f"❌ ERROR listar planificaciones: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Exportar planificación a Word (.docx) ─────────────────────────────────────
@router.get("/planificacion/{id_plan}/exportar-word")
async def exportar_planificacion_word(id_plan: str):
    try:
        plan = _obtener_planificacion_por_id(id_plan)
        if not plan:
            raise HTTPException(status_code=404, detail="Planificación no encontrada")
        clases_res = supabase.table("cronograma_clases") \
            .select("*").eq("id_planificacion", id_plan).order("numero").execute()
        clases = clases_res.data or []

        docx_bytes = _generar_docx_planificacion(plan, clases)

        nombre = f"Planificacion_{plan.get('nombre_clase', id_plan).replace(' ', '_')}.docx"
        return StreamingResponse(
            io.BytesIO(docx_bytes),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename={nombre}"},
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ ERROR exportar word: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Exportar planificación a PDF ──────────────────────────────────────────────
@router.get("/planificacion/{id_plan}/exportar-pdf")
async def exportar_planificacion_pdf(id_plan: str):
    try:
        plan = _obtener_planificacion_por_id(id_plan)
        if not plan:
            raise HTTPException(status_code=404, detail="Planificación no encontrada")
        clases_res = supabase.table("cronograma_clases") \
            .select("*").eq("id_planificacion", id_plan).order("numero").execute()
        clases = clases_res.data or []

        pdf_bytes = _generar_pdf_planificacion(plan, clases)

        nombre = f"Planificacion_{plan.get('nombre_clase', id_plan).replace(' ', '_')}.pdf"
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={nombre}"},
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ ERROR exportar pdf: {e}")
        raise HTTPException(status_code=500, detail=str(e))
