from types import SimpleNamespace
from io import BytesIO

import pytest
from fastapi import HTTPException
from pptx import Presentation

from app.api.contenido_generadores import (
    _clean_ppt_items,
    _remove_generated_number,
    _normalize_ppt_slide_payload,
    _validate_slide_bounds,
    generar_presentacion_pptx,
)
from app.services.rag_orchestrator import RAGOrchestrator


def test_clean_ppt_items_removes_empty_values():
    items = ["Idea 1", "", "   ", None, "Idea 2", "  ", "Idea 3"]

    result = _clean_ppt_items(items)

    assert result == ["Idea 1", "Idea 2", "Idea 3"]


def test_normalize_ppt_slide_payload_splits_long_content():
    slides = [
        {
            "subtitulo": "Dinámica",
            "contenido": [
                "Idea 1",
                "Idea 2",
                "Idea 3",
                "Idea 4",
                "Idea 5",
                "Idea 6",
                "Idea 7",
                "Idea 8",
            ],
        }
    ]

    result = _normalize_ppt_slide_payload(slides)

    assert len(result) >= 2
    assert all(len(_clean_ppt_items(item.get("contenido", []))) <= 6 for item in result)


def test_normalize_ppt_slide_payload_does_not_invent_fallback_slides():
    assert _normalize_ppt_slide_payload([]) == []
    assert _normalize_ppt_slide_payload([{"titulo": "Vacía", "contenido": []}]) == []


def test_remove_generated_number_prevents_repeated_question_indices():
    assert _remove_generated_number("2. 2. Resolver el problema", 2) == "Resolver el problema"
    assert _remove_generated_number("3. Explicar el proceso", 3) == "Explicar el proceso"
    assert _remove_generated_number("5.5. Justificar la respuesta", 5) == "Justificar la respuesta"


@pytest.mark.asyncio
async def test_presentation_fails_clearly_when_ai_response_has_no_slides(monkeypatch, tmp_path):
    async def fake_generation(cls, *args, **kwargs):
        return {"_raw": "respuesta no estructurada"}

    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(
        RAGOrchestrator,
        "get_context_and_generate",
        classmethod(fake_generation),
    )

    with pytest.raises(HTTPException) as error:
        await generar_presentacion_pptx("Fotosíntesis", "docente-1", None)

    assert error.value.status_code == 502
    assert "diapositivas válidas" in error.value.detail
    assert not (tmp_path / "archivos_generados").exists()


@pytest.mark.asyncio
async def test_presentation_builds_and_uploads_real_ai_slides(monkeypatch, tmp_path):
    async def fake_generation(cls, *args, **kwargs):
        return {
            "titulo": "Título generado",
            "slides": [{
                "titulo": "Concepto",
                "contenido": ["Idea real obtenida de la respuesta"],
            }],
        }

    class FakeBucket:
        def __init__(self):
            self.uploaded = None

        def upload(self, *, path, file, file_options):
            self.uploaded = (path, file, file_options)

        def create_signed_url(self, path, expires_in):
            return {"signedURL": "https://storage.example.test/file"}

    class FakeTable:
        def insert(self, row):
            self.row = row
            return self

        def execute(self):
            return SimpleNamespace(data=[self.row])

    class FakeSupabase:
        def __init__(self):
            self.bucket = FakeBucket()
            self.table_client = FakeTable()
            self.storage = self

        def from_(self, _bucket_name):
            return self.bucket

        def table(self, _table_name):
            return self.table_client

    fake_db = FakeSupabase()
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(
        RAGOrchestrator,
        "get_context_and_generate",
        classmethod(fake_generation),
    )
    monkeypatch.setattr("app.api.contenido_generadores.supabase", fake_db)

    result = await generar_presentacion_pptx(
        "Fotosíntesis", "docente-1", None, "Ciclo de la fotosíntesis"
    )

    assert result["status"] == "success"
    assert result["download_url"] == "https://storage.example.test/file"
    assert fake_db.bucket.uploaded[1].startswith(b"PK")
    presentation = Presentation(BytesIO(fake_db.bucket.uploaded[1]))
    textos = [
        shape.text
        for slide in presentation.slides
        for shape in slide.shapes
        if shape.has_text_frame
    ]
    assert any("Idea real obtenida" in texto for texto in textos)


def test_validate_slide_bounds_accepts_valid_dimensions():
    assert _validate_slide_bounds(left=0.5, top=0.5, width=10, height=4, slide_width=13.33, slide_height=7.5) is True
    assert _validate_slide_bounds(left=0.5, top=0.5, width=13.0, height=7.0, slide_width=13.33, slide_height=7.5) is True
    assert _validate_slide_bounds(left=0.5, top=0.5, width=13.5, height=7.0, slide_width=13.33, slide_height=7.5) is False
