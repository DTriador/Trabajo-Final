# backend/app/api/contenido_generadores.py
"""
Lógica de generación de cada tipo de documento (llamada a la IA + armado
del .docx / .pptx en memoria). Extraído sin cambios de lógica desde
router_contenido.py: cada función de acá es el "cuerpo" que antes vivía
pegado dentro del endpoint correspondiente. Los endpoints en
router_contenido.py ahora solo parsean el Form, llaman a la función acá
definida, y suben el archivo con process_and_upload (o, en el caso de
presentación, arman la respuesta final).
"""
import os
import re
import json
import uuid
from io import BytesIO
from typing import Optional
from datetime import datetime

from fastapi import HTTPException, UploadFile
from pptx import Presentation
from pptx.util import Inches, Pt

from app.core.database import supabase
from app.services.rag_orchestrator import RAGOrchestrator
from app.api.contenido_helpers import _datos_escuela_materia, _contexto_biblio, _encabezado_documento


# ── apunte ────────────────────────────────────────────────────────────────────

async def generar_apunte_docx(
    tema: str,
    id_docente: str,
    file: Optional[UploadFile],
    id_escuela: Optional[str],
    id_curso: Optional[str],
    fecha: Optional[str],
):
    """Genera el .docx de un apunte. Devuelve (bytes, nombre_archivo)."""
    from docx import Document

    nombre_escuela, nombre_materia, division, contenido_minimo, bibliografia = \
        _datos_escuela_materia(id_escuela, id_curso)

    SYSTEM_PROMPT_APUNTE = """
    Sos un asistente pedagógico experto en sintetizar material académico.
    A partir del contenido proporcionado, generá un APUNTE de estudio claro,
    enfocado en el tema indicado, listo para que un alumno lo use para repasar.

    Devolvé EXCLUSIVAMENTE un JSON válido con esta estructura:
    {
      "titulo": "Título del apunte",
      "introduccion": "Párrafo breve que contextualiza el tema",
      "secciones": [
        {
          "subtitulo": "Nombre de la sección",
          "contenido": "Explicación clara y desarrollada del concepto",
          "puntos_clave": ["idea 1", "idea 2", "idea 3"]
        }
      ],
      "glosario": [
        {"termino": "Concepto", "definicion": "Definición breve"}
      ],
      "conclusion": "Cierre con las ideas más importantes para recordar"
    }
    Mínimo 4 secciones y 5 términos en el glosario.
    """

    prompt_base = (
        f"Generá un APUNTE / RESUMEN de estudio sobre el tema '{tema}' "
        f"para la materia '{nombre_materia}' de '{nombre_escuela}'."
    )

    if file is not None:
        pdf_content = await file.read()
        datos_json = await RAGOrchestrator.get_context_from_file_and_generate(
            pdf_content, prompt_base, SYSTEM_PROMPT_APUNTE, id_docente=id_docente
        )
    else:
        ctx = _contexto_biblio(contenido_minimo, bibliografia)
        datos_json = await RAGOrchestrator.get_context_and_generate(
            f"{prompt_base}\n\n{ctx}", SYSTEM_PROMPT_APUNTE, id_docente=id_docente
        )

    doc = Document()
    _encabezado_documento(doc, "Apunte", nombre_materia, tema, nombre_escuela, fecha_str=fecha)

    if datos_json.get("introduccion"):
        doc.add_heading("Introducción", level=1)
        doc.add_paragraph(datos_json["introduccion"])

    for seccion in datos_json.get("secciones", []):
        doc.add_heading(seccion.get("subtitulo", "Sección"), level=1)
        if seccion.get("contenido"):
            doc.add_paragraph(seccion["contenido"])
        for punto in seccion.get("puntos_clave", []):
            doc.add_paragraph(punto, style="List Bullet")

    if datos_json.get("glosario"):
        doc.add_heading("Glosario", level=1)
        for item in datos_json["glosario"]:
            p = doc.add_paragraph()
            p.add_run(f"{item.get('termino', '')}: ").bold = True
            p.add_run(item.get("definicion", ""))

    if datos_json.get("conclusion"):
        doc.add_heading("Conclusión", level=1)
        doc.add_paragraph(datos_json["conclusion"])

    buffer = BytesIO()
    doc.save(buffer)
    buffer.seek(0)

    nombre_archivo = f"Apunte_{nombre_escuela}_{nombre_materia}".replace(" ", "_")
    return buffer.getvalue(), nombre_archivo


