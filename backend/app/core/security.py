import logging

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase_auth.errors import (
    AuthApiError,
    AuthRetryableError,
    AuthUnknownError,
)

from app.core.database import supabase


logger = logging.getLogger("kokua.auth")

# Ajustar tras probar con tokens reales.
_ESTADOS_TOKEN_RECHAZADO = {400, 401, 403}
_DETALLE_NO_AUTENTICADO = "No autenticado"
_DETALLE_SERVICIO_NO_DISPONIBLE = "Servicio de autenticación no disponible"

_bearer_scheme = HTTPBearer(auto_error=False)


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=_DETALLE_NO_AUTENTICADO,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _service_unavailable() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=_DETALLE_SERVICIO_NO_DISPONIBLE,
    )


def _log_auth_failure(error: Exception) -> None:
    logger.warning(
        "Supabase Auth failure type=%s status=%s code=%s",
        type(error).__name__,
        getattr(error, "status", None),
        getattr(error, "code", None),
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
):
    if credentials is None or credentials.scheme.lower() != "bearer" or not credentials.credentials:
        raise _unauthorized()

    try:
        response = supabase.auth.get_user(credentials.credentials)
    except AuthApiError as error:
        _log_auth_failure(error)
        if error.status in _ESTADOS_TOKEN_RECHAZADO:
            raise _unauthorized() from None
        raise _service_unavailable() from None
    except (AuthRetryableError, AuthUnknownError, httpx.TransportError) as error:
        _log_auth_failure(error)
        raise _service_unavailable() from None

    user = getattr(response, "user", None)
    if user is None or not getattr(user, "id", None):
        raise _unauthorized()

    return user