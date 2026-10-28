-- Add a course/subject assignment to each student without removing existing rows.
ALTER TABLE public.alumnos
  ADD COLUMN IF NOT EXISTS id_curso UUID;

-- Complete the school reference where an existing course already identifies it.
UPDATE public.alumnos AS alumno
SET id_escuela = curso.id_escuela
FROM public.cursos AS curso
WHERE alumno.id_curso = curso.id_curso
  AND alumno.id_escuela IS NULL;

-- Keep any pre-existing orphaned values for review, while enforcing the FK
-- for new and updated rows. The constraint can be validated after old data is checked.
DO $$
DECLARE
  alumno_curso_attnum SMALLINT;
  curso_id_attnum SMALLINT;
BEGIN
  SELECT attnum INTO alumno_curso_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.alumnos'::regclass
    AND attname = 'id_curso'
    AND NOT attisdropped;

  SELECT attnum INTO curso_id_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.cursos'::regclass
    AND attname = 'id_curso'
    AND NOT attisdropped;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.alumnos'::regclass
      AND confrelid = 'public.cursos'::regclass
      AND contype = 'f'
      AND conkey = ARRAY[alumno_curso_attnum]::SMALLINT[]
      AND confkey = ARRAY[curso_id_attnum]::SMALLINT[]
  ) THEN
    ALTER TABLE public.alumnos
      ADD CONSTRAINT fk_alumnos_id_curso_cursos
      FOREIGN KEY (id_curso)
      REFERENCES public.cursos(id_curso)
      NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_alumnos_id_curso
  ON public.alumnos (id_curso);

NOTIFY pgrst, 'reload schema';
