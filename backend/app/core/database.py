# app/core/database.py
import os
from supabase import create_client, Client
from dotenv import load_dotenv

# --- CONFIGURACIÓN DE RUTA PARA LINUX ---
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
env_path = os.path.join(base_dir, ".env")
load_dotenv(env_path)

# Variables de entorno
SUPABASE_URL: str = os.environ.get("SUPABASE_URL")
# Preferimos la SERVICE key (bypassa RLS desde el backend).
# Si no existe, caemos a la ANON como respaldo.
SUPABASE_KEY: str = (
    os.environ.get("SUPABASE_SERVICE_KEY")
    or os.environ.get("SUPABASE_ANON_KEY")
)

if not SUPABASE_URL or not SUPABASE_KEY:
    print(f"ERROR: No se encontró el archivo .env en {env_path}")
    raise ValueError("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY/SUPABASE_ANON_KEY en el entorno.")

# Cliente de Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
