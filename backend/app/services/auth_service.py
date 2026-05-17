from app.core.database import supabase
from fastapi import HTTPException, status

class AuthService:
    @staticmethod
    def registrar_docente(datos: dict):
        """
        Registra docente con múltiples escuelas y materias.
        """

        try:
            # 1. Crear usuario en Supabase Auth
            res = supabase.auth.sign_up({
                "email": datos['email'],
                "password": datos['password'],
                "options": {
                    "data": {
                        "full_name": datos.get('nombre'),
                        "user_name": datos.get('username')
                    }
                }
            })

            if not res.user:
                raise Exception("No se pudo crear el usuario.")

            id_docente = res.user.id

            # 2. Perfil base docente
            perfil_docente = {
                "id_docente": id_docente,
                "nombre": datos.get('nombre'),
                "email": datos.get('email'),
                "username": datos.get('username'),
                "fecha_nacimiento": str(datos.get('fecha_nacimiento')),
                "ciudad": datos.get('ciudad'),
                "telefono": datos.get('telefono')
            }

            supabase.table("docentes").insert(perfil_docente).execute()

            # 3. ESCUELAS (N)
            escuelas = datos.get("escuelas", [])

            for escuela in escuelas:

                escuela_data = {
                    "id_docente": id_docente,
                    "nombre_escuela": escuela["nombre"],
                    "ciudad": escuela.get("ciudad")
                }

                escuela_res = supabase.table("escuelas").insert(escuela_data).execute()

                if not escuela_res.data:
                    continue

                id_escuela = escuela_res.data[0]["id_escuela"]

                # 4. MATERIAS dentro de cada escuela (N)
                materias = escuela.get("materias", [])

                for materia in materias:
                    curso_data = {
                        "id_escuela": id_escuela,
                        "nombre_materia": materia["nombre"],
                        "division": materia["division"],
                        "ciclo_lectivo": 2026
                    }

                    supabase.table("cursos").insert(curso_data).execute()

            return res

        except Exception as e:
            print(f"--- [AUTH SERVICE ERROR] ---: {str(e)}")
            raise Exception(str(e))
    
    @staticmethod
    def login_docente(email: str, password: str):
        """
        Autentica al docente contra Supabase Auth y devuelve la sesión.
        """
        try:
            res = supabase.auth.sign_in_with_password({
                "email": email,
                "password": password
            })
            
            if not res.session:
                raise Exception("No se pudo iniciar sesión.")
                
            return res
        except Exception as e:
            # Capturamos el error real (por ejemplo, si no confirmó el email)
            error_msg = str(e)
            print(f"--- [LOGIN ERROR] ---: {error_msg}")
            if "Email not confirmed" in error_msg:
                raise Exception("Por favor, confirma tu correo electrónico en tu bandeja de entrada.")
            raise Exception("Credenciales inválidas.")
    
    @staticmethod
    def actualizar_perfil(id_docente: str, datos: dict):
        """
        Actualiza los datos del docente en la tabla 'docentes'.
        """
        try:
            # Filtramos los campos que permitimos actualizar para evitar errores
            campos_permitidos = {
                "nombre": datos.get("nombre"),
                "username": datos.get("username"),
                "fecha_nacimiento": datos.get("fecha_nacimiento"),
                "ciudad": datos.get("ciudad"),
                "telefono": datos.get("telefono")
            }
            
            # Limpiamos valores None para no pisar datos existentes por error
            update_data = {k: v for k, v in campos_permitidos.items() if v is not None}

            res = supabase.table("docentes") \
                .update(update_data) \
                .eq("id_docente", id_docente) \
                .execute()

            if not res.data:
                raise Exception("No se encontró el perfil para actualizar.")

            return res.data[0]
        except Exception as e:
            print(f"--- [UPDATE PROFILE ERROR] ---: {str(e)}")
            raise Exception(f"Error al actualizar perfil: {str(e)}")