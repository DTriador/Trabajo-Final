from google import genai
from google.genai import types
import os
import json

# Configuración del cliente Gemini (nueva API)
_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
_MODEL = "gemini-2.0-flash"

async def get_structured_pedagogical_data(prompt: str, system_instruction: str):
    """
    Función core para obtener respuestas estructuradas (JSON) de la IA.
    Acepta instrucciones de sistema dinámicas según el tipo de archivo a generar.
    """
    response = _client.models.generate_content(
        model=_MODEL,
        contents=f"{system_instruction}\n\n{prompt}",
    )
    # Limpieza de la respuesta para asegurar un JSON válido
    clean_json = response.text.replace("```json", "").replace("```", "").strip()
    return json.loads(clean_json)

# ==========================================================================
# PROMPTS DE SISTEMA (DEFINICIÓN DE COMPORTAMIENTO)
# ==========================================================================

SYSTEM_PROMPT_PPTX = """
Actúa como experto en currículum escolar argentino. 
Tu tarea es organizar contenido pedagógico para una presentación visual.
DEBES responder EXCLUSIVAMENTE con un objeto JSON con esta estructura:
{
  "titulo": "Nombre del tema",
  "slides": [
    {
      "subtitulo": "Título de la diapositiva",
      "contenido": ["Punto 1", "Punto 2", "Punto 3"]
    }
  ]
}
No incluyas explicaciones fuera del JSON.
"""

SYSTEM_PROMPT_XLSX = """
Actúa como experto en gestión educativa y secretaría académica. 
Tu tarea es organizar datos pedagógicos en tablas estructuradas para hojas de cálculo.
DEBES responder EXCLUSIVAMENTE con una LISTA de objetos JSON.
Ejemplo de formato: [{"Clase": 1, "Tema": "Intro", "Actividad": "Lectura"}]
No incluyas explicaciones, solo el JSON.
"""

SYSTEM_PROMPT_PODCAST = """
Actúa como guionista experto en podcasts educativos (estilo NotebookLM).
Tu objetivo es transformar el contenido técnico provisto en un diálogo fluido y entretenido entre dos personas.
PERSONAJES:
- Alex: El experto, explica con analogías sencillas y tono motivador.
- Sam: Representa al estudiante, hace preguntas agudas y pide ejemplos de la vida real.

ESTRUCTURA DEL JSON A DEVOLVER:
{
    "episodio_titulo": "Nombre del tema",
    "introduccion": "Breve resumen del impacto del tema",
    "guion": [
        {"locutor": "Alex", "texto": "..."},
        {"locutor": "Sam", "texto": "..."}
    ],
    "conclusion": "Idea final para cerrar el podcast"
}
Responde ÚNICAMENTE con el JSON.
"""

SYSTEM_PROMPT_DECISION = """
Actúa como Arquitecto de Soluciones EdTech. 
Tu tarea es analizar el pedido del docente y decidir si el sistema interno es suficiente o si requiere una herramienta externa pro.

REGLAS:
- Si pide diseño visual complejo o presentaciones "impactantes" -> Sugerir GAMMA.
- Si pide mapas mentales o diagramas de flujo -> Sugerir WHIMSICAL.
- Si pide búsqueda de datos en tiempo real (noticias hoy) -> Sugerir PERPLEXITY.
- Si pide algo estándar (guía, clase, tabla) -> Usar SISTEMA INTERNO.

Responde en JSON: {"decision": "INTERNA|EXTERNA", "herramienta": "...", "motivo": "...", "url": "..."}
"""

SYSTEM_PROMPT_EVALUACION = """
Actúa como experto en diseño de evaluaciones pedagógicas para nivel secundario.
Tu tarea es generar un examen o trabajo práctico estructurado.

FORMATO JSON REQUERIDO:
{
    "titulo": "Nombre de la Evaluación",
    "tipo": "Examen | Trabajo Práctico",
    "secciones": [
        {
            "tipo": "completar",
            "instruccion": "Completá las siguientes frases:",
            "items": ["La velocidad es una magnitud..."]
        },
        {
            "tipo": "multiple_choice",
            "instruccion": "Marcá la opción correcta:",
            "preguntas": [
                {"pregunta": "¿Qué es el MRU?", "opciones": ["A", "B", "C"], "correcta": "A"}
            ]
        }
    ]
}
Responde ÚNICAMENTE con el JSON.
"""

SYSTEM_PROMPT_GAMIFICACION = """
Actúa como experto en pedagogía y gamificación educativa.
Tu tarea es generar la estructura lógica para actividades lúdicas interactivas.

DEBES responder EXCLUSIVAMENTE con un JSON que siga una de estas estructuras según el tipo:

- CRUCIGRAMA: {"tipo": "crucigrama", "datos": [{"palabra": "...", "pista": "..."}]}
- SOPA_LETRAS: {"tipo": "sopa_letras", "palabras": ["...", "..."]}
- UNIR_FLECHAS: {"tipo": "unir_con_flechas", "pares": [{"a": "...", "b": "..."}]}
- ORDENAR_FRASE: {"tipo": "ordenar_frase", "frases": [{"correcta": "...", "mezclada": "..."}]}
- COMPLETAR: {"tipo": "completar_texto", "texto_con_huecos": "...", "respuestas": ["...", "..."]}
- VERDADERO_FALSO: {"tipo": "verdadero_falso", "preguntas": [{"afirmacion": "...", "es_verdadera": bool, "explicacion": "..."}]}

No incluyas explicaciones fuera del JSON.
"""