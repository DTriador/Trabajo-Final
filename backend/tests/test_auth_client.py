import os
from types import SimpleNamespace

import pytest

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service")

from app.api import router_auth
from app.core import auth_client
from app.services import auth_service


class FailIfGlobalLogin:
    def sign_in_with_password(self, *_args, **_kwargs):
        raise AssertionError("El login no debe usar el cliente global")

    def sign_in_with_id_token(self, *_args, **_kwargs):
        raise AssertionError("El login no debe usar el cliente global")


def test_crear_cliente_auth_returns_new_unpersisted_client_each_time(monkeypatch):
    created = []

    def fake_create_client(url, key, options):
        client = object()
        created.append((client, url, key, options))
        return client

    monkeypatch.setattr(auth_client, "SUPABASE_URL", "https://supabase.test")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "anon-test")
    monkeypatch.setattr(auth_client, "SUPABASE_SERVICE_KEY", "service-test")
    monkeypatch.setattr(auth_client, "create_client", fake_create_client)

    first = auth_client.crear_cliente_auth()
    second = auth_client.crear_cliente_auth()

    assert first is not second
    assert [(url, key) for _, url, key, _ in created] == [
        ("https://supabase.test", "anon-test"),
        ("https://supabase.test", "anon-test"),
    ]
    assert all(options.auto_refresh_token is False for *_, options in created)
    assert all(options.persist_session is False for *_, options in created)


def test_crear_cliente_auth_falls_back_to_service_key(monkeypatch):
    captured = {}

    def fake_create_client(url, key, options):
        captured.update(url=url, key=key, options=options)
        return object()

    monkeypatch.setattr(auth_client, "SUPABASE_URL", "https://supabase.test")
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)
    monkeypatch.setattr(auth_client, "SUPABASE_SERVICE_KEY", "service-test")
    monkeypatch.setattr(auth_client, "create_client", fake_create_client)

    auth_client.crear_cliente_auth()

    assert captured["key"] == "service-test"


def test_crear_cliente_auth_requires_url_and_key(monkeypatch):
    monkeypatch.setattr(auth_client, "SUPABASE_URL", "https://supabase.test")
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)
    monkeypatch.setattr(auth_client, "SUPABASE_SERVICE_KEY", None)

    with pytest.raises(ValueError, match="SUPABASE_ANON_KEY o SUPABASE_SERVICE_KEY"):
        auth_client.crear_cliente_auth()


def test_login_docente_uses_disposable_auth_client(monkeypatch):
    session_data = SimpleNamespace(
        session=SimpleNamespace(access_token="session-token"),
        user=SimpleNamespace(id="user-uuid"),
    )
    received = {}

    class FakeAuth:
        def sign_in_with_password(self, credentials):
            received["credentials"] = credentials
            return session_data

    monkeypatch.setattr(auth_service, "supabase", SimpleNamespace(auth=FailIfGlobalLogin()))
    monkeypatch.setattr(
        auth_service,
        "crear_cliente_auth",
        lambda: SimpleNamespace(auth=FakeAuth()),
    )

    result = auth_service.AuthService.login_docente("teacher@example.test", "password")

    assert result is session_data
    assert received["credentials"] == {
        "email": "teacher@example.test",
        "password": "password",
    }


