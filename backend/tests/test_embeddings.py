import importlib
import os
from io import BytesIO
from math import isclose, sqrt
from types import SimpleNamespace

import pytest
from fastapi import UploadFile

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("GEMINI_API_KEY", "test-gemini-key")


def _embedding_module():
    return importlib.import_module("app.services.embeddings")


def _fake_response(contents):
    return SimpleNamespace(
        embeddings=[
            SimpleNamespace(values=[1.0] * 768)
            for _ in contents
        ]
    )


def test_embed_texts_batches_250_texts_and_normalizes_vectors(monkeypatch):
    embeddings = _embedding_module()
    calls = []

    class FakeModels:
        def embed_content(self, **kwargs):
            calls.append(kwargs)
            return _fake_response(kwargs["contents"])

    monkeypatch.setattr(
        embeddings,
        "_get_client",
        lambda: SimpleNamespace(models=FakeModels()),
    )

    vectors = embeddings.embed_texts([f"text-{index}" for index in range(250)], "documento")

    assert [len(call["contents"]) for call in calls] == [100, 100, 50]
    assert len(vectors) == 250
    assert all(len(vector) == 768 for vector in vectors)
    assert all(isclose(sqrt(sum(value * value for value in vector)), 1.0) for vector in vectors)


def test_embed_texts_uses_task_type_for_query_and_document(monkeypatch):
    embeddings = _embedding_module()
    task_types = []

    class FakeModels:
        def embed_content(self, **kwargs):
            task_types.append(
                (kwargs["config"].task_type, kwargs["config"].output_dimensionality)
            )
            return _fake_response(kwargs["contents"])

    monkeypatch.setattr(
        embeddings,
        "_get_client",
        lambda: SimpleNamespace(models=FakeModels()),
    )

    embeddings.embed_texts(["question"], "consulta")
    embeddings.embed_texts(["passage"], "documento")

    assert task_types == [
        ("RETRIEVAL_QUERY", 768),
        ("RETRIEVAL_DOCUMENT", 768),
    ]


def test_embed_texts_rejects_wrong_vector_dimension(monkeypatch):
    embeddings = _embedding_module()

    class FakeModels:
        def embed_content(self, **kwargs):
            return SimpleNamespace(embeddings=[SimpleNamespace(values=[1.0] * 767)])

    monkeypatch.setattr(
        embeddings,
        "_get_client",
        lambda: SimpleNamespace(models=FakeModels()),
    )

    with pytest.raises(ValueError, match="768"):
        embeddings.embed_texts(["text"], "documento")


def test_embed_texts_rejects_embedding_count_mismatch(monkeypatch):
    embeddings = _embedding_module()

    class FakeModels:
        def embed_content(self, **_kwargs):
            return SimpleNamespace(embeddings=[])

    monkeypatch.setattr(
        embeddings,
        "_get_client",
        lambda: SimpleNamespace(models=FakeModels()),
    )

    with pytest.raises(ValueError, match="Se esperaban 1 embeddings"):
        embeddings.embed_texts(["text"], "documento")


def test_embed_texts_retries_a_failed_batch(monkeypatch):
    embeddings = _embedding_module()
    attempts = 0
    waits = []

    class FakeModels:
        def embed_content(self, **kwargs):
            nonlocal attempts
            attempts += 1
            if attempts == 1:
                raise RuntimeError("temporary failure")
            return _fake_response(kwargs["contents"])

    monkeypatch.setattr(
        embeddings,
        "_get_client",
        lambda: SimpleNamespace(models=FakeModels()),
    )
    monkeypatch.setattr(embeddings.time, "sleep", waits.append)

    vectors = embeddings.embed_texts(["text"], "documento")

    assert attempts == 2
    assert waits == [1]
    assert len(vectors) == 1


def test_process_pdf_rejects_pdf_without_extractable_text(monkeypatch, tmp_path):
    rag_service = importlib.import_module("app.services.rag_service")

    class EmptyPage:
        def extract_text(self):
            return "  "

    class FakePdfReader:
        def __init__(self, _source):
            self.pages = [EmptyPage()]

    monkeypatch.setattr(rag_service, "PdfReader", FakePdfReader)
    pdf_path = tmp_path / "scanned.pdf"
    pdf_path.write_bytes(b"pdf")

    with pytest.raises(
        ValueError,
        match=r"El PDF no contiene texto extraíble \(puede ser un escaneo\)",
    ):
        rag_service.RAGService.process_pdf(str(pdf_path))


