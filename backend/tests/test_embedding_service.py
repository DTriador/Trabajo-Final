import pytest

from types import SimpleNamespace

from app.services import embedding_service


class FakeEmbeddingClient:
    def __init__(self, fail_on_call=None, dimension=768):
        self.calls = []
        self.fail_on_call = fail_on_call
        self.dimension = dimension

    def embed(self, model, contents, config):
        call_number = len(self.calls) + 1
        self.calls.append((model, contents, config))
        if call_number == self.fail_on_call:
            raise RuntimeError("embedding failed")
        input_count = len(contents) if isinstance(contents, list) else 1
        return type(
            "Response",
            (),
            {
                "embeddings": [
                    type("Embedding", (), {"values": [0.1] * self.dimension})()
                    for _ in range(input_count)
                ]
            },
        )()


def _install_client(monkeypatch, fake_client):
    monkeypatch.setattr(
        embedding_service,
        "_gemini_client",
        SimpleNamespace(models=SimpleNamespace(embed_content=fake_client.embed)),
    )


def test_document_embeddings_are_batched_by_at_most_100(monkeypatch):
    fake_client = FakeEmbeddingClient()
    _install_client(monkeypatch, fake_client)
    contents = [f"document chunk {index}" for index in range(205)]

    embeddings = embedding_service.embed_documents(contents)

    assert len(embeddings) == len(contents)
    assert [len(call[1]) for call in fake_client.calls] == [100, 100, 5]
    assert all(call[0] == "models/gemini-embedding-001" for call in fake_client.calls)
    assert all(call[2].task_type == "RETRIEVAL_DOCUMENT" for call in fake_client.calls)
    assert all(call[2].output_dimensionality == 768 for call in fake_client.calls)


def test_query_embedding_uses_query_task_and_same_dimension(monkeypatch):
    fake_client = FakeEmbeddingClient()
    _install_client(monkeypatch, fake_client)

    vector = embedding_service.embed_query("query text")

    assert len(vector) == 768
    assert len(fake_client.calls) == 1
    model, contents, config = fake_client.calls[0]
    assert model == "models/gemini-embedding-001"
    assert contents == "query text"
    assert config.task_type == "RETRIEVAL_QUERY"
    assert config.output_dimensionality == 768


def test_document_embedding_failure_does_not_return_partial_vectors(monkeypatch):
    fake_client = FakeEmbeddingClient(fail_on_call=2)
    _install_client(monkeypatch, fake_client)

    with pytest.raises(embedding_service.EmbeddingError, match="lote 2"):
        embedding_service.embed_documents([f"chunk {index}" for index in range(101)])


@pytest.mark.parametrize("invalid_count", [0, 2])
def test_query_embedding_rejects_invalid_response_count(monkeypatch, invalid_count):
    class Models:
        def embed_content(self, model, contents, config):
            return type(
                "Response",
                (),
                {"embeddings": [type("Embedding", (), {"values": [0.0] * 768})() for _ in range(invalid_count)]},
            )()

    monkeypatch.setattr(
        embedding_service,
        "_gemini_client",
        SimpleNamespace(models=Models()),
    )

    with pytest.raises(embedding_service.EmbeddingError, match="se esperaban 1"):
        embedding_service.embed_query("query text")


def test_document_embedding_rejects_wrong_vector_dimension(monkeypatch):
    fake_client = FakeEmbeddingClient(dimension=767)
    _install_client(monkeypatch, fake_client)

    with pytest.raises(embedding_service.EmbeddingError, match="767 dimensiones"):
        embedding_service.embed_documents(["chunk"])