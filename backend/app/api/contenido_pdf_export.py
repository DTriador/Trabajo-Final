# backend/app/api/contenido_pdf_export.py
"""
Conversión de un .docx (ya subido a Supabase Storage) a PDF, con 3
estrategias en cascada: LibreOffice → docx2pdf → ReportLab (fallback
garantizado, solo texto). Extraído sin cambios de lógica desde
router_contenido.py.
"""
import shutil
import subprocess
import tempfile
from pathlib import Path
from io import BytesIO

import httpx
from fastapi import HTTPException
from pydantic import BaseModel


class ExportarPDFRequest(BaseModel):
    url_docx:        str   # URL pública de Supabase Storage
    nombre_archivo:  str   # Sin extensión, ej: "Apunte_Fotosintesis"
    id_docente:      str


# ── Detección automática de conversor ────────────────────────────────────────

def _detectar_conversor() -> str:
    """Devuelve: 'libreoffice' | 'docx2pdf' | 'ninguno'"""
    if shutil.which("soffice") or shutil.which("libreoffice"):
        return "libreoffice"
    try:
        import docx2pdf  # noqa: F401
        return "docx2pdf"
    except ImportError:
        pass
    return "ninguno"


# ── Conversores individuales ──────────────────────────────────────────────────

def _con_libreoffice(docx_path: Path, out_dir: Path) -> Path:
    cmd = shutil.which("soffice") or shutil.which("libreoffice")
    result = subprocess.run(
        [cmd, "--headless", "--convert-to", "pdf", "--outdir", str(out_dir), str(docx_path)],
        capture_output=True, text=True, timeout=60,
    )
    if result.returncode != 0:
        raise RuntimeError(f"LibreOffice: {result.stderr}")
    pdf = out_dir / (docx_path.stem + ".pdf")
    if not pdf.exists():
        raise RuntimeError("LibreOffice no generó el PDF")
    return pdf


def _con_docx2pdf(docx_path: Path, out_dir: Path) -> Path:
    from docx2pdf import convert
    pdf = out_dir / (docx_path.stem + ".pdf")
    convert(str(docx_path), str(pdf))
    if not pdf.exists():
        raise RuntimeError("docx2pdf no generó el PDF")
    return pdf


def _con_reportlab(docx_path: Path, out_dir: Path) -> Path:
    """Fallback: extrae texto del .docx y arma un PDF simple con ReportLab."""
    from docx import Document as DocxDoc
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

    pdf = out_dir / (docx_path.stem + ".pdf")
    word   = DocxDoc(str(docx_path))
    styles = getSampleStyleSheet()

    s_titulo  = ParagraphStyle("t1", parent=styles["Heading1"],  fontSize=16, spaceAfter=12)
    s_heading = ParagraphStyle("t2", parent=styles["Heading2"],  fontSize=13, spaceAfter=8)
    s_normal  = ParagraphStyle("no", parent=styles["Normal"],    fontSize=11, spaceAfter=6)

    story = []
    for p in word.paragraphs:
        txt = p.text.strip()
        if not txt:
            story.append(Spacer(1, 0.3 * cm))
            continue
        nombre = (p.style.name or "").lower()
        txt_safe = txt.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        if "heading 1" in nombre or "título 1" in nombre:
            story.append(Paragraph(txt_safe, s_titulo))
        elif "heading" in nombre or "título" in nombre:
            story.append(Paragraph(txt_safe, s_heading))
        else:
            story.append(Paragraph(txt_safe, s_normal))

    SimpleDocTemplate(
        str(pdf), pagesize=A4,
        leftMargin=2.5*cm, rightMargin=2.5*cm,
        topMargin=2.5*cm,  bottomMargin=2.5*cm,
    ).build(story)
    return pdf


# ── Flujo completo: descargar .docx + convertir ───────────────────────────────

async def convertir_docx_url_a_pdf(url_docx: str, nombre_archivo: str):
    """
    Descarga el .docx desde Supabase Storage, lo convierte a PDF
    con el mejor conversor disponible.
    Orden: LibreOffice → docx2pdf → ReportLab (fallback garantizado).
    Devuelve (pdf_bytes, safe_name, conversor_usado).
    """
    conversor = _detectar_conversor()
    print(f"🔧 Conversor PDF detectado: {conversor}")

    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir   = Path(tmp)
        safe_name = nombre_archivo.replace(" ", "_").replace("/", "-")
        docx_path = tmp_dir / f"{safe_name}.docx"

        # 1. Descargar .docx desde Supabase Storage
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(url_docx)
                resp.raise_for_status()
                docx_path.write_bytes(resp.content)
        except Exception as e:
            raise HTTPException(502, detail=f"No se pudo descargar el archivo: {e}")

        if docx_path.stat().st_size == 0:
            raise HTTPException(400, detail="El archivo descargado está vacío.")

        # 2. Convertir
        try:
            if conversor == "libreoffice":
                pdf_path = _con_libreoffice(docx_path, tmp_dir)
            elif conversor == "docx2pdf":
                pdf_path = _con_docx2pdf(docx_path, tmp_dir)
            else:
                pdf_path = _con_reportlab(docx_path, tmp_dir)
        except Exception as e:
            print(f"⚠️ {conversor} falló ({e}), intentando ReportLab…")
            try:
                pdf_path = _con_reportlab(docx_path, tmp_dir)
            except Exception as e2:
                raise HTTPException(500, detail=f"Conversión fallida: {e} | Fallback: {e2}")

        # 3. Leer bytes antes de que TemporaryDirectory se cierre
        pdf_bytes = pdf_path.read_bytes()

    return pdf_bytes, safe_name, conversor
