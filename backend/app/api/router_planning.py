# backend/app/api/router_planning.py
from fastapi import APIRouter, HTTPException
from app.models.schemas import PlanificacionAcademicaRequest, ReprogramarClaseRequest
from app.services.planning_service import PlanningService
from app.api.generacion_utils import process_and_upload
from io import BytesIO
from fastapi.responses import StreamingResponse

router = APIRouter()

@router.post("/generar-plan")
async def generar_plan(request: PlanificacionAcademicaRequest):
    try:
        service = PlanningService()
        plan = service.generate_schedule(request)

        # Guardar clases
        for clase in plan['clases']:
            supabase.table('clases').insert({
                'id_clase': clase.id_clase,
                'id_curso': request.id_curso,
                'orden': clase.orden,
                'fecha_programada': clase.fecha_programada.isoformat(),
                'tema_clase': clase.tema_clase,
                'actividades_previstas': clase.actividades_previstas,
                'bibliografia_especifica': clase.bibliografia_especifica,
                'estado_clase': clase.estado_clase,
                'recursos_urls': clase.recursos_urls
            }).execute()

        # Guardar examenes
        for examen in plan['examenes']:
            supabase.table('examenes').insert({
                'id_examen': examen.id_examen,
                'id_curso': request.id_curso,
                'nombre': examen.nombre,
                'fecha': examen.fecha.isoformat(),
                'tiene_recuperatorio': examen.tiene_recuperatorio
            }).execute()

            # Insertar relaciones clases-examenes
            for clase_id in examen.clases_ids:
                supabase.table('clases_examenes').insert({
                    'id_clase': clase_id,
                    'id_examen': examen.id_examen
                }).execute()

        # Guardar recuperatorios
        for rec in plan['recuperatorios']:
            supabase.table('recuperatorios').insert({
                'id_recuperatorio': rec.id_recuperatorio,
                'id_examen': rec.id_examen,
                'fecha': rec.fecha.isoformat()
            }).execute()

            # Insertar relaciones clases-recuperatorios
            for clase_id in rec.clases_ids:
                supabase.table('clases_recuperatorios').insert({
                    'id_clase': clase_id,
                    'id_recuperatorio': rec.id_recuperatorio
                }).execute()

        return plan
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reprogramar-clase")
async def reprogramar_clase(request: ReprogramarClaseRequest):
    try:
        # Obtener id_curso de la clase
        clase_data = supabase.table('clases').select('id_curso').eq('id_clase', request.id_clase).execute()
        if not clase_data.data:
            raise HTTPException(status_code=404, detail="Clase no encontrada")
        id_curso = clase_data.data[0]['id_curso']

        service = PlanningService()
        result = service.reprogramar_clase(request.id_clase, request.nueva_fecha, request.desplazar_subsiguientes, id_curso)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/exportar-plan")
async def exportar_plan(plan_data: dict, bibliografia: str = "Bibliografía general", id_docente: str = ""):
    try:
        service = PlanningService()
        doc = service.export_to_word(plan_data, bibliografia)

        buffer = BytesIO()
        doc.save(buffer)
        archivo_binario = buffer.getvalue()

        # Guardar en "Mis materiales"
        return await process_and_upload(
            archivo_binario, 
            "Planificacion_Academica", 
            "Planificación", 
            "docx", 
            id_docente, 
            "PLANNING"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))