-- Additive migration for school grouping and planning colors.
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
      '#a78bfa', '#e879f9', '#2dd4bf', '#fb7185',
      '#22d3ee', '#a3e635', '#38bdf8', '#10b981',
      '#c084fc', '#f43f5e', '#0ea5e9', '#14b8a6',
      '#84cc16', '#c026d3', '#7c3aed', '#2563eb',
      '#059669', '#db2777', '#0891b2', '#65a30d'
    ])[((ROW_NUMBER() OVER (
      PARTITION BY id_docente
      ORDER BY created_at, id_planificacion
    ) - 1) % 24) + 1] AS color_asignado
  FROM planificacion
)
UPDATE planificacion AS p
SET color = pendientes.color_asignado
FROM pendientes
WHERE p.id_planificacion = pendientes.id_planificacion;
