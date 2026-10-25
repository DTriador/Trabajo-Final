import os

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")

from types import SimpleNamespace

import pytest

from app.api import router_proyectos


class FakeTable:
    def __init__(self, table_name, supabase):
        self.table_name = table_name
        self.supabase = supabase
        self.operation = "select"
        self.filters = []

    def select(self, _columns):
        self.operation = "select"
        return self

    def delete(self):
        self.operation = "delete"
        self.supabase.operations.append((self.table_name, self.operation, self.filters.copy()))
        return self

    def eq(self, column, value):
        self.filters.append((column, value))
        return self

    def single(self):
        return self

    def execute(self):
        if self.table_name == "archivos_generados" and self.operation == "select":
            return SimpleNamespace(data={
                "id_archivo": "file-1",
                "id_docente": "teacher-7",
                "nombre_archivo": "guia.pdf",
                "path_archivo": None,
                "path": None,
                "url_descarga": "",
            })
        if self.table_name == "chunks_rag":
            if self.supabase.fail_chunk_delete:
                raise RuntimeError("chunks unavailable")
            self.supabase.operations[-1] = (
                self.table_name,
                self.operation,
                self.filters.copy(),
            )
        return SimpleNamespace(data=[])


class FakeSupabase:
    def __init__(self, fail_chunk_delete=False):
        self.fail_chunk_delete = fail_chunk_delete
        self.operations = []
        self.storage = SimpleNamespace(from_=lambda _bucket: SimpleNamespace(remove=lambda _paths: None))

    def table(self, table_name):
        return FakeTable(table_name, self)


@pytest.mark.asyncio
async def test_eliminar_archivo_borra_chunks_por_docente_y_nombre(monkeypatch):
    database = FakeSupabase()
    monkeypatch.setattr(router_proyectos, "supabase", database)

    response = await router_proyectos.eliminar_archivo("file-1")

    assert response == {"status": "success", "id_archivo": "file-1"}
    assert ("chunks_rag", "delete", [
        ("id_docente", "teacher-7"),
        ("nombre_original", "guia.pdf"),
    ]) in database.operations


@pytest.mark.asyncio
async def test_eliminar_archivo_no_falla_si_no_se_borran_chunks(monkeypatch):
    database = FakeSupabase(fail_chunk_delete=True)
    monkeypatch.setattr(router_proyectos, "supabase", database)

    response = await router_proyectos.eliminar_archivo("file-1")

    assert response == {"status": "success", "id_archivo": "file-1"}