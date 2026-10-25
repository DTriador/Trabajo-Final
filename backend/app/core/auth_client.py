import os

from supabase import ClientOptions, create_client

from app.core.database import SUPABASE_SERVICE_KEY, SUPABASE_URL


def crear_cliente_auth():
    if not SUPABASE_URL:
        raise ValueError("Falta SUPABASE_URL para autenticar")

    supabase_key = os.environ.get("SUPABASE_ANON_KEY") or SUPABASE_SERVICE_KEY
    if not supabase_key:
        raise ValueError("Falta SUPABASE_ANON_KEY o SUPABASE_SERVICE_KEY para autenticar")

    options = ClientOptions(
        auto_refresh_token=False,
        persist_session=False,
    )
    return create_client(SUPABASE_URL, supabase_key, options)