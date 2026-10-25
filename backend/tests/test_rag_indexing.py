import importlib
from io import BytesIO

import pytest
from fastapi import UploadFile


@pytest.mark.asyncio
async def test_embedding_failure_is_reported_without_marking_pdf_indexed(
    monkeypatch, tmp_path
):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "test-anon")
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", "test-service")
    monkeypatch.setenv("GEMINI_API_KEY", "test-gemini")

    module = importlib.reload(importlib.import_module("app.api.router_rag"))
    monkeypatch.setattr(module, "UPLOAD_DIR", str(tmp_path))
    monkeypatch.setattr(module, "extract_pdf_pages", lambda _content: [(1, "text")])

    class FakeQuery:
        def insert(self, _rows):
            return self

        def execute(self):
            return type("Response", (), {"data": []})()

    class FakeSupabase:
        def table(self, _name):
            return FakeQuery()

    monkeypatch.setattr(module, "supabase", FakeSupabase())

    def fail_embedding(_file_path):
        raise RuntimeError("Falló el lote 2")

    monkeypatch.setattr(module.RAGService, "process_pdf", fail_embedding)
    upload = UploadFile(filename="material.pdf", file=BytesIO(b"pdf bytes"))

    response = await module.subir_documento(
        files=[upload], id_docente="teacher-1", file=None
    )

    result = response["uploaded"][0]
    assert result["chunks_indexados"] == 0
    assert result["estado_indexacion"] == "failed"
    assert result["error_indexacion"] == "Falló el lote 2"