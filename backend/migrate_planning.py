# migrate_planning.py
import asyncio
from app.core.database import supabase

async def migrar_tablas_planning():
    print("Migrando tablas para planificación académica...")

    try:
        # Tabla clases
        sql_clases = """
        CREATE TABLE IF NOT EXISTS clases (
            id_clase UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            id_curso UUID REFERENCES cursos(id_curso),
            orden INTEGER NOT NULL,
            fecha_programada TIMESTAMP NOT NULL,
            tema_clase TEXT NOT NULL,
            actividades_previstas TEXT,
            bibliografia_especifica TEXT,
            estado_clase TEXT DEFAULT 'pendiente',
            recursos_urls JSONB,
            created_at TIMESTAMP DEFAULT NOW()
        );
        """
        supabase.rpc('exec_sql', {'sql': sql_clases}).execute()

        # Tabla examenes
        sql_examenes = """
        CREATE TABLE IF NOT EXISTS examenes (
            id_examen UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            id_curso UUID REFERENCES cursos(id_curso),
            nombre TEXT NOT NULL,
            fecha TIMESTAMP NOT NULL,
            tiene_recuperatorio BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT NOW()
        );
        """
        supabase.rpc('exec_sql', {'sql': sql_examenes}).execute()

        # Tabla recuperatorios
        sql_recuperatorios = """
        CREATE TABLE IF NOT EXISTS recuperatorios (
            id_recuperatorio UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            id_examen UUID REFERENCES examenes(id_examen),
            fecha TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        );
        """
        supabase.rpc('exec_sql', {'sql': sql_recuperatorios}).execute()

        # Tabla intermedia clases_examenes
        sql_clases_examenes = """
        CREATE TABLE IF NOT EXISTS clases_examenes (
            id_clase UUID REFERENCES clases(id_clase),
            id_examen UUID REFERENCES examenes(id_examen),
            PRIMARY KEY (id_clase, id_examen)
        );
        """
        supabase.rpc('exec_sql', {'sql': sql_clases_examenes}).execute()

        # Tabla intermedia clases_recuperatorios
        sql_clases_recuperatorios = """
        CREATE TABLE IF NOT EXISTS clases_recuperatorios (
            id_clase UUID REFERENCES clases(id_clase),
            id_recuperatorio UUID REFERENCES recuperatorios(id_recuperatorio),
            PRIMARY KEY (id_clase, id_recuperatorio)
        );
        """
        supabase.rpc('exec_sql', {'sql': sql_clases_recuperatorios}).execute()

        print("✅ Tablas de planificación creadas exitosamente")
    except Exception as e:
        print(f"❌ Error en migración: {e}")

if __name__ == "__main__":
    asyncio.run(migrar_tablas_planning())