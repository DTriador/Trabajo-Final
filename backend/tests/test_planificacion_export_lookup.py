import importlib
import os


def _load_router_module():
    os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
    os.environ.setdefault("SUPABASE_ANON_KEY", "fake-anon")
    os.environ.setdefault("SUPABASE_SERVICE_KEY", "fake-service")
    module = importlib.import_module("app.api.router_planificacion")
    return importlib.reload(module)


def test_obtener_planificacion_por_id_falls_back_to_id(monkeypatch):
    module = _load_router_module()

    class FakeResponse:
        def __init__(self, data):
            self.data = data

    class FakeQuery:
        def __init__(self):
            self.calls = []

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, column, value):
            self.calls.append((column, value))
            self._column = column
            return self

        def single(self):
            return self

        def execute(self):
            if self._column == "id_planificacion":
                raise Exception("not found")
            return FakeResponse({"id": "plan-123", "id_planificacion": "plan-123"})

    class FakeSupabase:
        def table(self, name):
            assert name == "planificacion"
            return FakeQuery()

    module.supabase = FakeSupabase()
    plan = module._obtener_planificacion_por_id("plan-123")

    assert plan is not None
    assert plan["id"] == "plan-123"
