# migrate_cursos.py
import asyncio
from app.core.database import supabase

async def migrar_tabla_cursos():
    print("Migrando tabla cursos para agregar campos de contenido mínimo...")

    try:
        # Ejecutar SQL para agregar columnas si no existen
        sql = """
        ALTER TABLE cursos
        ADD COLUMN IF NOT EXISTS contenido_minimo TEXT,
        ADD COLUMN IF NOT EXISTS bibliografia JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS fuentes TEXT;
        """
        supabase.rpc('exec_sql', {'sql': sql}).execute()
        print("✅ Columnas agregadas exitosamente")
    except Exception as e:
        print(f"❌ Error en migración: {e}")

if __name__ == "__main__":
    asyncio.run(migrar_tabla_cursos())