# backend/app/api/router_generacion.py
#
# Este archivo ya no contiene lógica propia.
# Es el punto de entrada que une los dos sub-routers.
#
# Estructura resultante:
#   router_planificacion.py  →  /planificacion, /planificacion/wizard,
#                               /planificacion/agenda, /planificacion/proximas,
#                               /planificacion/{id}/replanificar,
#                               /recordatorio(s)
#
#   router_contenido.py      →  /planilla, /apunte, /preguntas,
#                               /examen, /presentacion

from fastapi import APIRouter
from app.api.router_planificacion import router as planificacion_router
from app.api.router_contenido import router as contenido_router

router = APIRouter()

router.include_router(planificacion_router)
router.include_router(contenido_router)