from fastapi import APIRouter, HTTPException, status, Form
from app.services.auth_service import AuthService
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from datetime import date
import re
from app.core.database import supabase 
from typing import List, Optional
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import os
import secrets
import secrets
from datetime import datetime, timedelta
from app.services.email_service import enviar_email 


router = APIRouter(tags=["Autenticación"])


# --- ESQUEMAS DE VALIDACIÓN (Específicos para el Router) ---

class UserLogin(BaseModel):
    username: str 
    password: str

class MateriaSchema(BaseModel):
    nombre: str
    division: str

class EscuelaSchema(BaseModel):
    nombre: str
    ciudad: Optional[str] = None
    materias: List[MateriaSchema]

class UserRegister(BaseModel):
    nombre: str
    username: str
    fecha_nacimiento: date
    ciudad: str
    email: EmailStr
    telefono: str
    password: str
    confirm_password: str

    escuelas: List[EscuelaSchema]

    # VALIDACIÓN: El docente debe ser mayor de 18 años
    @field_validator('fecha_nacimiento')
    @classmethod
    def validar_edad(cls, v):
        today = date.today()
        edad = today.year - v.year - ((today.month, today.day) < (v.month, v.day))
        if edad < 18:
            raise ValueError('Acceso denegado: El docente debe ser mayor de 18 años.')
        return v

    # VALIDACIÓN: Contraseña Robusta (RF-Seguridad)
    @field_validator('password')
    @classmethod
    def password_robusta(cls, v):
        if len(v) < 8:
            raise ValueError('La contraseña debe tener al menos 8 caracteres.')
        if not re.search(r"[A-Z]", v):
            raise ValueError('La contraseña debe incluir al menos una mayúscula.')
        if not re.search(r"[0-9]", v):
            raise ValueError('La contraseña debe incluir al menos un número.')
        return v

    # VALIDACIÓN: Coincidencia de contraseñas (Pydantic v2 style)
    @model_validator(mode='after')
    def verificar_passwords(self) -> 'UserRegister':
        if self.password != self.confirm_password:
            raise ValueError("Las contraseñas no coinciden.")
        return self

class CambiarPassword(BaseModel):
    password_actual: str
    password_nueva: str
    confirm_password: str
    @field_validator('password_nueva')
    @classmethod
    def password_robusta(cls, v):
        if len(v) < 8:
            raise ValueError('La contraseña debe tener al menos 8 caracteres.')
        if not re.search(r"[A-Z]", v):
            raise ValueError('La contraseña debe incluir al menos una mayúscula.')
        if not re.search(r"[0-9]", v):
            raise ValueError('La contraseña debe incluir al menos un número.')
        return v
    @model_validator(mode='after')
    def passwords_coinciden(self) -> 'CambiarPassword':
        if self.password_nueva != self.confirm_password:
            raise ValueError("La nueva contraseña y la confirmación no coinciden.")
        if self.password_nueva == self.password_actual:
            raise ValueError("La nueva contraseña debe ser distinta a la actual.")
        return self
    
# --- ENDPOINTS ---

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def registro(datos: UserRegister):
    try:
        # Usamos model_dump() en lugar de dict() (estándar Pydantic v2)
        user = AuthService.registrar_docente(datos.model_dump())
        return {
            "message": "Usuario creado con éxito", 
            "id": user.user.id
        }
    except Exception as e:
        # Capturamos errores de duplicados o fallos en Supabase Auth
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Error en el registro: {str(e)}"
        )

@router.post("/login")
async def login(datos: UserLogin):
    try:
        # 1. Buscamos el email real asociado al username
        # Es fundamental para que el docente use su 'apodo' pero Supabase use su 'email'
        user_query = supabase.table("docentes") \
            .select("email, nombre, materia") \
            .eq("username", datos.username) \
            .execute()
        
        if not user_query.data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="El nombre de usuario no existe"
            )
            
        docente_db = user_query.data[0]
        email_real = docente_db["email"]

        # 2. Intento de login en Supabase Auth
        session_data = AuthService.login_docente(email_real, datos.password)
        
        return {
            "access_token": session_data.session.access_token,
            "token_type": "bearer",
            "user": {
                "id": session_data.user.id,
                "email": session_data.user.email,
                "nombre": docente_db.get("nombre", "Docente"),
                "username": datos.username,
                "materia": docente_db.get("materia", "General")
            }
        }
        
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Credenciales inválidas o error de conexión"
        )
