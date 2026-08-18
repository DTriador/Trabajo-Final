# backend/app/api/gamificacion_cuadricula_sopa_letras.py
import io
import random
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.lib.units import cm

from app.api.generacion_utils import process_and_upload
from app.api.gamificacion_cuadricula_helpers import (
    _normalizar, _wrap_text, _datos_escuela_materia, _generar_json_ia,
)
from app.api.gamificacion_cuadricula_pdf_utils import _dibujar_encabezado_pdf
from app.utils.visual_theme import THEME, reportlab_rgb

router = APIRouter()


# ── endpoint ───────────────────────────────────────────────────────────────

@router.post("/sopa_letras")
async def generar_sopa_letras(
    id_docente: str = Form(...),
    tema: str = Form(""),
    numero_palabras: int = Form(10),
    mostrar_lista: bool = Form(True),
    file: Optional[UploadFile] = File(None),
    id_escuela: Optional[str] = Form(None),
    id_curso: Optional[str] = Form(None),
    fecha: Optional[str] = Form(None),
    nombre_alumno: Optional[str] = Form(None),
):
    try:
        n = max(5, min(int(numero_palabras), 25))

        nombre_escuela, nombre_materia, division, contenido_minimo, bibliografia = \
            _datos_escuela_materia(id_escuela, id_curso)

        SYSTEM_PROMPT_SOPA = f"""
        Sos un asistente pedagógico. A partir del contenido proporcionado, extraé las
        ideas principales y devolvé EXCLUSIVAMENTE un JSON válido con esta forma:
        {{
          "resumen": "2 o 3 oraciones con las ideas principales",
          "palabras": ["PALABRA1", "PALABRA2", "..."]
        }}
        Reglas para "palabras":
        - Exactamente {n} palabras clave.
        - Una sola palabra cada una (sin espacios ni guiones).
        - En MAYÚSCULAS, sin tildes ni Ñ (usá N).
        - Entre 4 y 12 letras. Sustantivos o conceptos clave. Sin repetidos.
        """

        prompt_personalizado = (
            f"Generá un resumen breve y extraé {n} palabras clave para una sopa de letras. "
            f"Materia: '{nombre_materia}'. Tema: '{tema or 'general'}'."
        )

        datos_json = await _generar_json_ia(
            file, prompt_personalizado, SYSTEM_PROMPT_SOPA,
            id_docente, contenido_minimo, bibliografia,
        )

        resumen  = (datos_json or {}).get("resumen", "")
        palabras = [_normalizar(p) for p in (datos_json or {}).get("palabras", []) if p]
        palabras = list(dict.fromkeys([p for p in palabras if 4 <= len(p) <= 12]))[:n]

        if len(palabras) < 5:
            raise HTTPException(status_code=400, detail="No se pudieron extraer suficientes palabras.")

        grilla, palabras_colocadas = _armar_sopa(palabras)

        pdf_bytes = _renderizar_pdf_sopa(
            tema=tema or "Sopa de letras",
            grilla=grilla,
            palabras=palabras_colocadas,
            mostrar_lista=mostrar_lista,
            resumen=resumen,
            nombre_escuela=nombre_escuela,
            nombre_materia=nombre_materia,
            division=division,
            fecha=fecha,
            nombre_alumno=nombre_alumno,
        )

        nombre_archivo = f"SopaLetras_{nombre_escuela}_{nombre_materia}".replace(" ", "_")
        return await process_and_upload(
            pdf_bytes, nombre_archivo, tema, "pdf", id_docente, "SOPA_LETRAS",
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"DEBUG ERROR SOPA: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ── armado de la sopa ────────────────────────────────────────────────────────

def _armar_sopa(palabras):
    palabras = sorted(set(palabras), key=len, reverse=True)
    longest = max(len(p) for p in palabras)
    N = max(15, longest + 3)
    grilla = [["" for _ in range(N)] for _ in range(N)]
    direcciones = [(0,1),(1,0),(1,1),(-1,1),(0,-1),(-1,0),(-1,-1),(1,-1)]
    colocadas = []
    for w in palabras:
        for _ in range(200):
            dr, dc = random.choice(direcciones)
            r = random.randint(0, N - 1)
            c = random.randint(0, N - 1)
            r_fin = r + dr*(len(w)-1); c_fin = c + dc*(len(w)-1)
            if not (0 <= r_fin < N and 0 <= c_fin < N): continue
            ok = all(grilla[r+dr*i][c+dc*i] in ("", w[i]) for i in range(len(w)))
            if not ok: continue
            for i, ch in enumerate(w):
                grilla[r+dr*i][c+dc*i] = ch
            colocadas.append(w)
            break
    letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    for r in range(N):
        for c in range(N):
            if grilla[r][c] == "":
                grilla[r][c] = random.choice(letras)
    return grilla, colocadas


# ── render del PDF ───────────────────────────────────────────────────────────

def _renderizar_pdf_sopa(tema, grilla, palabras, mostrar_lista, resumen,
                          nombre_escuela, nombre_materia, division, fecha, nombre_alumno):
    buf = io.BytesIO()
    c = pdfcanvas.Canvas(buf, pagesize=A4)
    width, height = A4

    y_start = _dibujar_encabezado_pdf(
        c, width, height, nombre_escuela, nombre_materia, division, fecha, nombre_alumno
    )

    c.setFillColorRGB(*reportlab_rgb(THEME["colors"]["surface_alt"]))
    c.roundRect(1.1 * cm, y_start - 1.0 * cm, width - 2.2 * cm, 1.4 * cm, 0.25 * cm, stroke=0, fill=1)
    c.setFillColorRGB(*reportlab_rgb(THEME["colors"]["primary"]))
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width/2, y_start, f"Sopa de letras: {tema}")
    y_start -= 0.7 * cm

    if resumen:
        c.setFillColorRGB(*reportlab_rgb(THEME["colors"]["text"]))
        c.setFont("Helvetica-Oblique", 10)
        for i, linea in enumerate(_wrap_text(resumen, 95)):
            c.drawString(2*cm, y_start - i*0.45*cm, linea)
        y_start -= (len(_wrap_text(resumen, 95)) * 0.45 + 0.3) * cm

    N = len(grilla)
    cell = min(0.75*cm, (width - 4*cm)/N)
    grid_w = cell*N
    x0 = (width - grid_w)/2
    y0 = y_start - grid_w
    font_size = max(8, int(cell * 0.55))
    c.setStrokeColorRGB(*reportlab_rgb(THEME["colors"]["border"]))
    c.setLineWidth(0.7)
    c.setFillColorRGB(*reportlab_rgb(THEME["colors"]["grid_fill"]))
    for r in range(N):
        for col in range(N):
            x = x0 + col*cell
            y = y0 + (N-1-r)*cell
            c.rect(x, y, cell, cell, stroke=1, fill=1)
            c.setFillColorRGB(*reportlab_rgb(THEME["colors"]["text"]))
            c.setFont("Helvetica-Bold", font_size)
            c.drawCentredString(x + cell/2, y + (cell - font_size) / 2 + 1, grilla[r][col])
            c.setFillColorRGB(*reportlab_rgb(THEME["colors"]["grid_fill"]))
    if mostrar_lista and palabras:
        c.setStrokeColorRGB(*reportlab_rgb(THEME["colors"]["border"]))
        c.setFillColorRGB(*reportlab_rgb(THEME["colors"]["surface"]))
        c.roundRect(1.5 * cm, y0 - 2.0 * cm, width - 3.0 * cm, 1.8 * cm, 0.2 * cm, stroke=1, fill=1)
        c.setFillColorRGB(*reportlab_rgb(THEME["colors"]["primary"]))
        c.setFont("Helvetica-Bold", 12)
        c.drawString(2*cm, y0 - 1.2*cm, "Palabras a buscar:")
        c.setFillColorRGB(*reportlab_rgb(THEME["colors"]["text"]))
        c.setFont("Helvetica", 11)
        cols = 3
        por_col = (len(palabras) + cols - 1)//cols
        for i, p in enumerate(palabras):
            col = i // por_col; fila = i % por_col
            c.drawString(2*cm + col*6*cm, y0 - 1.8*cm - fila*0.5*cm, f"• {p}")
    c.showPage(); c.save()
    return buf.getvalue()
