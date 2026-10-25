import math
import os
import time

from google import genai
from google.genai import types

EMBEDDING_MODEL = "models/gemini-embedding-001"
EMBEDDING_DIM = 768
_LOTE = 100

_client = None


def _get_client():
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY no está configurada")
        _client = genai.Client(api_key=api_key)
    return _client


def embed_texts(textos: list[str], tarea: str) -> list[list[float]]:
    task_types = {
        "documento": "RETRIEVAL_DOCUMENT",
        "consulta": "RETRIEVAL_QUERY",
    }
    if tarea not in task_types:
        raise ValueError("tarea debe ser 'documento' o 'consulta'")

    vectores = []
    for inicio in range(0, len(textos), _LOTE):
        lote = textos[inicio:inicio + _LOTE]
        config = types.EmbedContentConfig(
            task_type=task_types[tarea],
            output_dimensionality=EMBEDDING_DIM,
        )
        response = None
        for intento in range(3):
            try:
                response = _get_client().models.embed_content(
                    model=EMBEDDING_MODEL,
                    contents=lote,
                    config=config,
                )
                break
            except Exception:
                if intento == 2:
                    raise
                time.sleep(intento + 1)

        embeddings = response.embeddings
        if len(embeddings) != len(lote):
            raise ValueError(
                f"Se esperaban {len(lote)} embeddings y se recibieron {len(embeddings)}"
            )

        for embedding in embeddings:
            vector = list(embedding.values)
            if len(vector) != EMBEDDING_DIM:
                raise ValueError(
                    f"El embedding debe tener {EMBEDDING_DIM} dimensiones; tiene {len(vector)}"
                )
            norma = math.sqrt(sum(valor * valor for valor in vector))
            if norma == 0:
                raise ValueError("No se puede normalizar un embedding de norma cero")
            vectores.append([valor / norma for valor in vector])

    return vectores