# Documentación Técnica: Proyecto Kōkua

# Este documento contiene los planos de ingeniería del sistema. Para visualizarlos en VS Code, presione Ctrl + Shift + V.

# 1. Flujo de Autenticación (OAuth2)
```mermaid
sequenceDiagram
    autonumber
    participant D as Docente (Frontend React)
    participant G as Google Auth API
    participant B as Kōkua Backend (FastAPI)
    participant S as Supabase (PostgreSQL)

    D->>G: Solicita Login (Popup)
    G-->>D: Devuelve Credential Token (JWT de Google)
    D->>B: Envía Token de Google para validación
    B->>G: Verifica integridad del Token (Client Secret)
    B->>S: Consulta/Registra perfil del Docente
    S-->>B: Retorna UUID y datos de sesión
    B-->>D: Retorna JWT interno de Kōkua + Perfil
```

# 2. Mapa de Módulos y Arquitectura
```mermaid
graph TD
    subgraph "Interfaz de Usuario (React)"
        A[Dashboard Principal] 
        B[Asistente Conversacional]
        C[Calendario Adaptativo]
    end

    subgraph "Servicios Backend (FastAPI)"
        E[Engine IA - Gemini Pro]
        F[Scheduler / Google Calendar API]
        G[Generador de Actividades / DOCX Engine]
    end

    subgraph "Infraestructura & Persistencia"
        H[(Supabase DB / RAG Context)]
        I[Google Cloud Platform]
        J[Supabase Storage]
    end

    A --- B & C
    B ==> E
    C ==> F
    E --> H
    F --> I
    G --> J
```

# 3. Diagrama de Casos de Uso
```mermaid
graph LR
    D((Docente)) 
    
    subgraph Sistema_Kokua [Sistema Kōkua]
        UC1([Iniciar Sesión OAuth2])
        UC2([Configurar Planificación])
        UC3([Generar Recurso IA])
        UC3a([Generar Actividad Didáctica])
        UC7([Gestionar Perfil])
    end

    D --> UC1
    D --> UC2
    D --> UC3
    UC3 -.->|include| UC3a
    D --> UC7

    subgraph Tipos_Actividades [Tipos de Generación]
        T1([Crucigramas])
        T2([Sopa de Letras])
        T3([Unir con Flechas])
        T4([Verdadero/Falso])
    end
    UC3a -.-> T1
    UC3a -.-> T2
    UC3a -.-> T3
    UC3a -.-> T4
```

# 4. Modelo Entidad-Relación (DER)
```mermaid
erDiagram
    DOCENTE ||--o{ INSTITUCION : pertenece_a
    INSTITUCION ||--o{ MATERIA : dicta
    MATERIA ||--|| PLANIFICACION : tiene
    PLANIFICACION ||--o{ TEMA : contiene
    TEMA ||--o{ RECURSO : genera
    
    DOCENTE {
        uuid id
        string email
        string nombre
        string apellido
    }
    RECURSO {
        uuid id
        string tipo_actividad
        string storage_path
        json metadata_ia
    }
```

# 5. Diagrama de Clases (Lógica de Generación)
```mermaid
classDiagram
    class GeminiEngine {
        +generate_didactic_resource(type, topic)
        -prompt_factory(type)
    }
    class ActivityGenerator {
        +create_crossword(data)
        +create_wordsearch(data)
        +create_matching(data)
        +to_docx()
    }
    GeminiEngine --> ActivityGenerator : proporciona JSON
```