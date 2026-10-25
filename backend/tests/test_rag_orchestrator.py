import os

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")
os.environ.setdefault("GEMINI_API_KEY", "test-gemini-key")
os.environ.setdefault("GROQ_API_KEY", "test-groq-key")

from types import SimpleNamespace

import pytest

from app.services import rag_orchestrator
from app.services.rag_orchestrator import RAGOrchestrator


class FakeQuery:
    def __init__(self, data=None, error=None):
        self.data = data or []
        self.error = error

    def execute(self):
        if self.error:
            raise self.error
        return SimpleNamespace(data=self.data)


def test_get_embedding_uses_shared_query_embeddings(monkeypatch):
    calls = []
    monkeypatch.setattr(
        rag_orchestrator,
        "embed_texts",
        lambda texts, task: calls.append((texts, task)) or [[0.5] * 768],
    )

    vector = RAGOrchestrator._get_embedding("consulta")

    assert len(vector) == rag_orchestrator.EMBEDDING_DIM
    assert calls == [(["consulta"], "consulta")]


def test_buscar_fragmentos_skips_missing_teacher_without_rpc(monkeypatch):
    calls = []
    monkeypatch.setattr(rag_orchestrator.supabase, "rpc", lambda *args: calls.append(args))

    assert RAGOrchestrator._buscar_fragmentos([0.1], None, 6) == []
    assert RAGOrchestrator._buscar_fragmentos([0.1], "", 6) == []
    assert calls == []


def test_buscar_fragmentos_calls_match_chunks_with_exact_parameters(monkeypatch):
    calls = []

    def fake_rpc(name, params):
        calls.append((name, params))
        return FakeQuery(data=[
            {"contenido_chunk": "primer fragmento"},
            {"contenido_chunk": "segundo fragmento"},
        ])

    monkeypatch.setattr(rag_orchestrator.supabase, "rpc", fake_rpc)
    vector = [0.25] * 768

    fragments = RAGOrchestrator._buscar_fragmentos(vector, "docente-1", 4)

    assert calls == [(
        "match_chunks",
        {"query_embedding": vector, "p_id_docente": "docente-1", "match_count": 4},
    )]
    assert fragments == ["primer fragmento", "segundo fragmento"]


def test_buscar_fragmentos_returns_empty_on_rpc_error(monkeypatch):
    def failing_rpc(*_args, **_kwargs):
        raise RuntimeError("offline")

    monkeypatch.setattr(rag_orchestrator.supabase, "rpc", failing_rpc)

    assert RAGOrchestrator._buscar_fragmentos([0.1], "docente-1", 6) == []


def test_recortar_fragmentos_keeps_whole_chunks_within_budget():
    result = RAGOrchestrator._recortar_fragmentos(["abcd", "efgh", "ij"], 10)

    assert result == "abcd\nefgh"
    assert len(result) <= 10
    assert "ij" not in result


@pytest.mark.asyncio
async def test_file_prompt_fits_and_keeps_request_with_huge_pdf(monkeypatch):
    system_instruction = "S" * 11000
    user_prompt = "pedido completo " + ("U" * 1900) + " FIN-PEDIDO-ÍNTEGRO"
    captured = []

    monkeypatch.setattr(
        RAGOrchestrator,
        "_extraer_texto_pdf",
        staticmethod(lambda _content: "PDF largo " * 50000),
    )
    monkeypatch.setattr(RAGOrchestrator, "_get_embedding", staticmethod(lambda _text: None))
    monkeypatch.setattr(
        RAGOrchestrator,
        "_generate",
        staticmethod(lambda prompt: captured.append(prompt) or "{}"),
    )
    monkeypatch.setattr(
        rag_orchestrator,
        "embed_texts",
        lambda *_args: (_ for _ in ()).throw(RuntimeError("sin servicio")),
    )

    await RAGOrchestrator.get_context_from_file_and_generate(
        b"pdf",
        user_prompt,
        system_instruction,
        "docente-1",
    )

    assert len(captured[0]) <= rag_orchestrator.PROMPT_MAX_CHARS
    assert user_prompt in captured[0]
    assert "PDF largo" in captured[0]


def test_seleccionar_fragmentos_pdf_picks_relevant_last_fragment(monkeypatch):
    fragments_seen = []

    def fake_embed_texts(texts, task):
        if task == "documento":
            fragments_seen.extend(texts)
            return [
                [1.0] + [0.0] * 767 if "dato relevante" in fragment
                else [0.0, 1.0] + [0.0] * 766
                for fragment in texts
            ]
        return [[1.0] + [0.0] * 767]

    monkeypatch.setattr(rag_orchestrator, "embed_texts", fake_embed_texts)
    text = ("contenido irrelevante " * 180) + "dato relevante página final"

    selected, cropped = RAGOrchestrator._seleccionar_fragmentos_pdf(text, "consulta", 1200)

    assert cropped is True
    assert "dato relevante página final" in selected
    assert len(selected) <= 1200
    assert fragments_seen[-1].endswith("dato relevante página final")


def test_seleccionar_fragmentos_pdf_falls_back_to_prefix_on_embedding_error(monkeypatch):
    monkeypatch.setattr(
        rag_orchestrator,
        "embed_texts",
        lambda *_args: (_ for _ in ()).throw(RuntimeError("offline")),
    )
    text = "contenido " * 300

    selected, cropped = RAGOrchestrator._seleccionar_fragmentos_pdf(text, "consulta", 80)

    assert selected == text[:80]
    assert cropped is True


@pytest.mark.asyncio
async def test_context_without_teacher_does_not_call_rpc(monkeypatch):
    calls = []
    captured = []
    monkeypatch.setattr(rag_orchestrator.supabase, "rpc", lambda *args: calls.append(args))
    monkeypatch.setattr(RAGOrchestrator, "_get_embedding", staticmethod(lambda _text: [0.1]))
    monkeypatch.setattr(
        RAGOrchestrator,
        "_generate",
        staticmethod(lambda prompt: captured.append(prompt) or "{}"),
    )

    await RAGOrchestrator.get_context_and_generate("pedido entero", "instrucción", None)

    assert calls == []
    assert "pedido entero" in captured[0]