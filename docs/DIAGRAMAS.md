# Diagramas del sistema · Kōkua

Los diagramas de esta carpeta corresponden al **Apéndice A** del Trabajo Final y reflejan la versión final del sistema
(octubre de 2026): Groq para generación de texto; Google Gemini para embeddings (`gemini-embedding-001`, 768 dimensiones)
y síntesis de voz; Supabase (PostgreSQL con pgvector, Auth y Storage); backend en Render y frontend en Vercel.

El modelo entidad-relación (A6a y A6b) se construyó a partir del esquema real de la base de datos
(tablas, claves primarias, claves foráneas y restricciones UNIQUE consultadas en `information_schema`).

Los PNG están en [`diagramas/`](diagramas/) y sus fuentes editables en [`diagramas/fuentes/`](diagramas/fuentes/).

| Figura | Diagrama | Imagen | Fuente |
|---|---|---|---|
| A1 | Arquitectura de solución | [PNG](diagramas/A1_arquitectura.png) | [`.dot`](diagramas/fuentes/A1_arquitectura.dot) (Graphviz) |
| A2 | Secuencia: flujo de autenticación | [PNG](diagramas/A2_autenticacion.png) | [`.mmd`](diagramas/fuentes/A2_autenticacion.mmd) (Mermaid) |
| A3 | Mapa de módulos | [PNG](diagramas/A3_modulos.png) | [`.dot`](diagramas/fuentes/A3_modulos.dot) (Graphviz) |
| A4 | Secuencia: flujo RAG (indexación y consulta) | [PNG](diagramas/A4_rag.png) | [`.mmd`](diagramas/fuentes/A4_rag.mmd) (Mermaid) |
| A5 | Casos de uso | [PNG](diagramas/A5_casos_uso.png) | [`.dot`](diagramas/fuentes/A5_casos_uso.dot) (Graphviz) |
| A6a | DER: núcleo académico | [PNG](diagramas/A6a_der_academico.png) | [`.mmd`](diagramas/fuentes/A6a_der_academico.mmd) (Mermaid) |
| A6b | DER: soporte (archivos, RAG, calendario) | [PNG](diagramas/A6b_der_soporte.png) | [`.mmd`](diagramas/fuentes/A6b_der_soporte.mmd) (Mermaid) |
| A7 | Diagrama de tiempo (Gantt, ProjectLibre) | [`Gantt/`](../Gantt/) | — |

## Cómo regenerar las imágenes

```bash
# Graphviz (A1, A3, A5)
dot -Tpng -Gdpi=200 diagramas/fuentes/A1_arquitectura.dot -o diagramas/A1_arquitectura.png

# Mermaid (A2, A4, A6a, A6b): requiere @mermaid-js/mermaid-cli
mmdc -i diagramas/fuentes/A2_autenticacion.mmd -o diagramas/A2_autenticacion.png -b white -s 3 -w 1400
```

Los archivos `.mmd` también se pueden previsualizar en VS Code (extensión *Markdown Preview Mermaid Support*) o pegar en https://mermaid.live.
Los `.dot` se pueden pegar en https://dreampuf.github.io/GraphvizOnline.

---

## A1. Arquitectura de solución
![A1](diagramas/A1_arquitectura.png)

## A2. Flujo de autenticación
![A2](diagramas/A2_autenticacion.png)

## A3. Mapa de módulos
![A3](diagramas/A3_modulos.png)

## A4. Flujo RAG
![A4](diagramas/A4_rag.png)

## A5. Casos de uso
![A5](diagramas/A5_casos_uso.png)

## A6a. Modelo entidad-relación: núcleo académico
![A6a](diagramas/A6a_der_academico.png)

## A6b. Modelo entidad-relación: soporte
![A6b](diagramas/A6b_der_soporte.png)

> Se muestran las columnas principales. Las líneas representan claves foráneas declaradas en la base; `UK` indica restricción UNIQUE (las de `calificaciones` y `asistencia` son compuestas). Las columnas `id_docente` / `id_escuela` de `planificacion`, `calificaciones_columnas`, `calificaciones`, `asistencia`, `eventos_recurrentes` y `feriados` se usan como criterio de filtrado, sin clave foránea declarada.
