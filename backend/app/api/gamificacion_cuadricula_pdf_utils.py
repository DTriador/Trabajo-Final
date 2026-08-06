# backend/app/api/gamificacion_cuadricula_pdf_utils.py
"""Utilidades de bajo nivel para dibujar en los PDF con reportlab."""
from reportlab.lib.units import cm


def _dibujar_encabezado_pdf(c, width, height, nombre_escuela, nombre_materia, division, fecha, nombre_alumno):
    """
    Dibuja el encabezado institucional en la primera página del PDF.
    Devuelve la coordenada Y donde termina el encabezado para que el contenido empiece debajo.
    """
    y = height - 1.2 * cm
    c.setFont("Helvetica-Bold", 13)
    c.drawString(1.5 * cm, y, nombre_escuela)
    y -= 0.55 * cm
    c.setFont("Helvetica", 11)
    c.drawString(1.5 * cm, y, f"Materia: {nombre_materia}  |  División: {division}")
    y -= 0.5 * cm
    # Mostrar siempre la línea de Fecha; si no hay fecha, dejar espacio en blanco como para el alumno
    fecha_val = fecha if fecha else "_______________________________"
    c.drawString(1.5 * cm, y, f"Fecha: {fecha_val}")
    y -= 0.5 * cm
    # Campo Nombre del Alumno
    alumno_val = nombre_alumno if nombre_alumno else "_______________________________"
    c.setFont("Helvetica-Bold", 11)
    c.drawString(1.5 * cm, y, "Nombre del Alumno/a: ")
    c.setFont("Helvetica", 11)
    c.drawString(1.5 * cm + 5.6 * cm, y, alumno_val)
    y -= 0.7 * cm
    # Línea separadora
    c.setStrokeGray(0.6)
    c.setLineWidth(0.8)
    c.line(1.5 * cm, y, width - 1.5 * cm, y)
    y -= 0.4 * cm
    return y
