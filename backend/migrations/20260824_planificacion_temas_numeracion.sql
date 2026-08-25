-- Store independent labels and evaluation topics without changing schedule order.
ALTER TABLE cronograma_clases
  ADD COLUMN IF NOT EXISTS numero_tipo INTEGER;

WITH numeradas AS (
  SELECT
    id_clase,
    ROW_NUMBER() OVER (
      PARTITION BY id_planificacion, COALESCE(tipo, 'clase')
      ORDER BY numero, fecha_programada, id_clase
    )::INTEGER AS numero_tipo_calculado
  FROM cronograma_clases
)
UPDATE cronograma_clases AS c
SET numero_tipo = n.numero_tipo_calculado
FROM numeradas AS n
WHERE c.id_clase = n.id_clase;

ALTER TABLE cronograma_clases
  ALTER COLUMN numero_tipo SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_cronograma_clases_numero_tipo
  ON cronograma_clases (id_planificacion, COALESCE(tipo, 'clase'), numero_tipo);

ALTER TABLE examenes_planificacion
  ADD COLUMN IF NOT EXISTS temas_examen JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS posicion_examen INTEGER,
  ADD COLUMN IF NOT EXISTS temas_recuperatorio JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS posicion_recuperatorio INTEGER;
