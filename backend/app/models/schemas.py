from pydantic import BaseModel, EmailStr, Field, model_validator
from typing import List, Optional, Any
from datetime import datetime, date


class MateriaSchema(BaseModel):
    nombre: str

class EscuelaSchema(BaseModel):
    nombre: str
    division: Optional[str] = None
    materias: List[MateriaSchema]

# --- USUARIO Y REGISTRO ---
class UserCreate(BaseModel):
    nombre: str
    username: str
    email: EmailStr
    fecha_nacimiento: date
    ciudad: str
    escuelas: List[EscuelaSchema]
    telefono: str
    password: str
    confirm_password: str

    @model_validator(mode='after')
    def verificar_passwords(self) -> 'UserCreate':
        if self.password != self.confirm_password:
            raise ValueError("Las contraseñas no coinciden")
        return self

# --- GESTIÓN DE ESCUELAS Y CURSOS ---
class EscuelaBase(BaseModel):
    nombre_escuela: str
    ciudad: Optional[str] = None

class CursoBase(BaseModel):
    id_escuela: str
    nombre_materia: str
    division: str
    ciclo_lectivo: int = Field(default=2026, ge=2024, le=2100)

# --- PLANIFICACIÓN Y CRONOGRAMA ---
class ClaseSchema(BaseModel):
    id_clase: Optional[str] = None
    orden: int
    fecha_programada: datetime
    tema_clase: str
    actividades_previstas: Optional[str] = None
    bibliografia_especifica: Optional[str] = None
    estado_clase: str = "pendiente"   # pendiente | dictada | reprogramada
    recursos_urls: Optional[dict] = None

class PlanificacionRequest(BaseModel):
    id_curso: str
    titulo_plan: str
    objetivos_generales: str
    cronograma: List[ClaseSchema] = []

class ReprogramarClaseRequest(BaseModel):
    id_clase: str
    nueva_fecha: datetime
    desplazar_subsiguientes: bool = False

# --- ASISTENTE Y GENERACIÓN ---
class ChatRequest(BaseModel):
    mensaje: str
    contexto_rag_id: Optional[str] = None
    id_curso_actual: Optional[str] = None

class GenerateRequest(BaseModel):
    tema: str
    formato: str           # pptx | docx | xlsx | pdf
    tipo_contenido: str    # examen | sopa_letras | presentacion | apunte
    instrucciones_extra: Optional[str] = None

# --- RESPUESTA DE ARCHIVOS ---
class ArchivoGeneradoSchema(BaseModel):
    id_archivo: Optional[str] = None
    id_docente: str
    nombre_archivo: str
    tipo_formato: str
    sub_tipo: Optional[str] = None
    tema_especifico: Optional[str] = None
    url_descarga: Optional[str] = None
    uso_mb: float = 0.0
    categoria_ia: Optional[str] = None
    fecha_creacion: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- PLANIFICACIÓN ACADÉMICA ---
class ExamenSchema(BaseModel):
    id_examen: Optional[str] = None
    id_curso: str
    nombre: str
    fecha: datetime
    clases_ids: List[str]
    tiene_recuperatorio: bool = False

class RecuperatorioSchema(BaseModel):
    id_recuperatorio: Optional[str] = None
    id_examen: str
    fecha: datetime
    clases_ids: List[str]

class PlanificacionAcademicaRequest(BaseModel):
    id_curso: str
    id_docente: str
    horarios: List[str]
    bibliografia: str
    contenido_minimo: str
    cantidad_clases: int
    cantidad_examenes: int
    cantidad_recuperatorios: int