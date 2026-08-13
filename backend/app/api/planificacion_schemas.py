# backend/app/api/planificacion_schemas.py
"""
Modelos Pydantic usados por el módulo de Planificación
(router_planificacion.py, planificacion_generadores.py).
Extraído sin cambios de lógica desde router_planificacion.py.
"""
from typing import Optional, List
from pydantic import BaseModel


# ── Wizard de planificación ────────────────────────────────────────────────

class ClaseWizard(BaseModel):
    numero: int
    fecha_programada: str       # "YYYY-MM-DD"
    tema_clase: str
    tipo: str                   # "clase" | "examen" | "recuperatorio"
    estado_clase: str = "programada"


class ExamenWizard(BaseModel):
    numero: int
    clases_examen: str          # "1, 2, 3"
    tiene_recuperatorio: bool = False
    clases_recup_desde: Optional[int] = None
    clases_recup_hasta: Optional[int] = None


class FeriadoWizard(BaseModel):
    fecha: str
    nombre: str


class PlanificacionWizardPayload(BaseModel):
    id_docente: str
    id_curso: str
    nombre_clase: str
    tema: str
    duracion: Optional[str] = None
    contenido_minimo: Optional[str] = None
    clases: List[ClaseWizard]
    examenes: Optional[List[ExamenWizard]] = []
    feriados_excluidos: Optional[List[FeriadoWizard]] = []


# ── Replanificación / estado de clase ───────────────────────────────────────

class ReplanificarClaseRequest(BaseModel):
    nueva_fecha: str            # "YYYY-MM-DD"
    motivo: str = ""
    desplazar_siguientes: bool = True  # ← clave: arrastra las clases posteriores


class EstadoClaseRequest(BaseModel):
    estado: str  # "programada" | "dictada" | "cancelada" | "reprogramada"


# ── Distribución automática de temas (IA) ───────────────────────────────────

class UnidadInput(BaseModel):
    numero: int
    nombre: str
    contenido: str                  # contenido mínimo de la unidad
    bibliografia_especifica: str = ""


class DistribuirPayload(BaseModel):
    id_docente: str
    nombre_asignatura: str
    contenido_minimo_general: str
    bibliografia_general: str = ""
    unidades: List[UnidadInput]
    total_clases: int               # cantidad total de clases de la asignatura
    fechas: List[str]               # lista de fechas "YYYY-MM-DD" ya calculadas


class ClaseDistribuida(BaseModel):
    numero: int
    fecha: str
    unidad: int
    tema: str
