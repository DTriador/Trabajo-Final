import random

class ActivitiesService:
    """
    Servicio encargado de la lógica de generación de actividades didácticas.
    Aquí se integraría con la IA (OpenAI/Gemini) para obtener el contenido 
    y luego formatearlo según el tipo de actividad.
    """

    @staticmethod
    async def generar_crucigrama(tema: str, dificultad: str):
        # Lógica para estructurar un crucigrama (matriz de letras y pistas)
        return {"tipo": "crucigrama", "tema": tema, "data": "Matriz generada..."}

    @staticmethod
    async def generar_sopa_letras(tema: str, palabras: list):
        # Lógica para esconder palabras en una cuadrícula
        return {"tipo": "sopa_letras", "cuadricula": [], "palabras": palabras}

    @staticmethod
    async def generar_emparejamiento(items_izquierda: list, items_derecha: list):
        # Lógica para "Unir con flechas"
        return {"tipo": "unir_flechas", "parejas": []}

    @staticmethod
    async def generar_ordenar_frase(frase_original: str):
        palabras = frase_original.split()
        random.shuffle(palabras)
        return {"tipo": "ordenar_frase", "frase_desordenada": palabras}

    @staticmethod
    async def generar_completar_texto(texto: str, palabras_a_quitar: list):
        # Reemplaza palabras clave por huecos (____)
        texto_final = texto
        for p in palabras_a_quitar:
            texto_final = texto_final.replace(p, "_______")
        return {"tipo": "completar_texto", "texto": texto_final, "opciones": palabras_a_quitar}

    @staticmethod
    async def generar_verdadero_falso(afirmaciones: list):
        # Estructura preguntas de opción binaria
        return [{"pregunta": a, "respuesta_correcta": True} for a in afirmaciones]

# Instancia para ser usada en los routers
activities_service = ActivitiesService()