# ── preguntas guía ────────────────────────────────────────────────────────────

async def generar_preguntas_docx(
    tema: str,
    id_docente: str,
    nombre_guia: str,
    numero_preguntas: int,
    file: Optional[UploadFile],
    id_escuela: Optional[str],
    id_curso: Optional[str],
    fecha: Optional[str],
):
    """Genera el .docx de una guía de preguntas. Devuelve (bytes, nombre_archivo)."""
    from docx import Document

    if numero_preguntas < 1 or numero_preguntas > 25:
        raise HTTPException(status_code=400, detail="La cantidad de preguntas debe estar entre 1 y 25.")

    nombre_escuela, nombre_materia, division, contenido_minimo, bibliografia = \
        _datos_escuela_materia(id_escuela, id_curso)

    SYSTEM_PROMPT_PREGUNTAS = f"""
    Sos un asistente pedagógico experto en generar guías de preguntas
    a partir de un material de lectura.

    Generá EXACTAMENTE {numero_preguntas} preguntas guía sobre el tema indicado.
    Combiná preguntas de comprensión literal, de análisis y de reflexión.
    No inventes contenido que no esté en el material provisto.

    IMPORTANTE: Devolvé EXCLUSIVAMENTE un JSON válido. Estructura EXACTA:
    {{
      "titulo": "Título de la guía",
      "introduccion": "Indicaciones breves para el alumno",
      "preguntas": [
        {{"numero": 1, "pregunta": "Texto de la pregunta", "respuesta_sugerida": "Respuesta orientativa"}}
      ]
    }}
    El array 'preguntas' debe tener EXACTAMENTE {numero_preguntas} elementos.
    """

    prompt_base = (
        f"Generá una guía de {numero_preguntas} preguntas sobre el tema '{tema}' "
        f"para la materia '{nombre_materia}' de '{nombre_escuela}'."
    )

    if file is not None:
        pdf_content = await file.read()
        if not pdf_content:
            raise HTTPException(status_code=400, detail="El PDF está vacío.")
        datos_json = await RAGOrchestrator.get_context_from_file_and_generate(
            pdf_content, prompt_base, SYSTEM_PROMPT_PREGUNTAS, id_docente=id_docente
        )
    else:
        ctx = _contexto_biblio(contenido_minimo, bibliografia)
        datos_json = await RAGOrchestrator.get_context_and_generate(
            f"{prompt_base}\n\n{ctx}", SYSTEM_PROMPT_PREGUNTAS, id_docente=id_docente
        )

    # Normalización defensiva
    if isinstance(datos_json, str):
        txt = datos_json.strip()
        m = re.search(r"\{.*\}", txt, re.DOTALL)
        if m:
            try:
                datos_json = json.loads(m.group(0))
            except Exception:
                datos_json = {}
    if not isinstance(datos_json, dict):
        datos_json = {}

    preguntas    = datos_json.get("preguntas") or datos_json.get("questions") or datos_json.get("items") or []
    titulo       = datos_json.get("titulo") or datos_json.get("title") or nombre_guia
    introduccion = datos_json.get("introduccion") or datos_json.get("introduction") or ""

    if not preguntas:
        raise HTTPException(
            status_code=500,
            detail=f"El LLM no devolvió preguntas. Respuesta cruda: {str(datos_json)[:300]}"
        )

    doc = Document()
    _encabezado_documento(doc, "Guía de Preguntas", nombre_materia, tema, nombre_escuela, fecha_str=fecha)

    if introduccion:
        doc.add_heading("Indicaciones", level=1)
        doc.add_paragraph(introduccion)

    doc.add_heading("Preguntas", level=1)
    for i, item in enumerate(preguntas, start=1):
        if isinstance(item, dict):
            texto  = item.get("pregunta") or item.get("question") or item.get("texto") or ""
            numero = item.get("numero", i)
        else:
            texto, numero = str(item), i
        p = doc.add_paragraph()
        p.add_run(f"{numero}. ").bold = True
        p.add_run(texto)

    doc.add_page_break()
    doc.add_heading("Respuestas sugeridas (uso docente)", level=1)
    for i, item in enumerate(preguntas, start=1):
        if isinstance(item, dict):
            texto  = item.get("pregunta") or item.get("question") or ""
            resp   = item.get("respuesta_sugerida") or item.get("respuesta") or item.get("answer") or ""
            numero = item.get("numero", i)
        else:
            texto, resp, numero = str(item), "", i
        p = doc.add_paragraph()
        p.add_run(f"{numero}. {texto}\n").bold = True
        p.add_run(resp)

    buffer = BytesIO()
    doc.save(buffer)
    buffer.seek(0)

    nombre_archivo = f"Guia_{nombre_escuela}_{nombre_materia}_{nombre_guia}".replace(" ", "_")
    return buffer.getvalue(), nombre_archivo


