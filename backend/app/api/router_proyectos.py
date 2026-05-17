from fastapi import APIRouter, HTTPException, status, Depends
from app.core.database import supabase
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(tags=["Gestión de Proyectos"])

# --- ESQUEMAS ---
class EscuelaCreate(BaseModel):
    id_docente: str
    nombre_escuela: str
    ciudad: Optional[str] = None

class CursoCreate(BaseModel):
    id_escuela: str
    nombre_materia: str
    division: str
    ciclo_lectivo: int = 2026
    contenido_minimo: Optional[str] = None
    bibliografia: Optional[List[str]] = []
    fuentes: Optional[str] = None
    
class CursoUpdate(BaseModel):
    nombre_materia: Optional[str] = None
    division: Optional[str] = None
    ciclo_lectivo: Optional[int] = None
    contenido_minimo: Optional[str] = None
    bibliografia: Optional[List[str]] = None
    fuentes: Optional[str] = None
    
class MoverCurso(BaseModel):
    nuevo_id_escuela: str

# --- ENDPOINTS ---

# CORRECCIÓN EN router_proyectos.py
@router.get("/escuelas/{user_id}")
async def obtener_escuelas(user_id: str):
    docente = supabase.table("docentes")\
        .select("*")\
        .eq("id_docente", user_id)\
        .execute()

    if not docente.data:
        return []

    # Cambiamos "id" por "id_docente"
    id_interno = docente.data[0]["id_docente"]

    escuelas = supabase.table("escuelas")\
        .select("*")\
        .eq("id_docente", id_interno)\
        .execute()

    return escuelas.data

@router.post("/escuelas")
async def crear_escuela(datos: EscuelaCreate):
    """Permite al docente agregar una nueva institución."""
    res = supabase.table("escuelas").insert(datos.model_dump()).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="No se pudo crear la escuela")
    return res.data[0]

@router.get("/cursos/{id_escuela}")
async def obtener_cursos(id_escuela: str):
    """Trae todas las materias de una escuela específica."""
    res = supabase.table("cursos").select("*").eq("id_escuela", id_escuela).execute()
    return res.data

@router.post("/cursos")
async def crear_curso(datos: CursoCreate):
    """Agrega una materia a una escuela."""
    res = supabase.table("cursos").insert(datos.model_dump()).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="No se pudo crear el curso")
    return res.data[0]

@router.put("/cursos/{id_curso}")
async def actualizar_curso(id_curso: str, datos: CursoUpdate):
    """Actualiza una materia/curso con contenido mínimo, bibliografía, fuentes."""
    try:
        # Verificar que el curso exista
        curso = supabase.table("cursos").select("*").eq("id_curso", id_curso).single().execute()
        if not curso.data:
            raise HTTPException(status_code=404, detail="Curso no encontrado")
        
        # Actualizar solo los campos proporcionados
        update_data = {k: v for k, v in datos.model_dump().items() if v is not None}
        if not update_data:
            raise HTTPException(status_code=400, detail="No hay campos para actualizar")
        
        res = supabase.table("cursos").update(update_data).eq("id_curso", id_curso).execute()
        if not res.data:
            raise HTTPException(status_code=400, detail="No se pudo actualizar el curso")
        return res.data[0]
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error al actualizar curso: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# --- DELETE ESCUELA ---
@router.delete("/escuelas/{id_escuela}")
async def eliminar_escuela(id_escuela: str):
    """Elimina una escuela y todas sus materias asociadas."""
    try:
        # 1) Verificar que la escuela exista
        escuela = supabase.table("escuelas")\
            .select("*")\
            .eq("id_escuela", id_escuela)\
            .single().execute()

        if not escuela.data:
            raise HTTPException(status_code=404, detail="Escuela no encontrada")

        # 2) Borrar las materias hijas primero (si la FK no tiene ON DELETE CASCADE)
        supabase.table("cursos")\
            .delete()\
            .eq("id_escuela", id_escuela)\
            .execute()

        # 3) Borrar la escuela
        supabase.table("escuelas")\
            .delete()\
            .eq("id_escuela", id_escuela)\
            .execute()

        return {"status": "success", "id_escuela": id_escuela}

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error al eliminar escuela: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# --- DELETE CURSO ---
@router.delete("/cursos/{id_curso}")
async def eliminar_curso(id_curso: str):
    """Elimina una materia/curso específico."""
    try:
        curso = supabase.table("cursos")\
            .select("*")\
            .eq("id_curso", id_curso)\
            .single().execute()

        if not curso.data:
            raise HTTPException(status_code=404, detail="Curso no encontrado")

        supabase.table("cursos")\
            .delete()\
            .eq("id_curso", id_curso)\
            .execute()

        return {"status": "success", "id_curso": id_curso}

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error al eliminar curso: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    

