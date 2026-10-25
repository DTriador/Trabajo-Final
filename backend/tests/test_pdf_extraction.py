import importlib

import fitz
import pytest


def _make_pdf(path, page_count=1, include_text=True):
    document = fitz.open()
    for page_number in range(1, page_count + 1):
        page = document.new_page()
        if include_text:
            page.insert_text((72, 72), f"Contenido de página {page_number}")
    document.save(path)
    document.close()


@pytest.fixture
def pdf_modules(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "test-anon")
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", "test-service")
    monkeypatch.setenv("GEMINI_API_KEY", "test-gemini")
    monkeypatch.setenv("GROQ_API_KEY", "test-groq")

    service = importlib.reload(importlib.import_module("app.services.rag_service"))
    orchestrator = importlib.reload(
        importlib.import_module("app.services.rag_orchestrator")
    )
    return service, orchestrator


def test_process_pdf_indexes_all_pages_and_keeps_page_numbers(
    tmp_path, monkeypatch, pdf_modules
):
    service, _ = pdf_modules
    pdf_path = tmp_path / "long.pdf"
    _make_pdf(pdf_path, page_count=21)

    embedding_calls = []

    def fake_embed_texts(contents, task):
        embedding_calls.append((contents, task))
        return [[float(index)] * 768 for index, _ in enumerate(contents)]

    monkeypatch.setattr(service, "embed_texts", fake_embed_texts)

    chunks, embeddings = service.RAGService.process_pdf(str(pdf_path))

    assert embedding_calls == [(chunks, "documento")]
    assert len(chunks) == len(embeddings) == 21
    assert all(f"Página {page_number}:" in chunk for page_number, chunk in enumerate(chunks, 1))
    assert "Contenido de página 21" in chunks[-1]


@pytest.mark.parametrize(
    ("pdf_kind", "message"),
    [("empty", "vacío"), ("corrupt", "leer"), ("no_text", "texto")],
)
def test_process_pdf_rejects_empty_corrupt_and_textless_pdfs(
    tmp_path, pdf_modules, pdf_kind, message
):
    service, _ = pdf_modules
    pdf_path = tmp_path / f"{pdf_kind}.pdf"

    if pdf_kind == "empty":
        pdf_path.write_bytes(b"")
    elif pdf_kind == "corrupt":
        pdf_path.write_bytes(b"not a PDF")
    else:
        _make_pdf(pdf_path, include_text=False)

    with pytest.raises(ValueError, match=message):
        service.RAGService.process_pdf(str(pdf_path))


def test_orchestrator_extraction_keeps_all_page_numbers(tmp_path, pdf_modules):
    _, orchestrator = pdf_modules
    pdf_path = tmp_path / "long.pdf"
    _make_pdf(pdf_path, page_count=21)

    text = orchestrator.RAGOrchestrator._extraer_texto_pdf(pdf_path.read_bytes())

    assert "Página 1" in text
    assert "Página 21" in text
    assert "Contenido de página 21" in text



@pytest.mark.parametrize("pdf_kind", ["empty", "corrupt", "no_text"])
def test_orchestrator_rejects_invalid_or_textless_pdfs(
    tmp_path, pdf_modules, pdf_kind
):
    _, orchestrator = pdf_modules
    pdf_path = tmp_path / f"{pdf_kind}.pdf"

    if pdf_kind == "empty":
        pdf_path.write_bytes(b"")
    elif pdf_kind == "corrupt":
        pdf_path.write_bytes(b"not a PDF")
    else:
        _make_pdf(pdf_path, include_text=False)

    with pytest.raises(ValueError):
        orchestrator.RAGOrchestrator._extraer_texto_pdf(pdf_path.read_bytes())