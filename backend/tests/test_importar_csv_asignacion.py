import asyncio
import os
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")

from app.api import router_alumnos  # noqa: E402


class FakeQuery:
    def __init__(self, db, nombre):
        self.db, self.nombre = db, nombre
        self.filtros, self.op, self.payload = [], "select", None
        self._range, self._limit = None, None

    def select(self, *_a, **_k):
        self.op = "select"
        return self

    def eq(self, col, val):
        self.filtros.append((col, val))
        return self

    def limit(self, n):
        self._limit = n
        return self

    def range(self, desde, hasta):
        self._range = (desde, hasta)
        return self

    def insert(self, payload):
        self.op, self.payload = "insert", payload
        return self

    def update(self, payload):
        self.op, self.payload = "update", payload
        return self

    def execute(self):
        filas = self.db.tablas[self.nombre]
        coinciden = [f for f in filas if all(f.get(c) == v for c, v in self.filtros)]
        if self.op == "insert":
            fila = dict(self.payload)
            if self.nombre == "alumnos":
                fila["id_alumno"] = f"nuevo-{len(filas) + 1}"
            filas.append(fila)
            return SimpleNamespace(data=[fila])
        if self.op == "update":
            for f in coinciden:
                f.update(self.payload)
            return SimpleNamespace(data=coinciden)
        datos = coinciden
        if self._range:
            datos = datos[self._range[0]:self._range[1] + 1]
        if self._limit:
            datos = datos[:self._limit]
        return SimpleNamespace(data=[dict(d) for d in datos])


class FakeSupabase:
    def __init__(self):
        self.tablas = {
            "escuelas": [
                {"id_escuela": "E1", "id_docente": "D1"},
                {"id_escuela": "E2", "id_docente": "D2"},
            ],
            "cursos": [
                {"id_curso": "C3A", "id_escuela": "E1"},
                {"id_curso": "C3B", "id_escuela": "E1"},
                {"id_curso": "CX", "id_escuela": "E2"},
            ],
            "alumnos": [
                {"id_alumno": "a1", "id_docente": "D1", "email": "ana@x.com", "id_curso": None, "id_escuela": None},
                {"id_alumno": "a2", "id_docente": "D1", "email": "beto@x.com", "id_curso": "C3B", "id_escuela": "E1"},
                {"id_alumno": "a3", "id_docente": "D1", "email": "carla@x.com", "id_curso": "C3A", "id_escuela": "E1"},
                {"id_alumno": "otro", "id_docente": "D2", "email": "ana@x.com", "id_curso": None, "id_escuela": None},
            ],
        }

    def table(self, nombre):
        return FakeQuery(self, nombre)


CSV = (
    "nombre,apellido,email\n"
    "Ana,Gomez,ANA@x.com\n"
    "Beto,Perez,beto@x.com\n"
    "Carla,Ruiz,carla@x.com\n"
    "Dora,Lima,dora@x.com\n"
    "Dora,Lima,dora@x.com\n"
    ",Sin,\n"
)


def _archivo(texto):
    datos = texto.encode("utf-8")

    async def leer():
        return datos

    return SimpleNamespace(read=leer)


def _importar(db, texto=CSV, id_docente="D1", id_curso="C3A", id_escuela="E1"):
    return asyncio.run(router_alumnos.importar_csv(
        id_docente=id_docente, id_curso=id_curso, id_escuela=id_escuela, file=_archivo(texto),
    ))


@pytest.fixture
def db(monkeypatch):
    falso = FakeSupabase()
    monkeypatch.setattr(router_alumnos, "supabase", falso)
    return falso


def test_importar_asigna_existentes_sin_curso_y_no_duplica(db):
    r = _importar(db)
    assert r["asignados"] == 1      # Ana ya existia sin curso
    assert r["creados"] == 2        # Beto (estaba en otra asignatura) y Dora
    assert r["ya_existian"] == 2    # Carla y la fila repetida de Dora
    assert len(r["errores"]) == 1   # fila sin nombre ni email

    ana = next(a for a in db.tablas["alumnos"] if a["id_alumno"] == "a1")
    assert ana["id_curso"] == "C3A" and ana["id_escuela"] == "E1"
    betos = [a for a in db.tablas["alumnos"] if a["email"] == "beto@x.com"]
    assert sorted(b["id_curso"] for b in betos) == ["C3A", "C3B"]
    doras = [a for a in db.tablas["alumnos"] if a["email"] == "dora@x.com"]
    assert len(doras) == 1


def test_importar_no_toca_alumnos_de_otro_docente(db):
    _importar(db)
    otro = next(a for a in db.tablas["alumnos"] if a["id_alumno"] == "otro")
    assert otro["id_curso"] is None and otro["id_escuela"] is None


def test_importar_dos_veces_es_idempotente(db):
    _importar(db)
    total = len(db.tablas["alumnos"])
    r = _importar(db)
    assert r["creados"] == 0 and r["asignados"] == 0 and r["ya_existian"] == 5
    assert len(db.tablas["alumnos"]) == total


def test_importar_rechaza_curso_de_otro_docente(db):
    with pytest.raises(HTTPException) as e:
        _importar(db, id_curso="CX", id_escuela=None)
    assert e.value.status_code == 400
    assert len(db.tablas["alumnos"]) == 4


def test_importar_exige_columnas_nombre_y_email(db):
    with pytest.raises(HTTPException) as e:
        _importar(db, texto="apellido,telefono\nGomez,123\n")
    assert e.value.status_code == 400