def test_registrar_docente_uses_disposable_auth_client(monkeypatch):
    auth_response = SimpleNamespace(user=SimpleNamespace(id="new-user-uuid"))
    received = {}

    class FakeAuth(FailIfGlobalLogin):
        def sign_up(self, credentials):
            received["credentials"] = credentials
            return auth_response

    class FakeInsert:
        def insert(self, values):
            received.setdefault("inserts", []).append(values)
            return self

        def execute(self):
            return SimpleNamespace(data=[])

    class FakeAdmin:
        def table(self, _table_name):
            return FakeInsert()

    monkeypatch.setattr(
        auth_service,
        "supabase",
        SimpleNamespace(auth=FailIfGlobalLogin()),
    )
    monkeypatch.setattr(auth_service, "supabase_admin", FakeAdmin())
    monkeypatch.setattr(
        auth_service,
        "crear_cliente_auth",
        lambda: SimpleNamespace(auth=FakeAuth()),
    )

    datos = {
        "email": "new-teacher@example.test",
        "password": "Password123!",
        "nombre": "New Teacher",
        "username": "newteacher",
        "fecha_nacimiento": "1990-01-01",
        "ciudad": "Córdoba",
        "telefono": "5551234",
        "escuelas": [],
    }
    result = auth_service.AuthService.registrar_docente(datos)

    assert result is auth_response
    assert received["credentials"] == {
        "email": "new-teacher@example.test",
        "password": "Password123!",
        "options": {
            "data": {
                "full_name": "New Teacher",
                "user_name": "newteacher",
            }
        },
    }
    assert received["inserts"] == [{
        "id_docente": "new-user-uuid",
        "nombre": "New Teacher",
        "email": "new-teacher@example.test",
        "username": "newteacher",
        "fecha_nacimiento": "1990-01-01",
        "ciudad": "Córdoba",
        "telefono": "5551234",
    }]


@pytest.mark.asyncio
async def test_google_login_uses_disposable_auth_client(monkeypatch):
    session_data = SimpleNamespace(
        session=SimpleNamespace(access_token="session-token"),
        user=SimpleNamespace(id="user-uuid"),
    )
    received = {}

    class FakeAuth:
        def sign_in_with_id_token(self, credentials):
            received["credentials"] = credentials
            return session_data

    class FakeQuery:
        def select(self, *_args, **_kwargs):
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def execute(self):
            return SimpleNamespace(data=[{
                "id_docente": "user-uuid",
                "email": "teacher@example.test",
                "nombre": "Teacher",
                "username": "teacher",
            }])

    class FakeAdmin:
        def table(self, _name):
            return FakeQuery()

    monkeypatch.setattr(router_auth, "GOOGLE_CLIENT_ID", "test-client")
    monkeypatch.setattr(
        router_auth.id_token,
        "verify_oauth2_token",
        lambda *_args: {
            "email": "teacher@example.test",
            "name": "Teacher",
            "email_verified": True,
        },
    )
    monkeypatch.setattr(router_auth.google_requests, "Request", lambda: object())
    monkeypatch.setattr(router_auth, "supabase", SimpleNamespace(auth=FailIfGlobalLogin()))
    monkeypatch.setattr(router_auth, "supabase_admin", FakeAdmin())
    monkeypatch.setattr(
        router_auth,
        "crear_cliente_auth",
        lambda: SimpleNamespace(auth=FakeAuth()),
    )

    result = await router_auth.login_google(
        router_auth.GoogleLoginPayload(credential="google-id-token")
    )

    assert received["credentials"] == {
        "provider": "google",
        "token": "google-id-token",
    }
    assert result["access_token"] == "session-token"
    assert result["user"]["id"] == "user-uuid"


@pytest.mark.asyncio
async def test_password_verification_uses_disposable_auth_client(monkeypatch):
    received = {}

    class FakeQuery:
        def select(self, *_args, **_kwargs):
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def single(self):
            return self

        def execute(self):
            return SimpleNamespace(data={"email": "teacher@example.test"})

    class FakeGlobalAuth(FailIfGlobalLogin):
        def __init__(self):
            self.admin = SimpleNamespace(
                update_user_by_id=lambda *_args, **_kwargs: {"updated": True}
            )

    class FakeAuth:
        def sign_in_with_password(self, credentials):
            received["credentials"] = credentials
            return SimpleNamespace(session=object())

    monkeypatch.setattr(
        router_auth,
        "supabase",
        SimpleNamespace(auth=FakeGlobalAuth(), table=lambda _name: FakeQuery()),
    )
    monkeypatch.setattr(
        router_auth,
        "crear_cliente_auth",
        lambda: SimpleNamespace(auth=FakeAuth()),
    )

    result = await router_auth.cambiar_password(
        "user-uuid",
        router_auth.CambiarPassword(
            password_actual="Current1!",
            password_nueva="NewPass2!",
            confirm_password="NewPass2!",
        ),
    )

    assert received["credentials"] == {
        "email": "teacher@example.test",
        "password": "Current1!",
    }
    assert result["status"] == "success"