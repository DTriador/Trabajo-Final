import importlib
import os
import pytest


@pytest.fixture
def contenido_module(monkeypatch):
    os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
    os.environ.setdefault("SUPABASE_ANON_KEY", "fake-anon")
    os.environ.setdefault("SUPABASE_SERVICE_KEY", "fake-service")
    module = importlib.import_module("app.api.router_contenido")
    return importlib.reload(module)


@pytest.mark.asyncio
async def test_generar_apunte_pasa_id_docente_al_rag(monkeypatch, contenido_module):
    captured = {}

    async def fake_get_context_from_file_and_generate(file_content, prompt, system_instruction, id_docente):
        captured["id_docente"] = id_docente
        return {
            "titulo": "Test",
            "introduccion": "intro",
            "secciones": [{"subtitulo": "S", "contenido": "c", "puntos_clave": ["p"]}],
            "glosario": [{"termino": "t", "definicion": "d"}],
            "conclusion": "fin",
        }

    async def fake_process_and_upload(*args, **kwargs):
        captured["process_args"] = args
        captured["process_kwargs"] = kwargs
        return {"status": "success"}

    monkeypatch.setattr(contenido_module.RAGOrchestrator, "get_context_from_file_and_generate", fake_get_context_from_file_and_generate)
    monkeypatch.setattr(contenido_module, "process_and_upload", fake_process_and_upload)
    monkeypatch.setattr(contenido_module, "_datos_escuela_materia", lambda *_args, **_kwargs: ("Escuela", "Materia", "", "", []))

    class FakeUploadFile:
        async def read(self):
            return b"%PDF-1.4"

    result = await contenido_module.generar_apunte(
        tema="Biología",
        id_docente="doc-123",
        file=FakeUploadFile(),
        id_escuela="esc-1",
        id_curso="cur-1",
        fecha="01/01/2025",
    )

    assert result["status"] == "success"
    assert captured["id_docente"] == "doc-123"
    assert captured["process_args"][4] == "doc-123"
