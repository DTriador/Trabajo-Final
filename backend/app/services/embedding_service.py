import os

from google import genai as google_genai
from google.genai import types


MODEL_NAME = "models/gemini-embedding-001"
EMBEDDING_DIMENSION = 768
MAX_BATCH_SIZE = 100

_gemini_client = None


class EmbeddingError(RuntimeError):
    pass


def _embed(contents: str | list[str], task_type: str, expected_count: int) -> list[list[float]]:
    global _gemini_client
    try:
        if _gemini_client is None:
            _gemini_client = google_genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        response = _gemini_client.models.embed_content(
            model=MODEL_NAME,
            contents=contents,
            config=types.EmbedContentConfig(
                task_type=task_type,
                output_dimensionality=EMBEDDING_DIMENSION,
            ),
        )
    except Exception as error:
        raise EmbeddingError(f"Falló la solicitud de embeddings: {error}") from error

    embeddings = getattr(response, "embeddings", None) or []
    if len(embeddings) != expected_count:
        raise EmbeddingError(
            f"La respuesta devolvió {len(embeddings)} embeddings; se esperaban {expected_count}."
        )

    vectors = []
    for index, embedding in enumerate(embeddings, start=1):
        values = getattr(embedding, "values", None)
        if values is None or len(values) != EMBEDDING_DIMENSION:
            actual_dimension = len(values) if values is not None else 0
            raise EmbeddingError(
                f"El embedding {index} tiene {actual_dimension} dimensiones; "
                f"se esperaban {EMBEDDING_DIMENSION}."
            )
        vectors.append(values)
    return vectors


def embed_documents(contents: list[str]) -> list[list[float]]:
    vectors = []
    for offset in range(0, len(contents), MAX_BATCH_SIZE):
        batch_number = offset // MAX_BATCH_SIZE + 1
        batch = contents[offset:offset + MAX_BATCH_SIZE]
        try:
            vectors.extend(_embed(batch, "RETRIEVAL_DOCUMENT", len(batch)))
        except EmbeddingError as error:
            raise EmbeddingError(f"Falló el lote {batch_number}: {error}") from error
    return vectors


def embed_query(content: str) -> list[float]:
    vectors = _embed(content, "RETRIEVAL_QUERY", 1)
    return vectors[0]