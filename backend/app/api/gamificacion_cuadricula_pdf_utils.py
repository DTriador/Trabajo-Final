# backend/app/api/gamificacion_cuadricula_pdf_utils.py
"""Utilidades de bajo nivel para dibujar en los PDF con reportlab."""
from reportlab.lib.units import cm

from app.utils.visual_theme import THEME, reportlab_rgb


def _dibujar_encabezado_pdf(c, width, height, nombre_escuela, nombre_materia, division, fecha, nombre_alumno):
    """
    Dibuja un encabezado institucional con identidad visual coherente, sin tocar la
    lógica funcional de la actividad generada.
    """
    y = height - 1.2 * cm
    c.setFillColorRGB(*reportlab_rgb(THEME["colors"]["primary"]))
    c.rect(0, height - 2.0 * cm, width, 1.8 * cm, stroke=0, fill=1)

    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(1.5 * cm, height - 1.2 * cm, nombre_escuela)
    y -= 0.55 * cm
    c.setFont("Helvetica", 11)
    c.drawString(1.5 * cm, y, f"Materia: {nombre_materia}  |  División: {division}")
    y -= 0.5 * cm
    fecha_val = fecha if fecha else "_______________________________"
    c.drawString(1.5 * cm, y, f"Fecha: {fecha_val}")
    y -= 0.5 * cm
    alumno_val = nombre_alumno if nombre_alumno else "_______________________________"
    c.setFont("Helvetica-Bold", 11)
    c.drawString(1.5 * cm, y, "Nombre del Alumno/a: ")
    c.setFont("Helvetica", 11)
    c.drawString(1.5 * cm + 5.6 * cm, y, alumno_val)
    y -= 0.75 * cm
    c.setStrokeColorRGB(*reportlab_rgb(THEME["colors"]["border"]))
    c.setLineWidth(0.8)
    c.line(1.5 * cm, y, width - 1.5 * cm, y)
    y -= 0.5 * cm
    return y
