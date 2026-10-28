import pytest
from fastapi import HTTPException

from app.api import router_alumnos


class FakeQuery:
    def __init__(self, records):
        self.records = records
        self.filters = {}

    def select(self, *_args):
        return self

    def eq(self, field, value):
        self.filters[field] = value
        return self

    def limit(self, _count):
        return self

    def execute(self):
        return type("Result", (), {
            "data": [
                row for row in self.records
                if all(row.get(key) == value for key, value in self.filters.items())
            ],
        })()


class FakeSupabase:
    def __init__(self):
        self.records = {
            "cursos": [
                {"id_curso": "curso-1", "id_escuela": "escuela-1"},
            ],
            "escuelas": [
                {"id_escuela": "escuela-1", "id_docente": "docente-1"},
                {"id_escuela": "escuela-2", "id_docente": "docente-2"},
            ],
        }

    def table(self, table_name):
        return FakeQuery(self.records[table_name])


def test_student_course_assignment_uses_its_school(monkeypatch):
    monkeypatch.setattr(router_alumnos, "supabase", FakeSupabase())

    school_id, course_id = router_alumnos._validar_asignacion_alumno(
        "docente-1", "escuela-1", "curso-1"
    )

    assert (school_id, course_id) == ("escuela-1", "curso-1")


def test_student_course_assignment_rejects_a_different_school(monkeypatch):
    monkeypatch.setattr(router_alumnos, "supabase", FakeSupabase())

    with pytest.raises(HTTPException) as error:
        router_alumnos._validar_asignacion_alumno(
            "docente-2", "escuela-2", "curso-1"
        )

    assert error.value.status_code == 400
    assert "no pertenece a la institución" in error.value.detail


def test_student_course_assignment_can_derive_school_from_course(monkeypatch):
    monkeypatch.setattr(router_alumnos, "supabase", FakeSupabase())

    school_id, course_id = router_alumnos._validar_asignacion_alumno(
        "docente-1", None, "curso-1"
    )

    assert (school_id, course_id) == ("escuela-1", "curso-1")