@router.put("/cursos/{id_curso}/mover")
async def mover_curso(id_curso: str, datos: MoverCurso):
    """Cambia un curso/materia de una escuela a otra."""
    try:
        # Verificamos que el curso exista
        curso = supabase.table("cursos")\
            .select("*")\
            .eq("id_curso", id_curso)\
            .single().execute()
        if not curso.data:
            raise HTTPException(status_code=404, detail="Curso no encontrado")

        # Verificamos que la escuela destino exista
        escuela = supabase.table("escuelas")\
            .select("id_escuela")\
            .eq("id_escuela", datos.nuevo_id_escuela)\
            .single().execute()
        if not escuela.data:
            raise HTTPException(status_code=404, detail="Escuela destino no encontrada")

        # Hacemos el update
        res = supabase.table("cursos")\
            .update({"id_escuela": datos.nuevo_id_escuela})\
            .eq("id_curso", id_curso)\
            .execute()

        return res.data[0] if res.data else {"status": "ok"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error al mover curso: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/dashboard-stats/{id_docente}")
async def obtener_resumen(id_docente: str):
    """Endpoint rápido para las estadísticas del Dashboard."""
    # Contamos escuelas
    escuelas = supabase.table("escuelas").select("id_escuela", count="exact").eq("id_docente", id_docente).execute()
    # Contamos planificacion totales (vía join simple o conteo)
    # Esto es útil para el post-it de estadísticas del front
    return {
        "total_escuelas": escuelas.count,
        "mensajes_ia": 0 # Aquí conectarías con tu tabla de métricas luego
    }
# --- NUEVO: ENDPOINT PARA LA BIBLIOTECA DE RECURSOS ---
@router.get("/archivos/{id_docente}")
async def obtener_archivos_generados(id_docente: str):
    """Trae todos los archivos (PPTX, DOCX, etc.) generados por el docente."""
    try:
        res = supabase.table("archivos_generados")\
            .select("*")\
            .eq("id_docente", id_docente)\
            .order("fecha_creacion", desc=True)\
            .execute()
        
        return res.data
    except Exception as e:
        print(f"❌ Error al consultar archivos: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail="Error al obtener la lista de documentos"
        )
    
@router.delete("/archivo/{id_archivo}")
async def eliminar_archivo(id_archivo: str):
    try:
        # 1) Buscar el archivo
        archivo = supabase.table("archivos_generados") \
            .select("*") \
            .eq("id_archivo", id_archivo) \
            .single().execute()

        if not archivo.data:
            raise HTTPException(status_code=404, detail="Archivo no encontrado")

        # 2) Borrar del bucket de Storage
        path = archivo.data.get("path_archivo") or archivo.data.get("path")
        if not path:
            url = archivo.data.get("url_descarga") or ""
            if "/documentos_docentes/" in url:
                path = url.split("/documentos_docentes/")[-1].split("?")[0]

        if path:
            try:
                supabase.storage.from_("documentos_docentes").remove([path])
            except Exception as e:
                print(f"⚠️ No se pudo borrar del storage: {e}")

        # 3) Borrar de la tabla
        supabase.table("archivos_generados").delete().eq("id_archivo", id_archivo).execute()

        return {"status": "success", "id_archivo": id_archivo}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    