# ── examen ────────────────────────────────────────────────────────────────────

async def generar_examen_docx(
    id_docente: str,
    materia: Optional[str],
    fecha_examen: str,
    tipos: str,
    file: Optional[UploadFile],
    id_escuela: Optional[str],
    id_curso: Optional[str],
):
    """Genera el .docx de un examen. Devuelve (bytes, nombre_archivo, nombre_materia)."""
    from docx import Document

    try:
        tipos_dict = json.loads(tipos)
    except Exception:
        raise HTTPException(status_code=400, detail="Formato inválido en 'tipos'.")

    seleccionados = {
        k: v for k, v in tipos_dict.items()
        if v.get("activo") and int(v.get("cantidad", 0)) > 0
    }
    if not seleccionados:
        raise HTTPException(status_code=400, detail="Marcá al menos una actividad con cantidad > 0.")

    # Obtener escuela y materia desde la BD
    nombre_escuela, nombre_materia_db, division, contenido_minimo, bibliografia = \
        _datos_escuela_materia(id_escuela, id_curso)

    # El campo materia del Form tiene prioridad; si no viene, usar el de la BD
    nombre_materia = (materia or "").strip() or nombre_materia_db

    # Bibliografía de fallback cuando no hay PDF
    biblio_str = ""
    if file is None:
        biblio_str = _contexto_biblio(contenido_minimo, bibliografia)

    descripcion_tipos = "\n".join([f"- {k}: {v['cantidad']} ítems" for k, v in seleccionados.items()])

    SYSTEM_PROMPT_EXAMEN = f"""
    Sos un asistente pedagógico experto. Generá un examen escrito sobre la materia '{nombre_materia}'.
    Incluí EXACTAMENTE los siguientes tipos y cantidades:
    {descripcion_tipos}

    Devolvé EXCLUSIVAMENTE un JSON válido (sin markdown):
    {{
      "titulo": "Examen de {nombre_materia}",
      "consignas": [
        {{"tipo": "desarrollo|multiple|completar|verdadero_falso",
          "enunciado": "Texto de la consigna",
          "items": ["item1", "item2", ...]}}
      ]
    }}
    """

    if file is not None:
        prompt = f"Generá el examen de '{nombre_materia}' para la fecha {fecha_examen}, basado en el PDF adjunto."
        pdf_content = await file.read()
        if not pdf_content:
            raise HTTPException(status_code=400, detail="El PDF está vacío.")
        datos_json = await RAGOrchestrator.get_context_from_file_and_generate(
            pdf_content, prompt, SYSTEM_PROMPT_EXAMEN, id_docente=id_docente
        )
    else:
        prompt = (
            f"Generá el examen de '{nombre_materia}' para la fecha {fecha_examen}."
            + (f"\n\n{biblio_str}" if biblio_str else "")
        )
        datos_json = await RAGOrchestrator.get_context_and_generate(
            prompt,
            SYSTEM_PROMPT_EXAMEN,
            id_docente=id_docente,
        )

    if isinstance(datos_json, str):
        m = re.search(r"\{.*\}", datos_json, re.DOTALL)
        if m:
            try:
                datos_json = json.loads(m.group(0))
            except Exception:
                datos_json = {}
    if not isinstance(datos_json, dict):
        datos_json = {}

    consignas  = datos_json.get("consignas") or []
    titulo_doc = datos_json.get("titulo") or f"Examen de {nombre_materia}"

    if not consignas:
        raise HTTPException(status_code=500, detail=f"El LLM no devolvió consignas: {str(datos_json)[:300]}")

    doc = Document()
    _encabezado_documento(
        doc, "Examen", nombre_materia, nombre_materia,
        nombre_escuela, fecha_str=fecha_examen
    )

    doc.add_heading(titulo_doc, level=1)

    for idx, c in enumerate(consignas, start=1):
        tipo      = c.get("tipo", "")
        enunciado = c.get("enunciado", "")
        items     = c.get("items", []) or []
        doc.add_paragraph(f"{idx}) [{tipo}] {enunciado}", style="Heading 3")
        for j, it in enumerate(items, start=1):
            doc.add_paragraph(f"{j}. {it}")

    buffer = BytesIO()
    doc.save(buffer)
    buffer.seek(0)

    nombre_archivo = f"Examen_{nombre_escuela}_{nombre_materia}".replace(" ", "_")
    return buffer.getvalue(), nombre_archivo, nombre_materia


