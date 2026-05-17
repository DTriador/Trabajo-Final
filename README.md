# Kōkua - Asistente Ecosistémico con Inteligencia Artificial para la Gestión Docente

Kōkua (del hawaiano *ayuda, cooperación, espíritu de asistencia*) es una plataforma web integral de arquitectura desacoplada diseñada para optimizar, automatizar y centralizar la labor diaria de los profesionales de la educación. El sistema actúa como un copiloto inteligente que fusiona la automatización de flujos de trabajo pedagógicos, la analítica predictiva de estudiantes, la planificación curricular adaptativa y la generación interactiva de material didáctico multimedia en un único entorno unificado.

A diferencia de las soluciones tradicionales dispersas, Kōkua unifica la gestión administrativa (asistencia, calificaciones y organización escolar) con capacidades avanzadas de modelos de lenguaje de gran tamaño (LLMs) y arquitecturas de recuperación de información (RAG), permitiendo a los docentes enfocar su tiempo en los procesos de enseñanza-aprendizaje.

---

##  Características Clave y Módulos del Sistema

El ecosistema de Kōkua se despliega a través de un panel de control interactivo estructurado en áreas funcionales críticas:

### 1. Gestión Escolar y Administrativa Centralizada
* **Organización Multiescuela:** Soporte modular para gestionar diferentes instituciones, asignaturas y cursos de manera aislada y ordenada.
* **Asistencia y Calificaciones:** Interfaz dinámica y ágil para el seguimiento en tiempo real del rendimiento y presentismo del alumnado.
* **Asistente de Importación:** Módulo dedicado para la migración e ingesta de nóminas de alumnos a través de hojas de cálculo (Excel).

### 2. Generación Avanzada de Contenido Curricular (Engine IA)
* **Planificación Adaptativa:** Asistente guiado por pasos (Wizard) para formular planificaciones anuales, periódicas o por unidades, parametrizadas por materia y normativas institucionales.
* **Generador de Actividades y Evaluaciones:** Generación automatizada de rúbricas de evaluación, cuestionarios interactivos y dinámicas de gamificación basadas en cuadrículas o texto.
* **Producción de Materiales Educativos:** Capacidad de síntesis de contenidos complejos y estructuración automatizada de unidades didácticas personalizadas.

### 3. Orquestación RAG y Biblioteca Inteligente
* **Biblioteca Digital Interactiva:** Repositorio personal de recursos educativos donde el docente puede centralizar su material de lectura y documentos de cátedra.
* **Consultas Contextuales (RAG):** Motor de generación aumentada por recuperación que permite al docente "chatear" con sus propios documentos pedagógicos, normativas de la institución o planificaciones previas, garantizando respuestas precisas y libres de alucinaciones.

### 4. Automatización y Gestión del Tiempo
* **Calendario Docente:** Sistema de agenda inteligente integrado que centraliza las fechas clave, entregas de exámenes, efemérides y recordatorios automatizados.
* **Notificaciones Automatizadas:** Servicio backend para el envío de recordatorios y alertas por correo electrónico, disminuyendo la carga operativa de seguimiento.

---

##  Stack Tecnológico y Arquitectura

El sistema implementa un patrón de **Arquitectura Desacoplada** para garantizar alta disponibilidad, escalabilidad horizontal y un despliegue optimizado en entornos Cloud:

### Frontend
* **Core:** React.js (v18+) con Vite como bundler ultra-rápido para el desarrollo y optimización de assets.
* **Estilos:** CSS3 nativo y componentes modulares responsivos.
* **Estado y Rutas:** React Router DOM para la navegación SPA (*Single Page Application*) y Context API para la gestión global del estado de autenticación.
* **Cliente HTTP:** Axios configurado con interceptores globales para el manejo de tokens de sesión.

### Backend
* **Framework:** FastAPI (Python), seleccionado por su alto rendimiento asincrónico (ASGI) y documentación automática nativa mediante OpenAPI/Swagger.
* **Motor de IA:** Integración dual mediante SDKs oficiales con proveedores de modelos fundacionales de última generación (OpenAI API y Gemini API).
* **Persistencia y Base de Datos:** Supabase (PostgreSQL) como servicio para la gestión relacional de datos, control de usuarios y almacenamiento seguro.
* **Servicios:** Módulos asincrónicos especializados para orquestación RAG, procesamiento de prompts, utilidades de almacenamiento en la nube y automatización de correos electrónicos.

---