@pytest.mark.asyncio
async def test_upload_reports_indexing_failure_without_http_error(monkeypatch, tmp_path):
    router_rag = importlib.import_module("app.api.router_rag")
    monkeypatch.setattr(router_rag, "UPLOAD_DIR", str(tmp_path))

    class FakeQuery:
        def __init__(self, table_name):
            self.table_name = table_name
            self.filters = []

        def delete(self):
            operations.append((self.table_name, "delete", self))
            return self

        def eq(self, field, value):
            self.filters.append((field, value))
            return self

        def insert(self, _rows):
            operations.append((self.table_name, "insert", _rows))
            return self

        def execute(self):
            return SimpleNamespace(data=[])

    class FakeSupabase:
        def table(self, table_name):
            return FakeQuery(table_name)

    operations = []
    monkeypatch.setattr(router_rag, "supabase", FakeSupabase())
    monkeypatch.setattr(router_rag, "extract_pdf_pages", lambda _content: [(1, "text")])

    def fail_processing(_file_path):
        raise RuntimeError("embedding unavailable")

    monkeypatch.setattr(router_rag.RAGService, "process_pdf", fail_processing)
    upload = UploadFile(filename="material.pdf", file=BytesIO(b"pdf bytes"))

    response = await router_rag.subir_documento(
        files=[upload], id_docente="teacher-1", file=None
    )

    result = response["uploaded"][0]
    assert result["indexado"] is False
    assert result["chunks_indexados"] == 0
    assert result["error_indexacion"] == "embedding unavailable"
    assert not any(operation[0] == "chunks_rag" for operation in operations)


@pytest.mark.asyncio
async def test_upload_replaces_chunks_in_teacher_scoped_batches(monkeypatch, tmp_path):
    router_rag = importlib.import_module("app.api.router_rag")
    monkeypatch.setattr(router_rag, "UPLOAD_DIR", str(tmp_path))
    operations = []

    class FakeQuery:
        def __init__(self, table_name):
            self.table_name = table_name
            self.filters = []

        def delete(self):
            operations.append((self.table_name, "delete", self))
            return self

        def eq(self, field, value):
            self.filters.append((field, value))
            return self

        def insert(self, rows):
            operations.append((self.table_name, "insert", rows))
            return self

        def execute(self):
            return SimpleNamespace(data=[])

    class FakeSupabase:
        def table(self, table_name):
            return FakeQuery(table_name)

    monkeypatch.setattr(router_rag, "supabase", FakeSupabase())
    monkeypatch.setattr(router_rag, "extract_pdf_pages", lambda _content: [(1, "text")])
    chunks = [f"chunk-{index}" for index in range(101)]
    vectors = [[float(index)] for index in range(101)]
    monkeypatch.setattr(
        router_rag.RAGService,
        "process_pdf",
        lambda _file_path: (chunks, vectors),
    )
    upload = UploadFile(filename="material.pdf", file=BytesIO(b"pdf bytes"))

    response = await router_rag.subir_documento(
        files=[upload], id_docente="teacher-1", file=None
    )

    result = response["uploaded"][0]
    rag_operations = [operation for operation in operations if operation[0] == "chunks_rag"]
    delete_operation = rag_operations[0]
    insert_operations = [operation for operation in rag_operations if operation[1] == "insert"]
    assert result["indexado"] is True
    assert result["chunks_indexados"] == 101
    assert result["error_indexacion"] is None
    assert delete_operation[2].filters == [
        ("id_docente", "teacher-1"),
        ("nombre_original", "material.pdf"),
    ]
    assert [len(operation[2]) for operation in insert_operations] == [100, 1]
    assert all(row["nombre_original"] == "material.pdf" for operation in insert_operations for row in operation[2])


@pytest.mark.asyncio
async def test_upload_marks_non_pdf_as_not_indexed(monkeypatch, tmp_path):
    router_rag = importlib.import_module("app.api.router_rag")
    monkeypatch.setattr(router_rag, "UPLOAD_DIR", str(tmp_path))

    class FakeQuery:
        def insert(self, _rows):
            return self

        def execute(self):
            return SimpleNamespace(data=[])

    class FakeSupabase:
        def table(self, _table_name):
            return FakeQuery()

    monkeypatch.setattr(router_rag, "supabase", FakeSupabase())
    upload = UploadFile(filename="material.docx", file=BytesIO(b"document"))

    response = await router_rag.subir_documento(
        files=[upload], id_docente="teacher-1", file=None
    )

    result = response["uploaded"][0]
    assert result["indexado"] is False
    assert result["error_indexacion"] is None
    assert result["chunks_indexados"] == 0