# ── podcast ───────────────────────────────────────────────────────────────────

async def generar_podcast_docx(
    tema: str,
    id_docente: str,
    file: Optional[UploadFile],
    id_escuela: Optional[str],
    id_curso: Optional[str],
    fecha: Optional[str],
):
    """Genera el .docx de un guión de podcast. Devuelve (bytes, nombre_archivo)."""
    from docx import Document

    nombre_escuela, nombre_materia, division, contenido_minimo, bibliografia = \
        _datos_escuela_materia(id_escuela, id_curso)

    SYSTEM_PROMPT_PODCAST = """
    Sos un asistente pedagógico experto en crear guiones de podcast educativo.
    A partir del contenido proporcionado, generá un GUIÓN de podcast completo,
    entretenido y pedagógico, listo para grabar.

    Devolvé EXCLUSIVAMENTE un JSON válido con esta estructura:
    {
      "titulo": "Título del episodio",
      "duracion_estimada": "15-20 minutos",
      "segmentos": [
        {
          "tipo": "introduccion|desarrollo|reflexion|conclusion",
          "titulo": "Nombre del segmento",
          "guion": "Texto completo del segmento con indicaciones entre [corchetes]"
        }
      ]
    }
    Mínimo 4 segmentos. El guión debe ser natural, conversacional y pedagógico.
    """

    prompt_base = (
        f"Generá un guión de podcast educativo sobre el tema '{tema}' "
        f"para la materia '{nombre_materia}' de '{nombre_escuela}'."
    )

    if file is not None:
        pdf_content = await file.read()
        if not pdf_content:
            raise HTTPException(status_code=400, detail="El PDF está vacío.")
        datos_json = await RAGOrchestrator.get_context_from_file_and_generate(
            pdf_content, prompt_base, SYSTEM_PROMPT_PODCAST, id_docente=id_docente
        )
    else:
        ctx = _contexto_biblio(contenido_minimo, bibliografia)
        datos_json = await RAGOrchestrator.get_context_and_generate(
            f"{prompt_base}\n\n{ctx}", SYSTEM_PROMPT_PODCAST, id_docente=id_docente
        )

    # Normalización defensiva
    if isinstance(datos_json, str):
        m = re.search(r"\{.*\}", datos_json, re.DOTALL)
        if m:
            try:
                datos_json = json.loads(m.group(0))
            except Exception:
                datos_json = {}
    if not isinstance(datos_json, dict):
        datos_json = {}

    titulo_ep = datos_json.get("titulo") or f"Podcast: {tema}"
    duracion  = datos_json.get("duracion_estimada") or ""
    segmentos = datos_json.get("segmentos") or []

    if not segmentos:
        raise HTTPException(
            status_code=500,
            detail=f"El LLM no devolvió segmentos. Respuesta cruda: {str(datos_json)[:300]}"
        )

    doc = Document()
    _encabezado_documento(doc, "Podcast", nombre_materia, tema, nombre_escuela, fecha_str=fecha)

    doc.add_heading(titulo_ep, level=1)
    if duracion:
        p_dur = doc.add_paragraph()
        p_dur.add_run("Duración estimada: ").bold = True
        p_dur.add_run(duracion)
    doc.add_paragraph()

    for seg in segmentos:
        tipo_seg   = (seg.get("tipo") or "").upper()
        titulo_seg = seg.get("titulo") or tipo_seg
        guion_seg  = seg.get("guion") or ""
        doc.add_heading(f"[{tipo_seg}] {titulo_seg}", level=2)
        doc.add_paragraph(guion_seg)
        doc.add_paragraph()

    buffer = BytesIO()
    doc.save(buffer)
    buffer.seek(0)

    nombre_archivo = f"Podcast_{nombre_escuela}_{nombre_materia}".replace(" ", "_")
    return buffer.getvalue(), nombre_archivo


