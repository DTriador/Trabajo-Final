Regla principal y estricta: A partir de ahora, TODAS tus explicaciones, respuestas, análisis y comentarios dentro de los bloques de código deben generarse exclusivamente en idioma Español.

# Sistema Inteligente de Calificaciones

## Contexto del Proyecto

Este sistema ya cuenta con:

- sección "Mis Alumnos"
  - almacena alumnos con:
    - nombre
    - email
    - relación por institución/docente

- sección "Planificación"
  - bibliografía
  - contenido mínimo
  - cantidad de clases
  - cantidad de exámenes
  - recuperatorios

- sección "Generar Examen"
  - genera evaluaciones automáticamente usando:
    - PDFs
    - bibliografía
    - IA
  - soporta:
    - multiple choice
    - verdadero/falso
    - preguntas abiertas

El objetivo es agilizar el trabajo docente mediante IA.

---

# Nueva Funcionalidad

Implementar una nueva pestaña llamada:

## "Calificaciones"

La misma debe integrarse con:

- Mis Alumnos
- Planificación
- Generar Examen

---

# Requerimientos Funcionales

## 1. Tabla dinámica de notas

Crear una vista tipo Excel donde:

- cada fila represente un alumno
- las columnas se generen automáticamente según:
  - cantidad de exámenes
  - recuperatorios
  definidos en Planificación

Ejemplo:

| Alumno | Examen 1 | Recuperatorio 1 | Examen 2 |
|---|---|---|---|

---

## 2. Columnas adicionales dinámicas

Agregar botón:

+ Agregar Columna

Debe permitir crear columnas manuales:

- concepto
- TP
- participación
- conducta
- oral

Estas columnas NO deben requerir migraciones SQL.

---

## 3. Corrección automática con IA

El docente podrá subir PDFs resueltos por alumnos.

El sistema debe:

1. detectar alumno
2. buscar examen maestro
3. comparar respuestas usando IA semántica
4. asignar nota
5. actualizar automáticamente la tabla

---

## 4. Arquitectura Backend

Revisar modelos actuales en:

#folder:backend/models

Implementar solución escalable usando:

- FastAPI
- PostgreSQL
- JSONB
- SQLAlchemy
- Pydantic

---

## 5. Seguridad

Aplicar filtrado por:

- docente_id
- escuela_id

Un docente solo puede acceder a:

- sus alumnos
- sus exámenes
- sus materiales

---

## 6. Objetivo UX

La experiencia debe sentirse como:

- Google Sheets
- Excel
- Classroom

con edición rápida y visual.