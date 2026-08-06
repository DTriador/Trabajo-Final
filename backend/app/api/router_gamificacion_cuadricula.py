# backend/app/api/router_gamificacion_cuadricula.py
"""
Router principal de las actividades de gamificación tipo cuadrícula
(crucigrama, unir con flechas, sopa de letras).

Antes toda la lógica vivía acá mismo, en un único archivo de ~450 líneas.
Ahora se divide en archivos hermanos dentro de app/api/ (misma carpeta,
sin subcarpetas, para respetar la estructura del proyecto):

- gamificacion_cuadricula_helpers.py    -> utilidades compartidas
                                            (normalización, texto, datos de
                                            escuela/curso, llamada a la IA)
- gamificacion_cuadricula_pdf_utils.py  -> dibujo del encabezado institucional
- gamificacion_cuadricula_crucigrama.py -> endpoint /crucigrama + lógica
- gamificacion_cuadricula_unir_flechas.py -> endpoint /unir_flechas + lógica
- gamificacion_cuadricula_sopa_letras.py  -> endpoint /sopa_letras + lógica

Este archivo sigue exportando el mismo `router` de siempre (con los mismos
tres endpoints, mismos paths, mismo comportamiento), así que no hace falta
tocar nada en app/main.py ni en ningún otro lugar donde ya se importe
`from app.api.router_gamificacion_cuadricula import router`.
"""
from fastapi import APIRouter

from app.api.gamificacion_cuadricula_crucigrama import router as _crucigrama_router
from app.api.gamificacion_cuadricula_unir_flechas import router as _unir_flechas_router
from app.api.gamificacion_cuadricula_sopa_letras import router as _sopa_letras_router

router = APIRouter()
router.include_router(_crucigrama_router)
router.include_router(_unir_flechas_router)
router.include_router(_sopa_letras_router)