# ── presentacion ──────────────────────────────────────────────────────────────

async def generar_presentacion_pptx(tema: str, id_docente: str, file: Optional[UploadFile]):
    """
    Genera un PPTX a partir de un tema y, opcionalmente, un PDF de contexto.
    A diferencia de los generadores anteriores, esta función ya arma la
    respuesta final (no pasa por process_and_upload): sube directo al bucket
    "archivos" y registra en archivos_generados, tal como estaba originalmente.
    Devuelve el dict de respuesta tal cual lo esperaba el endpoint.
    """
    contenido_pdf = ""
    if file:
        try:
            try:
                from PyPDF2 import PdfReader
            except ImportError:
                from pypdf import PdfReader
            pdf_bytes = await file.read()
            temp_path = f"/tmp/{uuid.uuid4()}.pdf"
            with open(temp_path, "wb") as f:
                f.write(pdf_bytes)
            reader = PdfReader(temp_path)
            contenido_pdf = "\n".join([p.extract_text() or "" for p in reader.pages])
            os.remove(temp_path)
        except Exception as e:
            print(f"⚠️ No pude leer el PDF: {e}")
            contenido_pdf = ""

    prs = Presentation()
    prs.slide_width  = Inches(13.33)
    prs.slide_height = Inches(7.5)
    slide = prs.slides.add_slide(prs.slide_layouts[0])
    slide.shapes.title.text = tema
    slide.placeholders[1].text = f"Generado por Kōkua • {datetime.now().strftime('%d/%m/%Y')}"

    if contenido_pdf:
        bloques = [contenido_pdf[i:i+500] for i in range(0, min(len(contenido_pdf), 4000), 500)]
        for i, bloque in enumerate(bloques, start=1):
            s = prs.slides.add_slide(prs.slide_layouts[1])
            s.shapes.title.text = f"{tema} — Parte {i}"
            tf = s.placeholders[1].text_frame
            tf.text = bloque[:450]
            for p in tf.paragraphs:
                for r in p.runs:
                    r.font.size = Pt(16)
    else:
        for titulo_slide in ["Introducción", "Desarrollo", "Conclusión"]:
            s = prs.slides.add_slide(prs.slide_layouts[1])
            s.shapes.title.text = titulo_slide
            s.placeholders[1].text = f"Contenido sobre {tema}…"

    nombre_archivo = f"{tema.replace(' ', '_')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pptx"
    os.makedirs("archivos_generados", exist_ok=True)
    ruta_local = f"archivos_generados/{nombre_archivo}"
    prs.save(ruta_local)

    tamanio_mb = round(os.path.getsize(ruta_local) / (1024 * 1024), 3)

    url_publica = None
    try:
        with open(ruta_local, "rb") as f:
            supabase.storage.from_("archivos").upload(
                f"{id_docente}/{nombre_archivo}",
                f.read(),
                file_options={"content-type": "application/vnd.openxmlformats-officedocument.presentationml.presentation"}
            )
        url_publica = supabase.storage.from_("archivos").get_public_url(f"{id_docente}/{nombre_archivo}")
    except Exception as e:
        print(f"⚠️ No pude subir a Supabase Storage: {e}")
        url_publica = f"/{ruta_local}"

    try:
        supabase.table("archivos_generados").insert({
            "id_docente":      id_docente,
            "nombre_archivo":  nombre_archivo,
            "tipo_formato":    "pptx",
            "sub_tipo":        "presentacion",
            "tema_especifico": tema,
            "prompt_origen":   f"Generar presentación sobre: {tema}",
            "fecha_creacion":  datetime.now().isoformat(),
            "categoria_ia":    "presentacion",
            "url_descarga":    url_publica,
            "uso_mb":          tamanio_mb,
            "descripcion":     f"Presentación generada automáticamente sobre el tema '{tema}'",
        }).execute()
    except Exception as e:
        print(f"⚠️ No pude registrar en BD: {e}")

    return {
        "status":         "success",
        "message":        "Presentación generada con éxito",
        "download_url":   url_publica,
        "nombre_archivo": nombre_archivo,
    }
