# backend/app/api/gamificacion_cuadricula_unir_flechas.py
import io
import random
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.lib.units import cm

from app.api.generacion_utils import process_and_upload
from app.api.gamificacion_cuadricula_helpers import (
    _wrap_text, _datos_escuela_materia, _generar_json_ia,
)
from app.api.gamificacion_cuadricula_pdf_utils import _dibujar_encabezado_pdf

router = APIRouter()


# ── endpoint ───────────────────────────────────────────────────────────────

@router.post("/unir_flechas")
async def generar_unir_flechas(
    id_docente: str = Form(...),
    tema: str = Form(""),
    numero_pares: int = Form(8),
    file: Optional[UploadFile] = File(None),
    id_escuela: Optional[str] = Form(None),
    id_curso: Optional[str] = Form(None),
    fecha: Optional[str] = Form(None),
    nombre_alumno: Optional[str] = Form(None),
):
    try:
        n = max(4, min(int(numero_pares), 12))

        nombre_escuela, nombre_materia, division, contenido_minimo, bibliografia = \
            _datos_escuela_materia(id_escuela, id_curso)

        SYSTEM_PROMPT_UNIR = f"""
        Sos un asistente pedagógico. A partir del contenido proporcionado, identificá los
        conceptos importantes y devolvé EXCLUSIVAMENTE un JSON válido con esta forma:
        {{
          "pares": [
            {{"palabra": "Concepto breve", "definicion": "Definición clara del concepto"}}
          ]
        }}
        Reglas:
        - Exactamente {n} pares palabra/definición distintos.
        - "palabra": máximo 4 palabras, sin punto final.
        - "definicion": una oración corta y clara, máximo 130 caracteres, NO incluir la palabra textual.
        - Sin repetidos.
        """

        prompt_personalizado = (
            f"Generá {n} pares palabra/definición para una actividad de unir con flechas. "
            f"Materia: '{nombre_materia}'. Tema: '{tema or 'general'}'."
        )

        datos_json = await _generar_json_ia(
            file, prompt_personalizado, SYSTEM_PROMPT_UNIR,
            id_docente, contenido_minimo, bibliografia,
        )

        pares = []
        for it in (datos_json or {}).get("pares", []):
            p = (it.get("palabra") or "").strip()
            d = (it.get("definicion") or "").strip()
            if p and d:
                pares.append({"palabra": p, "definicion": d})

        if len(pares) < 4:
            raise HTTPException(status_code=400, detail="No se pudieron extraer suficientes pares.")

        pdf_bytes = _renderizar_pdf_unir_flechas(
            tema=tema or "Unir con flechas",
            pares=pares,
            nombre_escuela=nombre_escuela,
            nombre_materia=nombre_materia,
            division=division,
            fecha=fecha,
            nombre_alumno=nombre_alumno,
        )

        nombre_archivo = f"UnirFlechas_{nombre_escuela}_{nombre_materia}".replace(" ", "_")
        return await process_and_upload(
            pdf_bytes, nombre_archivo, tema, "pdf", id_docente, "UNIR_FLECHAS",
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"DEBUG ERROR UNIR FLECHAS: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ── render del PDF ───────────────────────────────────────────────────────────

def _renderizar_pdf_unir_flechas(tema, pares, nombre_escuela, nombre_materia, division, fecha, nombre_alumno):
    buf = io.BytesIO()
    c = pdfcanvas.Canvas(buf, pagesize=A4)
    width, height = A4

    y_start = _dibujar_encabezado_pdf(
        c, width, height, nombre_escuela, nombre_materia, division, fecha, nombre_alumno
    )

    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width/2, y_start, f"Unir con flechas: {tema}")
    y_start -= 0.4*cm
    c.setFont("Helvetica-Oblique", 11)
    c.drawCentredString(width/2, y_start, "Uní cada definición con la palabra correspondiente.")

    palabras_mezcladas = [p["palabra"] for p in pares]
    if len(pares) > 1:
        for _ in range(50):
            random.shuffle(palabras_mezcladas)
            if all(palabras_mezcladas[i] != pares[i]["palabra"] for i in range(len(pares))):
                break

    n = len(pares)
    left_x  = 1.5*cm
    left_w  = 9.5*cm
    right_w = 5.0*cm
    right_x = width - 1.5*cm - right_w

    top_y    = y_start - 0.8*cm
    bottom_y = 2*cm
    avail    = top_y - bottom_y
    row_gap  = 0.4*cm
    row_h    = max(1.6*cm, min((avail - row_gap*(n-1)) / n, 2.8*cm))

    def_font = 11 if n <= 8 else 10
    pal_font = 13 if n <= 8 else 12

    for i in range(n):
        y_top = top_y - i * (row_h + row_gap)
        y_bot = y_top - row_h

        c.setStrokeColorRGB(0.40, 0.60, 0.90)
        c.setLineWidth(1.5)
        c.setFillColorRGB(0.95, 0.97, 1.00)
        c.roundRect(left_x, y_bot, left_w, row_h, 10, stroke=1, fill=1)
        c.setFillColorRGB(0, 0, 0)
        c.setFont("Helvetica", def_font)
        max_chars = max(20, int(left_w / (def_font * 0.50)))
        lineas = _wrap_text(pares[i]["definicion"], max_chars)
        line_h = def_font + 3
        total_h = len(lineas) * line_h
        y_text = y_bot + (row_h - total_h) / 2 + total_h - line_h
        for linea in lineas:
            c.drawString(left_x + 0.35*cm, y_text, linea)
            y_text -= line_h

        c.setStrokeColorRGB(0.90, 0.50, 0.70)
        c.setFillColorRGB(1.00, 0.95, 0.97)
        c.roundRect(right_x, y_bot, right_w, row_h, 10, stroke=1, fill=1)
        c.setFillColorRGB(0, 0, 0)
        c.setFont("Helvetica-Bold", pal_font)
        c.drawCentredString(right_x + right_w/2, y_bot + row_h/2 - pal_font/3, palabras_mezcladas[i])

    c.showPage(); c.save()
    return buf.getvalue()
