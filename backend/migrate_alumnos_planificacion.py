import asyncio
from app.core.database import supabase


async def migrar_alumnos_y_planificaciones():
    sql = """
    ALTER TABLE alumnos
      ADD COLUMN IF NOT EXISTS id_escuela UUID REFERENCES escuelas(id_escuela);

    UPDATE alumnos AS a
    SET id_escuela = c.id_escuela
    FROM cursos AS c
    WHERE a.id_curso = c.id_curso
      AND a.id_escuela IS NULL;

    ALTER TABLE planificacion
      ADD COLUMN IF NOT EXISTS color TEXT;

    WITH pendientes AS (
      SELECT
        id_planificacion,
        (ARRAY[
          '#f472b6', '#818cf8', '#34d399', '#60a5fa',
          '#a78bfa', '#e879f9', '#2dd4bf'
        ])[((ROW_NUMBER() OVER (ORDER BY created_at, id_planificacion) - 1) % 7) + 1] AS color_asignado
      FROM planificacion
      WHERE color IS NULL
    )
    UPDATE planificacion AS p
    SET color = pendientes.color_asignado
    FROM pendientes
    WHERE p.id_planificacion = pendientes.id_planificacion;
    """
    supabase.rpc("exec_sql", {"sql": sql}).execute()
    print("Migración de alumnos y colores de planificación completada.")


if __name__ == "__main__":
    asyncio.run(migrar_alumnos_y_planificaciones())
