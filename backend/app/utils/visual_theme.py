"""Tema visual compartido y seguro para herramientas educativas.

Este módulo centraliza una paleta consistente y segura para evitar que cada
herramienta defina colores o estilos de forma aislada. Se mantiene acoplado
solo a la capa visual; la lógica funcional de generación no se modifica aquí.
"""

THEME = {
    "colors": {
        "background": "#F5F7FF",
        "surface": "#FFFFFF",
        "surface_alt": "#EEF4FF",
        "primary": "#1F5A8A",
        "primary_soft": "#DDEDFC",
        "secondary": "#5FA5D5",
        "accent": "#F7B267",
        "accent_soft": "#FFF2D9",
        "text": "#1F2937",
        "muted": "#52606D",
        "success": "#2E7D5F",
        "border": "#D5DCE7",
        "grid_fill": "#F9FBFF",
    },
    "tool_palette": {
        "presentacion": {"primary": "#F7B267", "soft": "#FFF2D9", "accent": "#F4D35E"},
        "documento": {"primary": "#8AC7A8", "soft": "#EAF9F0", "accent": "#B5E2B5"},
        "preguntas": {"primary": "#7AC7D9", "soft": "#E6F7FB", "accent": "#9DD9E8"},
        "examen": {"primary": "#E9A7C5", "soft": "#FDECF3", "accent": "#F3C8D8"},
        "podcast": {"primary": "#B7D47B", "soft": "#F2F8D8", "accent": "#D1E7A8"},
        "sopa": {"primary": "#F5A66D", "soft": "#FFF0E5", "accent": "#F9C79A"},
        "crucigrama": {"primary": "#B49AD8", "soft": "#F1EBFF", "accent": "#D2C2F0"},
        "unir_flechas": {"primary": "#82B6E5", "soft": "#EAF3FF", "accent": "#BEDCFF"},
    },
    "fonts": {
        "title": "Helvetica-Bold",
        "subtitle": "Helvetica-Bold",
        "body": "Helvetica",
    },
    "ppt": {
        "background": "#F5F7FF",
        "title": "#1F5A8A",
        "subtitle": "#52606D",
        "body": "#1F2937",
        "accent": "#F7B267",
        "accent_soft": "#FFF2D9",
        "panel": "#FFFFFF",
        "border": "#D5DCE7",
    },
}


def hex_to_rgb(value: str):
    value = (value or "#000000").replace("#", "")
    if len(value) != 6:
        return (0, 0, 0)
    return tuple(int(value[i:i+2], 16) / 255 for i in range(0, 6, 2))


def reportlab_rgb(value: str):
    return hex_to_rgb(value)


def ppt_rgb(value: str):
    return tuple(int((value or "#000000").replace("#", "")[i:i+2], 16) for i in range(0, 6, 2))
