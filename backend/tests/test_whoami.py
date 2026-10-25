from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.router_auth import router
from app.core import security


def _client():
    app = FastAPI()
    app.include_router(router, prefix="/api/v1/auth")
    return TestClient(app)


def test_whoami_requires_authorization_header():
    response = _client().get("/api/v1/auth/whoami")

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_whoami_returns_authenticated_user(monkeypatch):
    authenticated_user = SimpleNamespace(
        id="user-uuid",
        email="teacher@example.test",
    )
    received_tokens = []

    def fake_get_user(token):
        received_tokens.append(token)
        return SimpleNamespace(user=authenticated_user)

    monkeypatch.setattr(
        security.supabase,
        "auth",
        SimpleNamespace(get_user=fake_get_user),
    )

    response = _client().get(
        "/api/v1/auth/whoami",
        headers={"Authorization": "Bearer simulated-token"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "id": "user-uuid",
        "email": "teacher@example.test",
    }
    assert received_tokens == ["simulated-token"]