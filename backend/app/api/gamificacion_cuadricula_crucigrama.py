# backend/app/api/gamificacion_cuadricula_crucigrama.py
import io
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

router = APIRouter()


# ── endpoint ───────────────────────────────────────────────────────────────

@router.post("/crucigrama")
async def generar_crucigrama(
    id_docente: str = Form(...),
    tema: str = Form(""),
    palabras_horizontales: int = Form(5),
    palabras_verticales: int = Form(5),
    file: Optional[UploadFile] = File(None),
    id_escuela: Optional[str] = Form(None),
    id_curso: Optional[str] = Form(None),
    fecha: Optional[str] = Form(None),
    nombre_alumno: Optional[str] = Form(None),
):
    try:
        h = max(2, min(int(palabras_horizontales), 12))
        v = max(2, min(int(palabras_verticales), 12))
        total = h + v + 4

        nombre_escuela, nombre_materia, division, contenido_minimo, bibliografia = \
            _datos_escuela_materia(id_escuela, id_curso)

        SYSTEM_PROMPT_CRUCIGRAMA = f"""
        Sos un asistente pedagógico. A partir del contenido proporcionado, identificá los
        conceptos importantes y devolvé EXCLUSIVAMENTE un JSON válido con esta forma:
        {{
          "palabras": [
            {{"palabra": "PALABRA1", "pista": "Definición breve sin nombrar la palabra"}}
          ]
        }}
        Reglas:
        - Exactamente {total} pares palabra/pista distintos.
        - "palabra": una sola, MAYÚSCULAS, sin tildes ni Ñ (usá N), 4 a 12 letras.
        - "pista": una sola oración corta tipo definición de diccionario, NO incluir la palabra ni un derivado evidente.
        - Sin repetidos.
        """

        prompt_personalizado = (
            f"Generá {total} pares palabra/pista para armar un crucigrama. "
            f"Materia: '{nombre_materia}'. Tema: '{tema or 'general'}'."
        )

        datos_json = await _generar_json_ia(
            file, prompt_personalizado, SYSTEM_PROMPT_CRUCIGRAMA,
            id_docente, contenido_minimo, bibliografia,
        )

        items = []
        for it in (datos_json or {}).get("palabras", []):
            p = _normalizar(it.get("palabra", ""))
            pista = (it.get("pista") or "").strip()
            if 4 <= len(p) <= 12 and pista:
                items.append({"palabra": p, "pista": pista})

        if len(items) < 4:
            raise HTTPException(status_code=400, detail="No se pudieron extraer suficientes palabras.")

        grilla, horizontales, verticales = _armar_crucigrama(items, h, v)

        if not horizontales and not verticales:
            raise HTTPException(status_code=400, detail="No se pudo armar el crucigrama. Probá con otro tema o PDF.")

        pdf_bytes = _renderizar_pdf_crucigrama(
            tema=tema or "Crucigrama",
            grilla=grilla,
            horizontales=horizontales,
            verticales=verticales,
            nombre_escuela=nombre_escuela,
            nombre_materia=nombre_materia,
            division=division,
            fecha=fecha,
            nombre_alumno=nombre_alumno,
        )

        nombre_archivo = f"Crucigrama_{nombre_escuela}_{nombre_materia}".replace(" ", "_")
        return await process_and_upload(
            pdf_bytes, nombre_archivo, tema, "pdf", id_docente, "CRUCIGRAMA",
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"DEBUG ERROR CRUCIGRAMA: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ── armado del crucigrama ───────────────────────────────────────────────────

def _armar_crucigrama(items, max_h, max_v):
    items = sorted(items, key=lambda x: -len(x["palabra"]))
    N = 30
    grilla = [["" for _ in range(N)] for _ in range(N)]
    placements = []

    primera = items[0]
    r0 = N // 2
    c0 = (N - len(primera["palabra"])) // 2
    for i, ch in enumerate(primera["palabra"]):
        grilla[r0][c0 + i] = ch
    placements.append({**primera, "r": r0, "c": c0, "dir": "H"})
    h_count, v_count = 1, 0

    for it in items[1:]:
        if h_count >= max_h and v_count >= max_v:
            break
        w = it["palabra"]; colocada = False
        for p in placements:
            if colocada: break
            for i, ch in enumerate(p["palabra"]):
                if colocada: break
                pr = p["r"] if p["dir"] == "H" else p["r"] + i
                pc = p["c"] + i if p["dir"] == "H" else p["c"]
                for j, ch2 in enumerate(w):
                    if ch != ch2: continue
                    nueva_dir = "V" if p["dir"] == "H" else "H"
                    if nueva_dir == "V" and v_count >= max_v: continue
                    if nueva_dir == "H" and h_count >= max_h: continue
                    if nueva_dir == "V":
                        nr, nc, dr, dc = pr - j, pc, 1, 0
                    else:
                        nr, nc, dr, dc = pr, pc - j, 0, 1
                    if not _valida_cruce(grilla, w, nr, nc, dr, dc, N): continue
                    for k, c in enumerate(w):
                        grilla[nr + dr*k][nc + dc*k] = c
                    placements.append({**it, "r": nr, "c": nc, "dir": nueva_dir})
                    if nueva_dir == "H": h_count += 1
                    else: v_count += 1
                    colocada = True
                    break

    rs  = [p["r"] for p in placements]
    re_ = [p["r"] + (len(p["palabra"])-1 if p["dir"] == "V" else 0) for p in placements]
    cs  = [p["c"] for p in placements]
    ce  = [p["c"] + (len(p["palabra"])-1 if p["dir"] == "H" else 0) for p in placements]
    rmin, rmax = min(rs), max(re_)
    cmin, cmax = min(cs), max(ce)
    nueva = [grilla[r][cmin:cmax+1] for r in range(rmin, rmax+1)]
    for p in placements:
        p["r"] -= rmin; p["c"] -= cmin

    seen = {}
    for p in sorted(placements, key=lambda x: (x["r"], x["c"])):
        key = (p["r"], p["c"])
        if key not in seen:
            seen[key] = len(seen) + 1
        p["num"] = seen[key]

    horiz = sorted([p for p in placements if p["dir"] == "H"], key=lambda x: x["num"])
    vert  = sorted([p for p in placements if p["dir"] == "V"], key=lambda x: x["num"])
    return nueva, horiz, vert


def _valida_cruce(grilla, w, r, c, dr, dc, N):
    if not (0 <= r < N and 0 <= c < N): return False
    r_fin = r + dr*(len(w)-1); c_fin = c + dc*(len(w)-1)
    if not (0 <= r_fin < N and 0 <= c_fin < N): return False
    for i, ch in enumerate(w):
        rr, cc = r + dr*i, c + dc*i
        actual = grilla[rr][cc]
        if actual not in ("", ch): return False
        if actual == ch: continue
        if dr == 0:
            if rr-1 >= 0 and grilla[rr-1][cc] != "": return False
            if rr+1 < N and grilla[rr+1][cc] != "": return False
        else:
            if cc-1 >= 0 and grilla[rr][cc-1] != "": return False
            if cc+1 < N and grilla[rr][cc+1] != "": return False
    r_prev, c_prev = r - dr, c - dc
    if 0 <= r_prev < N and 0 <= c_prev < N and grilla[r_prev][c_prev] != "": return False
    r_next, c_next = r + dr*len(w), c + dc*len(w)
    if 0 <= r_next < N and 0 <= c_next < N and grilla[r_next][c_next] != "": return False
    return True


# ── render del PDF ───────────────────────────────────────────────────────────

def _renderizar_pdf_crucigrama(tema, grilla, horizontales, verticales,
                                nombre_escuela, nombre_materia, division, fecha, nombre_alumno):
    buf = io.BytesIO()
    c = pdfcanvas.Canvas(buf, pagesize=A4)
    width, height = A4

    # Encabezado institucional
    y_after_header = _dibujar_encabezado_pdf(
        c, width, height, nombre_escuela, nombre_materia, division, fecha, nombre_alumno
    )

    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width/2, y_after_header, f"Crucigrama: {tema}")
    y_after_header -= 0.6*cm

    rows = len(grilla); cols = len(grilla[0]) if grilla else 0
    available_h = y_after_header - 2*cm
    cell = min(0.8*cm, (width - 4*cm)/max(cols, 1), available_h/max(rows, 1))
    grid_w = cell*cols; grid_h = cell*rows
    x0 = (width - grid_w)/2
    y0 = y_after_header - grid_h
    nums = {(p["r"], p["c"]): p["num"] for p in horizontales + verticales}

    num_size = max(5, int(cell * 0.28))
    for r in range(rows):
        for col in range(cols):
            x = x0 + col*cell
            y = y0 + (rows-1-r)*cell
            if grilla[r][col] == "":
                c.setFillGray(0.25); c.rect(x, y, cell, cell, stroke=1, fill=1); c.setFillGray(0)
            else:
                c.rect(x, y, cell, cell, stroke=1, fill=0)
                if (r, col) in nums:
                    c.setFont("Helvetica", num_size)
                    c.drawString(x + 1.5, y + cell - num_size - 1, str(nums[(r, col)]))

    y_pistas = y0 - 1*cm

    def _seccion(titulo, lista):
        nonlocal y_pistas
        if y_pistas < 3*cm:
            c.showPage(); y_pistas = height - 2*cm
        c.setFont("Helvetica-Bold", 12)
        c.drawString(2*cm, y_pistas, titulo); y_pistas -= 0.5*cm
        c.setFont("Helvetica", 10)
        for p in lista:
            for linea in _wrap_text(f"{p['num']}. {p['pista']}", 95):
                if y_pistas < 2*cm:
                    c.showPage(); y_pistas = height - 2*cm; c.setFont("Helvetica", 10)
                c.drawString(2*cm, y_pistas, linea); y_pistas -= 0.4*cm
        y_pistas -= 0.3*cm

    _seccion("Horizontales:", horizontales)
    _seccion("Verticales:", verticales)
    c.showPage(); c.save()
    return buf.getvalue()
