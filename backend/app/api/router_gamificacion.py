# backend/app/api/router_gamificacion_cuadricula.py
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional
from app.services.rag_orchestrator import RAGOrchestrator
from app.api.generacion_utils import process_and_upload
from app.core.database import supabase
import io, re, random
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.lib.units import cm

router = APIRouter()

# ── helpers compartidos ───────────────────────────────────────────────────────

def _normalizar(p: str) -> str:
    p = (p or "").upper().strip()
    repl = {"Á":"A","É":"E","Í":"I","Ó":"O","Ú":"U","Ü":"U","Ñ":"N"}
    for k, v in repl.items():
        p = p.replace(k, v)
    return re.sub(r"[^A-Z]", "", p)

def _wrap_text(text, ancho):
    palabras = (text or "").split()
    lineas, actual = [], ""
    for p in palabras:
        if len(actual) + len(p) + 1 <= ancho:
            actual = (actual + " " + p).strip()
        else:
            lineas.append(actual); actual = p
    if actual: lineas.append(actual)
    return lineas


def _datos_escuela_materia(id_escuela: Optional[str], id_curso: Optional[str]):
    """Devuelve (nombre_escuela, nombre_materia, division, contenido_minimo, bibliografia)."""
    nombre_escuela   = "Institución Educativa"
    nombre_materia   = "Materia General"
    division         = "-"
    contenido_minimo = ""
    bibliografia     = []

    if id_escuela:
        try:
            res = supabase.table("escuelas").select("nombre_escuela").eq("id_escuela", id_escuela).single().execute()
            nombre_escuela = (res.data or {}).get("nombre_escuela", nombre_escuela)
        except Exception as e:
            print(f"⚠️ No pude obtener escuela: {e}")

    if id_curso:
        try:
            res = supabase.table("cursos").select(
                "nombre_materia,division,contenido_minimo,bibliografia"
            ).eq("id_curso", id_curso).single().execute()
            if res.data:
                nombre_materia   = res.data.get("nombre_materia",   nombre_materia)
                division         = res.data.get("division",         division)
                contenido_minimo = res.data.get("contenido_minimo", "") or ""
                bibliografia     = res.data.get("bibliografia",     []) or []
        except Exception as e:
            print(f"⚠️ No pude obtener curso: {e}")

    return nombre_escuela, nombre_materia, division, contenido_minimo, bibliografia


def _contexto_biblio(contenido_minimo: str, bibliografia: list) -> str:
    """Arma el texto de contexto cuando no hay PDF."""
    partes = []
    if contenido_minimo:
        partes.append(f"Contenido mínimo de la materia:\n{contenido_minimo}")
    if bibliografia:
        items = [b if isinstance(b, str) else str(b) for b in bibliografia]
        partes.append("Bibliografía:\n" + "\n".join(f"- {i}" for i in items))
    return "\n\n".join(partes) if partes else "Sin contenido específico. Generá basándote en el tema indicado."


def _dibujar_encabezado_pdf(c, width, height, nombre_escuela, nombre_materia, division, fecha, nombre_alumno):
    """
    Dibuja el encabezado institucional en la primera página del PDF.
    Devuelve la coordenada Y donde termina el encabezado para que el contenido empiece debajo.
    """
    y = height - 1.2*cm
    c.setFont("Helvetica-Bold", 13)
    c.drawString(1.5*cm, y, nombre_escuela)
    y -= 0.55*cm
    c.setFont("Helvetica", 11)
    c.drawString(1.5*cm, y, f"Materia: {nombre_materia}  |  División: {division}")
    y -= 0.5*cm
    # Mostrar siempre la línea de Fecha; si no hay fecha, dejar espacio en blanco como para el alumno
    fecha_val = fecha if fecha else "_______________________________"
    c.drawString(1.5*cm, y, f"Fecha: {fecha_val}")
    y -= 0.5*cm
    # Campo Nombre del Alumno
    alumno_val = nombre_alumno if nombre_alumno else "_______________________________"
    c.setFont("Helvetica-Bold", 11)
    c.drawString(1.5*cm, y, "Nombre del Alumno/a: ")
    c.setFont("Helvetica", 11)
    c.drawString(1.5*cm + 5.6*cm, y, alumno_val)
    y -= 0.7*cm
    # Línea separadora
    c.setStrokeGray(0.6)
    c.setLineWidth(0.8)
    c.line(1.5*cm, y, width - 1.5*cm, y)
    y -= 0.4*cm
    return y


