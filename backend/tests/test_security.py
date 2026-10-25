import logging
from types import SimpleNamespace

import httpx
import pytest
from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.testclient import TestClient
from supabase_auth.errors import (
    AuthApiError,
    AuthRetryableError,
    AuthUnknownError,
)

from app.core import security


def _credentials(token="test-token", scheme="Bearer"):
    return HTTPAuthorizationCredentials(scheme=scheme, credentials=token)


def _install_get_user(monkeypatch, implementation):
    monkeypatch.setattr(
        security.supabase,
        "auth",
        SimpleNamespace(get_user=implementation),
    )


def _http_app():
    app = FastAPI()

    @app.get("/x")
    def x(user=Depends(security.get_current_user)):
        return {"id": user.id}

    return app


def test_get_current_user_returns_user_and_passes_exact_token(monkeypatch):
    authenticated_user = SimpleNamespace(id="user-uuid")
    received_tokens = []

    def fake_get_user(token):
        received_tokens.append(token)
        return SimpleNamespace(user=authenticated_user)

    _install_get_user(monkeypatch, fake_get_user)

    user = security.get_current_user(_credentials("exact-token-value"))

    assert received_tokens == ["exact-token-value"]
    assert user is authenticated_user
    assert user.id == "user-uuid"


@pytest.mark.parametrize("auth_status", [400, 401, 403])
def test_auth_api_rejected_token_returns_401(monkeypatch, auth_status):
    _install_get_user(
        monkeypatch,
        lambda _token: (_ for _ in ()).throw(
            AuthApiError("private auth message", auth_status, "invalid_jwt")
        ),
    )

    with pytest.raises(HTTPException) as error:
        security.get_current_user(_credentials())

    assert error.value.status_code == 401
    assert error.value.detail == "No autenticado"
    assert error.value.headers == {"WWW-Authenticate": "Bearer"}


@pytest.mark.parametrize("auth_status", [429, 500])
def test_auth_api_service_status_returns_503(monkeypatch, auth_status):
    _install_get_user(
        monkeypatch,
        lambda _token: (_ for _ in ()).throw(
            AuthApiError("private auth message", auth_status, "server_error")
        ),
    )

    with pytest.raises(HTTPException) as error:
        security.get_current_user(_credentials())

    assert error.value.status_code == 503
    assert error.value.detail == "Servicio de autenticación no disponible"


@pytest.mark.parametrize(
    "auth_error",
    [
        AuthRetryableError("private retry message", 503),
        AuthUnknownError("private unknown message", RuntimeError("private cause")),
        httpx.ConnectError("private connection message"),
    ],
    ids=["retryable", "unknown", "connect"],
)
def test_transport_and_retryable_auth_errors_return_503(monkeypatch, auth_error):
    def fail(_token):
        raise auth_error

    _install_get_user(monkeypatch, fail)

    with pytest.raises(HTTPException) as error:
        security.get_current_user(_credentials())

    assert error.value.status_code == 503
    assert error.value.detail == "Servicio de autenticación no disponible"


def test_unexpected_runtime_error_propagates(monkeypatch):
    def fail(_token):
        raise RuntimeError("programming error")

    _install_get_user(monkeypatch, fail)

    with pytest.raises(RuntimeError, match="programming error"):
        security.get_current_user(_credentials())


@pytest.mark.parametrize(
    "response",
    [
        SimpleNamespace(user=None),
        SimpleNamespace(user=SimpleNamespace()),
    ],
    ids=["no-user", "user-without-id"],
)
def test_response_without_user_or_id_returns_401(monkeypatch, response):
    _install_get_user(monkeypatch, lambda _token: response)

    with pytest.raises(HTTPException) as error:
        security.get_current_user(_credentials())

    assert error.value.status_code == 401
    assert error.value.detail == "No autenticado"


@pytest.mark.parametrize(
    "auth_error",
    [
        AuthApiError("private auth message", 401, "invalid_jwt"),
        AuthRetryableError("private retry message", 503),
        AuthUnknownError("private unknown message", RuntimeError("private cause")),
        httpx.ConnectError("private connection message"),
    ],
    ids=["api", "retryable", "unknown", "connect"],
)
def test_auth_failure_logs_do_not_include_token(monkeypatch, caplog, auth_error):
    secret_token = "never-log-this-token"

    def fail(_token):
        raise auth_error

    _install_get_user(monkeypatch, fail)

    with caplog.at_level(logging.WARNING, logger="kokua.auth"):
        with pytest.raises(HTTPException):
            security.get_current_user(_credentials(secret_token))

    assert caplog.records
    assert all(secret_token not in record.getMessage() for record in caplog.records)
    assert all("private" not in record.getMessage() for record in caplog.records)


@pytest.mark.parametrize(
    "credentials",
    [
        None,
        HTTPAuthorizationCredentials(scheme="Bearer", credentials=""),
        HTTPAuthorizationCredentials(scheme="Basic", credentials="abc"),
    ],
    ids=["missing", "empty", "wrong-scheme"],
)
def test_get_current_user_rejects_missing_wrong_scheme_or_empty_token(credentials):
    with pytest.raises(HTTPException) as error:
        security.get_current_user(credentials)

    assert error.value.status_code == 401
    assert error.value.detail == "No autenticado"
    assert error.value.headers == {"WWW-Authenticate": "Bearer"}


def test_fastapi_dependency_returns_401_without_authorization_header():
    response = TestClient(_http_app()).get("/x")

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_fastapi_dependency_returns_401_for_basic_authorization():
    response = TestClient(_http_app()).get(
        "/x", headers={"Authorization": "Basic abc"}
    )

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_fastapi_dependency_returns_validated_user_id(monkeypatch):
    authenticated_user = SimpleNamespace(id="authenticated-user-uuid")
    received_tokens = []

    def fake_get_user(token):
        received_tokens.append(token)
        return SimpleNamespace(user=authenticated_user)

    _install_get_user(monkeypatch, fake_get_user)
    response = TestClient(_http_app()).get(
        "/x", headers={"Authorization": "Bearer valid-simulated-token"}
    )

    assert response.status_code == 200
    assert response.json() == {"id": "authenticated-user-uuid"}
    assert received_tokens == ["valid-simulated-token"]