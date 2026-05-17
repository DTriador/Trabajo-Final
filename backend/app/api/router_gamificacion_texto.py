# backend/app/api/router_gamificacion_texto.py
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from app.services.rag_orchestrator import RAGOrchestrator
from app.services.activities_service import activities_service
from app.api.generacion_utils import process_and_upload
import io, random
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.lib.units import cm

router = APIRouter()

# ── helper local ──────────────────────────────────────────────────────────────

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


# ── actividad: emparejar (delegada al service) ────────────────────────────────

@router.post("/actividad/emparejar")
async def generar_emparejamiento(items_izquierda: list[str], items_derecha: list[str]):
    try:
        return await activities_service.generar_emparejamiento(items_izquierda, items_derecha)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── ordenar frase ─────────────────────────────────────────────────────────────

@router.post("/ordenar_frase")
async def generar_ordenar_frase(
    id_docente: str = Form(...),
    tema: str = Form(""),
    numero_frases: int = Form(6),
    file: UploadFile = File(...),
):
    try:
        n = max(3, min(int(numero_frases), 15))

        SYSTEM_PROMPT_ORDENAR = f"""
        Sos un asistente pedagógico. A partir del documento adjunto, identificá las
        ideas principales y devolvé EXCLUSIVAMENTE un JSON válido con esta forma:
        {{
          "frases": [
            {{"frase_original": "Oración completa y correcta extraída del texto"}}
          ]
        }}
        Reglas:
        - Exactamente {n} frases distintas.
        - Cada frase debe ser una oración completa, con sentido propio, entre 6 y 16 palabras.
        - Extraelas del documento; no inventes contenido.
        - Sin repetidos.
        """

        prompt_personalizado = (
            f"Extraé {n} oraciones clave del documento para una actividad de ordenar palabras. "
            f"Tema indicado por el docente: '{tema or 'general'}'."
        )

        pdf_content = await file.read()
        datos_json = await RAGOrchestrator.get_context_from_file_and_generate(
            pdf_content, prompt_personalizado, SYSTEM_PROMPT_ORDENAR,
            id_docente=id_docente,  # ← fix
        )

        frases = []
        for it in (datos_json or {}).get("frases", []):
            f = (it.get("frase_original") or "").strip()
            palabras = f.split()
            if 6 <= len(palabras) <= 16:
                mezclada = palabras[:]
                for _ in range(50):
                    random.shuffle(mezclada)
                    if mezclada != palabras:
                        break
                frases.append({"original": f, "mezclada": mezclada})

        if len(frases) < 3:
            raise HTTPException(status_code=400, detail="No se pudieron extraer suficientes frases del PDF.")

        pdf_bytes = _renderizar_pdf_ordenar_frase(tema=tema or "Ordenar la frase", frases=frases)

        return await process_and_upload(
            pdf_bytes, f"OrdenarFrase_{tema or 'sin_tema'}", tema, "pdf", id_docente, "ORDENAR_FRASE",
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"DEBUG ERROR ORDENAR FRASE: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def _renderizar_pdf_ordenar_frase(tema, frases):
    buf = io.BytesIO()
    c = pdfcanvas.Canvas(buf, pagesize=A4)
    width, height = A4

    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(width / 2, height - 2 * cm, f"Ordenar la frase: {tema}")
    c.setFont("Helvetica-Oblique", 11)
    c.drawCentredString(width / 2, height - 2.7 * cm, "Escribí las palabras en el orden correcto para formar la oración.")

    y = height - 4 * cm

    for i, item in enumerate(frases):
        mezclada = item["mezclada"]

        if y < 4 * cm:
            c.showPage()
            y = height - 2 * cm

        c.setFont("Helvetica-Bold", 12)
        c.drawString(2 * cm, y, f"{i + 1}.")
        y -= 0.6 * cm

        x = 2 * cm
        ficha_h   = 0.8 * cm
        ficha_gap = 0.3 * cm

        for palabra in mezclada:
            ficha_w = max(1.8 * cm, len(palabra) * 0.22 * cm + 0.4 * cm)

            if x + ficha_w > width - 2 * cm:
                x = 2 * cm
                y -= ficha_h + ficha_gap

            if y < 3 * cm:
                c.showPage()
                y = height - 2 * cm
                x = 2 * cm

            c.setStrokeColorRGB(0.30, 0.55, 0.85)
            c.setFillColorRGB(0.90, 0.95, 1.00)
            c.roundRect(x, y - ficha_h, ficha_w, ficha_h, 6, stroke=1, fill=1)
            c.setFillColorRGB(0, 0, 0)
            c.setFont("Helvetica-Bold", 11)
            c.drawCentredString(x + ficha_w / 2, y - ficha_h + 0.22 * cm, palabra)

            x += ficha_w + ficha_gap

        y -= ficha_h + 0.8 * cm
        if y < 3 * cm:
            c.showPage()
            y = height - 2 * cm

        c.setStrokeColorRGB(0.7, 0.7, 0.7)
        c.setLineWidth(0.8)
        c.line(2 * cm, y, width - 2 * cm, y)
        y -= 1.2 * cm

    c.showPage()
    c.save()
    return buf.getvalue()


# ── completar texto ───────────────────────────────────────────────────────────

@router.post("/completar_texto")
async def generar_completar_texto(
    id_docente: str = Form(...),
    tema: str = Form(""),
    numero_oraciones: int = Form(6),
    file: UploadFile = File(...),
):
    try:
        n = max(3, min(int(numero_oraciones), 15))

        SYSTEM_PROMPT_COMPLETAR = f"""
        Sos un asistente pedagógico. A partir del documento adjunto, generá oraciones
        con una palabra clave faltante y devolvé EXCLUSIVAMENTE un JSON válido con esta forma:
        {{
          "oraciones": [
            {{
              "con_hueco": "El fotosíntesis ocurre en los _______.",
              "palabra_clave": "cloroplastos"
            }}
          ]
        }}
        Reglas:
        - Exactamente {n} oraciones distintas.
        - "con_hueco": oración con exactamente UN hueco marcado como "_______" (7 guiones bajos).
        - "palabra_clave": la única palabra que completa el hueco (1 a 3 palabras).
        - Las oraciones deben provenir del documento; no inventes contenido.
        - El hueco debe reemplazar un concepto clave, no una palabra trivial.
        - Sin repetidos.
        """

        prompt_personalizado = (
            f"Generá {n} oraciones con huecos para una actividad de completar el texto. "
            f"Tema indicado por el docente: '{tema or 'general'}'."
        )

        pdf_content = await file.read()
        datos_json = await RAGOrchestrator.get_context_from_file_and_generate(
            pdf_content, prompt_personalizado, SYSTEM_PROMPT_COMPLETAR,
            id_docente=id_docente,  # ← fix
        )

        oraciones = []
        for it in (datos_json or {}).get("oraciones", []):
            hueco = (it.get("con_hueco") or "").strip()
            clave = (it.get("palabra_clave") or "").strip()
            if hueco and clave and "_______" in hueco:
                oraciones.append({"con_hueco": hueco, "palabra_clave": clave})

        if len(oraciones) < 3:
            raise HTTPException(status_code=400, detail="No se pudieron extraer suficientes oraciones del PDF.")

        pdf_bytes = _renderizar_pdf_completar_texto(tema=tema or "Completar el texto", oraciones=oraciones)

        return await process_and_upload(
            pdf_bytes, f"CompletarTexto_{tema or 'sin_tema'}", tema, "pdf", id_docente, "COMPLETAR_TEXTO",
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"DEBUG ERROR COMPLETAR TEXTO: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def _renderizar_pdf_completar_texto(tema, oraciones):
    buf = io.BytesIO()
    c = pdfcanvas.Canvas(buf, pagesize=A4)
    width, height = A4

    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(width / 2, height - 2 * cm, f"Completar el texto: {tema}")
    c.setFont("Helvetica-Oblique", 11)
    c.drawCentredString(width / 2, height - 2.7 * cm, "Escribí la palabra que falta en cada oración.")

    palabras_banco  = [o["palabra_clave"] for o in oraciones]
    banco_mezclado  = palabras_banco[:]
    for _ in range(50):
        random.shuffle(banco_mezclado)
        if banco_mezclado != palabras_banco:
            break

    y = height - 3.8 * cm
    c.setFont("Helvetica-Bold", 11)
    c.drawString(2 * cm, y, "Banco de palabras:")
    y -= 0.6 * cm

    x = 2 * cm
    ficha_h = 0.75 * cm
    for palabra in banco_mezclado:
        ficha_w = max(2 * cm, len(palabra) * 0.22 * cm + 0.5 * cm)
        if x + ficha_w > width - 2 * cm:
            x = 2 * cm
            y -= ficha_h + 0.3 * cm
        c.setStrokeColorRGB(0.85, 0.45, 0.65)
        c.setFillColorRGB(1.00, 0.93, 0.97)
        c.roundRect(x, y - ficha_h, ficha_w, ficha_h, 6, stroke=1, fill=1)
        c.setFillColorRGB(0, 0, 0)
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(x + ficha_w / 2, y - ficha_h + 0.2 * cm, palabra)
        x += ficha_w + 0.3 * cm

    y -= ficha_h + 0.9 * cm

    c.setFont("Helvetica", 12)
    for i, item in enumerate(oraciones):
        if y < 3 * cm:
            c.showPage()
            y = height - 2 * cm
            c.setFont("Helvetica", 12)

        lineas = _wrap_text(f"{i + 1}. {item['con_hueco']}", 85)
        for linea in lineas:
            c.drawString(2 * cm, y, linea)
            y -= 0.55 * cm
        y -= 0.4 * cm

    c.showPage()
    c.save()
    return buf.getvalue()


# ── verdadero y falso ─────────────────────────────────────────────────────────

@router.post("/verdadero_falso")
async def generar_verdadero_falso(
    id_docente: str = Form(...),
    tema: str = Form(""),
    numero_enunciados: int = Form(8),
    file: UploadFile = File(...),
):
    try:
        n = max(4, min(int(numero_enunciados), 20))

        SYSTEM_PROMPT_VF = f"""
        Sos un asistente pedagógico. A partir del documento adjunto, generá enunciados
        para una actividad de Verdadero o Falso y devolvé EXCLUSIVAMENTE un JSON válido con esta forma:
        {{
          "enunciados": [
            {{
              "enunciado": "El texto del enunciado aquí.",
              "es_verdadero": true,
              "justificacion": "Breve explicación de por qué es verdadero o falso."
            }}
          ]
        }}
        Reglas:
        - Exactamente {n} enunciados distintos.
        - Al menos el 40% deben ser FALSOS (es_verdadero: false).
        - Los falsos deben tener un error sutil, no obvio.
        - "justificacion": máximo 2 oraciones, útil para que el docente corrija.
        - Basate siempre en el contenido del documento.
        - Sin repetidos.
        """

        prompt_personalizado = (
            f"Generá {n} enunciados de Verdadero o Falso basados en el documento. "
            f"Tema indicado por el docente: '{tema or 'general'}'."
        )

        pdf_content = await file.read()
        datos_json = await RAGOrchestrator.get_context_from_file_and_generate(
            pdf_content, prompt_personalizado, SYSTEM_PROMPT_VF,
            id_docente=id_docente,  # ← fix
        )

        enunciados = []
        for it in (datos_json or {}).get("enunciados", []):
            texto = (it.get("enunciado") or "").strip()
            es_v  = it.get("es_verdadero", True)
            just  = (it.get("justificacion") or "").strip()
            if texto:
                enunciados.append({
                    "enunciado":     texto,
                    "es_verdadero":  bool(es_v),
                    "justificacion": just,
                })

        if len(enunciados) < 4:
            raise HTTPException(status_code=400, detail="No se pudieron extraer suficientes enunciados del PDF.")

        pdf_alumno  = _renderizar_pdf_vf(tema=tema or "Verdadero o Falso", enunciados=enunciados, mostrar_respuestas=False)
        pdf_docente = _renderizar_pdf_vf(tema=tema or "Verdadero o Falso", enunciados=enunciados, mostrar_respuestas=True)

        await process_and_upload(
            pdf_docente, f"VF_Docente_{tema or 'sin_tema'}", tema, "pdf", id_docente, "VF_DOCENTE",
        )
        return await process_and_upload(
            pdf_alumno, f"VF_Alumno_{tema or 'sin_tema'}", tema, "pdf", id_docente, "VF_ALUMNO",
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"DEBUG ERROR VERDADERO FALSO: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def _renderizar_pdf_vf(tema, enunciados, mostrar_respuestas: bool):
    buf = io.BytesIO()
    c = pdfcanvas.Canvas(buf, pagesize=A4)
    width, height = A4

    sufijo = "(Copia docente — con respuestas)" if mostrar_respuestas else ""
    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(width / 2, height - 2 * cm, f"Verdadero o Falso: {tema}")
    if sufijo:
        c.setFont("Helvetica-Oblique", 10)
        c.drawCentredString(width / 2, height - 2.6 * cm, sufijo)

    instruccion = (
        "Indicá con una ✓ si el enunciado es Verdadero (V) o Falso (F)."
        if not mostrar_respuestas
        else "Respuestas correctas y justificación para el docente."
    )
    c.setFont("Helvetica-Oblique", 11)
    c.drawCentredString(width / 2, height - 3.1 * cm, instruccion)

    y        = height - 4.2 * cm
    row_gap  = 0.35 * cm
    box_size = 0.6 * cm

    for i, item in enumerate(enunciados):
        if y < 3.5 * cm:
            c.showPage()
            y = height - 2 * cm

        c.setFont("Helvetica-Bold", 12)
        c.drawString(1.5 * cm, y, f"{i + 1}.")

        c.setFont("Helvetica", 11)
        lineas = _wrap_text(item["enunciado"], 80)
        for j, linea in enumerate(lineas):
            c.drawString(2.5 * cm, y - j * 0.5 * cm, linea)
        texto_h = len(lineas) * 0.5 * cm

        vf_x = width - 4.5 * cm
        vf_y = y - (texto_h / 2) + box_size / 2

        for label, color_rgb in [("V", (0.20, 0.70, 0.40)), ("F", (0.85, 0.25, 0.25))]:
            c.setStrokeColorRGB(*color_rgb)
            c.setLineWidth(1.8)

            if mostrar_respuestas:
                es_correcta = (label == "V" and item["es_verdadero"]) or \
                              (label == "F" and not item["es_verdadero"])
                c.setFillColorRGB(*(0.85, 0.97, 0.88) if es_correcta else (1, 1, 1))
            else:
                c.setFillColorRGB(1, 1, 1)

            c.roundRect(vf_x, vf_y - box_size, box_size, box_size, 4, stroke=1, fill=1)
            c.setFillColorRGB(*color_rgb)
            c.setFont("Helvetica-Bold", 10)
            c.drawCentredString(vf_x + box_size / 2, vf_y - box_size + 0.15 * cm, label)
            vf_x += box_size + 0.4 * cm

        y -= texto_h + row_gap

        if mostrar_respuestas and item.get("justificacion"):
            c.setFont("Helvetica-Oblique", 9)
            c.setFillColorRGB(0.4, 0.4, 0.4)
            for linea in _wrap_text(f"↳ {item['justificacion']}", 90):
                if y < 2.5 * cm:
                    c.showPage(); y = height - 2 * cm
                c.drawString(2.5 * cm, y, linea)
                y -= 0.42 * cm
            c.setFillColorRGB(0, 0, 0)
            y -= 0.2 * cm

        y -= 0.3 * cm

    c.showPage()
    c.save()
    return buf.getvalue()