# ── crucigrama ────────────────────────────────────────────────────────────────

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

        if file is not None:
            pdf_content = await file.read()
            datos_json = await RAGOrchestrator.get_context_from_file_and_generate(
                pdf_content, prompt_personalizado, SYSTEM_PROMPT_CRUCIGRAMA,
                id_docente=id_docente,
            )
        else:
            ctx = _contexto_biblio(contenido_minimo, bibliografia)
            datos_json = await RAGOrchestrator.get_context_and_generate(
                f"{prompt_personalizado}\n\n{ctx}", SYSTEM_PROMPT_CRUCIGRAMA,
                id_docente=id_docente,
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


# ── unir con flechas ──────────────────────────────────────────────────────────

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

        if file is not None:
            pdf_content = await file.read()
            datos_json = await RAGOrchestrator.get_context_from_file_and_generate(
                pdf_content, prompt_personalizado, SYSTEM_PROMPT_UNIR,
                id_docente=id_docente,
            )
        else:
            ctx = _contexto_biblio(contenido_minimo, bibliografia)
            datos_json = await RAGOrchestrator.get_context_and_generate(
                f"{prompt_personalizado}\n\n{ctx}", SYSTEM_PROMPT_UNIR,
                id_docente=id_docente,
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


# ── sopa de letras ────────────────────────────────────────────────────────────

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

        if file is not None:
            pdf_content = await file.read()
            datos_json = await RAGOrchestrator.get_context_from_file_and_generate(
                pdf_content, prompt_personalizado, SYSTEM_PROMPT_SOPA,
                id_docente=id_docente,
            )
        else:
            ctx = _contexto_biblio(contenido_minimo, bibliografia)
            datos_json = await RAGOrchestrator.get_context_and_generate(
                f"{prompt_personalizado}\n\n{ctx}", SYSTEM_PROMPT_SOPA,
                id_docente=id_docente,
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


def _renderizar_pdf_sopa(tema, grilla, palabras, mostrar_lista, resumen,
                          nombre_escuela, nombre_materia, division, fecha, nombre_alumno):
    buf = io.BytesIO()
    c = pdfcanvas.Canvas(buf, pagesize=A4)
    width, height = A4

    y_start = _dibujar_encabezado_pdf(
        c, width, height, nombre_escuela, nombre_materia, division, fecha, nombre_alumno
    )

    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width/2, y_start, f"Sopa de letras: {tema}")
    y_start -= 0.5*cm

    if resumen:
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
    c.setFont("Helvetica-Bold", font_size)
    for r in range(N):
        for col in range(N):
            x = x0 + col*cell
            y = y0 + (N-1-r)*cell
            c.rect(x, y, cell, cell, stroke=1, fill=0)
            c.drawCentredString(x + cell/2, y + (cell - font_size) / 2 + 1, grilla[r][col])
    if mostrar_lista and palabras:
        c.setFont("Helvetica-Bold", 12)
        c.drawString(2*cm, y0 - 1.2*cm, "Palabras a buscar:")
        c.setFont("Helvetica", 11)
        cols = 3
        por_col = (len(palabras) + cols - 1)//cols
        for i, p in enumerate(palabras):
            col = i // por_col; fila = i % por_col
            c.drawString(2*cm + col*6*cm, y0 - 1.8*cm - fila*0.5*cm, f"• {p}")
    c.showPage(); c.save()
    return buf.getvalue()