# --- ENDPOINTS DE PERFIL ---

@router.get("/perfil/{user_id}")
async def obtener_perfil(user_id: str):
    try:
        # Buscamos en la columna correcta: "user_id"
        res = supabase.table("docentes").select("*").eq("id_docente", user_id).execute()
        
        if not res.data:
            raise HTTPException(status_code=404, detail="Perfil no encontrado")
        
        return res.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/perfil/{user_id}")
async def update_perfil(user_id: str, datos: dict):
    try:
        # Asegurate de que AuthService.actualizar_perfil también busque por "user_id" internamente
        return AuthService.actualizar_perfil(user_id, datos)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
@router.put("/perfil/{user_id}/password")
async def cambiar_password(user_id: str, datos: CambiarPassword):
    """Permite al docente cambiar su contraseña verificando la actual."""
    try:
        # 1. Buscamos el email del docente
        user_query = supabase.table("docentes")\
            .select("email")\
            .eq("id_docente", user_id)\
            .single().execute()
        if not user_query.data:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        email = user_query.data["email"]
        # 2. Verificamos la contraseña actual intentando un login
        try:
            supabase.auth.sign_in_with_password({
                "email": email,
                "password": datos.password_actual,
            })
        except Exception:
            raise HTTPException(status_code=401, detail="La contraseña actual es incorrecta")
        # 3. Actualizamos la contraseña con el admin client
        #    (necesita la SERVICE_ROLE_KEY en supabase)
        supabase.auth.admin.update_user_by_id(
            user_id,
            {"password": datos.password_nueva}
        )
        return {"status": "success", "message": "Contraseña actualizada correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error cambiando password: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
class GoogleLoginPayload(BaseModel):
    credential: str  # el JWT que devuelve @react-oauth/google
@router.post("/google")
async def login_google(datos: GoogleLoginPayload):
    """Login/registro con Google. Verifica el token y devuelve sesión."""
    try:
        # 1. Verificamos el token contra Google
        info = id_token.verify_oauth2_token(
            datos.credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
        email = info.get("email")
        nombre = info.get("name") or "Docente"
        google_sub = info.get("sub")
        if not email:
            raise HTTPException(status_code=400, detail="Token de Google sin email")
        # 2. Buscamos al docente en la base
        existing = supabase.table("docentes")\
            .select("*")\
            .eq("email", email)\
            .execute()
        if existing.data:
            docente = existing.data[0]
            # Para usuarios existentes de Google, usamos contraseña dummy
            random_pw = "google_oauth_dummy_password_12345"
        else:
            # 3. Si no existe en docentes, verificamos si existe en Auth
            base_username = email.split("@")[0]
            random_pw = "google_oauth_dummy_password_12345"
            try:
                # Intentamos crear el usuario en Supabase Auth
                new_auth_user = supabase.auth.admin.create_user({
                    "email": email,
                    "password": random_pw,
                    "email_confirm": True,
                })
                user_id = new_auth_user.user.id
            except Exception as e:
                if "already been registered" in str(e):
                    # Usuario ya existe en Auth, obtenemos su ID
                    users = supabase.auth.admin.list_users()
                    user_id = None
                    for user in users:
                        if user.email == email:
                            user_id = user.id
                            break
                    if not user_id:
                        raise HTTPException(status_code=400, detail="Usuario existe pero no encontrado")
                else:
                    raise
            # Insertamos en la tabla docentes (si no existe ya)
            insert_res = supabase.table("docentes").insert({
                "id_docente": user_id,
                "email": email,
                "nombre": nombre,
                "username": base_username,
                # "google_sub": google_sub,  # Comentado hasta agregar columna en Supabase
            }).execute()
            docente = insert_res.data[0]
        # 4. Iniciamos sesión en Supabase para obtener token válido
        session_data = supabase.auth.sign_in_with_password({
            "email": email,
            "password": random_pw
        })
        # 5. Devolvemos la sesión
        return {
            "access_token": session_data.session.access_token,
            "token_type": "bearer",
            "user": {
                "id": docente["id_docente"],
                "email": docente["email"],
                "nombre": docente.get("nombre", "Docente"),
                "username": docente.get("username", base_username if not existing.data else docente.get("username")),
                "isGoogle": True,
            },
        }
    except ValueError as e:
        # Token inválido o expirado
        raise HTTPException(status_code=401, detail=f"Token de Google inválido: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error en login Google: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/perfil-completo/{id_docente}")
async def perfil_completo(id_docente: str):
    try:
        # 1. Datos del docente
        docente_res = supabase.table("docentes").select("*").eq("id_docente", id_docente).single().execute()
        docente = docente_res.data or {}

        # 2. Escuelas vinculadas
        escuelas_res = supabase.table("escuela_docente") \
            .select("id_escuela, escuelas(id_escuela, nombre_escuela)") \
            .eq("id_docente", id_docente).execute()
        escuelas = [
            {"id_escuela": e["escuelas"]["id_escuela"], "nombre": e["escuelas"]["nombre_escuela"]}
            for e in (escuelas_res.data or []) if e.get("escuelas")
        ]

        # 3. Cursos / materias del docente
        cursos_res = supabase.table("cursos").select("*").eq("id_docente", id_docente).execute()
        cursos = [
            {
                "id_curso": c.get("id_curso"),
                "materia": c.get("nombre_materia"),
                "division": c.get("division"),
                "id_escuela": c.get("id_escuela"),
            }
            for c in (cursos_res.data or [])
        ]

        return {
            "docente": docente,
            "escuelas": escuelas,
            "cursos": cursos
        }
    except Exception as e:
        print(f"❌ Error perfil-completo: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@router.post("/forgot-password")
async def forgot_password(email: str = Form(...)):
    """Genera token y envía email con link de reseteo."""
    try:
        res = supabase.table("docentes").select("*").eq("email", email).execute()
        if not res.data:
            # Por seguridad NO revelamos si el email existe
            return {"status": "ok", "message": "Si el email existe, recibirás un correo."}
        docente = res.data[0]
        token = secrets.token_urlsafe(32)
        expira = (datetime.now() + timedelta(hours=1)).isoformat()
        supabase.table("docentes").update({
            "reset_token": token,
            "reset_token_expira": expira
        }).eq("id_docente", docente["id_docente"]).execute()
        # ⚠️ Cambiá la URL si tu frontend corre en otro puerto
        link = f"http://localhost:5173/?reset_token={token}"
        cuerpo = f"""
        <div style="font-family: Arial; max-width: 600px; margin: auto; padding: 20px;">
            <h2 style="color: #f472b6;">🔒 Restablecer contraseña</h2>
            <p>Hola <b>{docente.get('nombre', 'profe')}</b>,</p>
            <p>Recibimos una solicitud para restablecer tu contraseña en Kōkua.</p>
            <p style="margin: 20px 0;">
                <a href="{link}" style="background:#f472b6;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
                    Restablecer mi contraseña
                </a>
            </p>
            <p style="color:#666;font-size:13px;">Este link es válido por <b>1 hora</b>. Si no fuiste vos, ignorá este mail.</p>
            <p style="color:#999;font-size:12px;margin-top:30px;">— Kōkua</p>
        </div>
        """
        enviar_email([email], "🔒 Restablecer contraseña - Kōkua", cuerpo)
        return {"status": "ok", "message": "Si el email existe, recibirás un correo."}
    except Exception as e:
        print(f"❌ forgot-password: {e}")
        raise HTTPException(500, str(e))
@router.post("/reset-password")
async def reset_password(token: str = Form(...), nueva_password: str = Form(...)):
    """Valida token y actualiza la contraseña usando Supabase Auth Admin."""
    try:
        if len(nueva_password) < 8:
            raise HTTPException(400, "La contraseña debe tener al menos 8 caracteres")
        res = supabase.table("docentes").select("*").eq("reset_token", token).execute()
        if not res.data:
            raise HTTPException(400, "Token inválido o ya usado")
        docente = res.data[0]
        expira = datetime.fromisoformat(docente["reset_token_expira"])
        if datetime.now() > expira:
            raise HTTPException(400, "El link expiró. Pedí uno nuevo.")
        # ✅ Usamos Supabase Auth Admin (igual que en cambiar_password)
        supabase.auth.admin.update_user_by_id(
            docente["id_docente"],
            {"password": nueva_password}
        )
        # Limpiamos el token para que no se reutilice
        supabase.table("docentes").update({
            "reset_token": None,
            "reset_token_expira": None
        }).eq("id_docente", docente["id_docente"]).execute()
        return {"status": "ok", "message": "Contraseña actualizada correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ reset-password: {e}")
        raise HTTPException(500, str(e))