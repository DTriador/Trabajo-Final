import requests
import sys
import time
import uuid

BASE = 'http://127.0.0.1:8000/api/v1'

# Leer .env del backend para obtener SUPABASE_URL y SERVICE_KEY
env = {}
with open('backend/.env') as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if '=' in line:
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"')

SUPABASE_URL = env.get('SUPABASE_URL')
SERVICE_KEY = env.get('SUPABASE_SERVICE_KEY') or env.get('SUPABASE_ANON_KEY')
if not SUPABASE_URL or not SERVICE_KEY:
    print('No se encontró SUPABASE_URL o SERVICE_KEY en backend/.env')
    sys.exit(1)

unique = str(uuid.uuid4())[:8]
headers = {
    'apikey': SERVICE_KEY,
    'Authorization': f'Bearer {SERVICE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}

print('1) Crear usuario auth (admin) y fila docente via REST...')
email = f'test_{unique}@example.com'
create_user_payload = {
    'email': email,
    'password': 'Testpass123',
    'email_confirm': True
}
res = requests.post(f"{SUPABASE_URL}/auth/v1/admin/users", headers=headers, json=create_user_payload)
print('auth create status', res.status_code, res.text)
if res.status_code not in (200,201):
    print('Fallo al crear usuario auth:', res.status_code, res.text)
    sys.exit(1)
user = res.json()
id_docente = user.get('id')

docente_row = {
    'id_docente': id_docente,
    'nombre': 'Test Profe',
    'email': email,
    'username': f'testuser_{unique}',
    'fecha_nacimiento': '1990-01-01',
    'ciudad': 'TestCiudad',
    'telefono': '12345678'
}
res = requests.post(f"{SUPABASE_URL}/rest/v1/docentes", headers=headers, json=docente_row)
print('docente insert status', res.status_code, res.text)
if res.status_code not in (200,201):
    print('Fallo al insertar docente vía REST:', res.status_code, res.text)
    sys.exit(1)

print('2) Insertar escuela y curso vía REST...')
escuela_row = {'id_docente': id_docente, 'nombre_escuela': 'Escuela Test'}
res = requests.post(f"{SUPABASE_URL}/rest/v1/escuelas", headers=headers, json=escuela_row)
print('escuela insert status', res.status_code, res.text)
if res.status_code not in (200,201):
    print('Fallo al insertar escuela via REST:', res.status_code, res.text)
    sys.exit(1)
id_escuela = res.json()[0].get('id_escuela')

curso_row = {'id_escuela': id_escuela, 'nombre_materia': 'Materia Test', 'division': '1A', 'ciclo_lectivo': 2026}
res = requests.post(f"{SUPABASE_URL}/rest/v1/cursos", headers=headers, json=curso_row)
print('curso insert status', res.status_code, res.text)
if res.status_code not in (200,201):
    print('Fallo al insertar curso via REST:', res.status_code, res.text)
    sys.exit(1)
id_curso = res.json()[0].get('id_curso')

print('3) Insertar planificación + cronograma (via REST)...')
plan_row = {
    'id_docente': id_docente,
    'id_escuela': id_escuela,
    'id_curso': id_curso,
    'titulo_plan': 'Plan Test',
    'nombre_clase': 'Plan Test',
    'fecha': '2026-09-01T10:00:00',
    'duracion': '60',
    'tema': 'Tema test',
    'contenido_minimo': 'Contenido',
    'estado': 'activa'
}
res = requests.post(f"{SUPABASE_URL}/rest/v1/planificacion", headers=headers, json=plan_row)
print('plan insert status', res.status_code, res.text)
if res.status_code not in (200,201):
    print('Fallo al insertar plan via REST:', res.status_code, res.text)
    sys.exit(1)
id_plan = res.json()[0].get('id_planificacion') or res.json()[0].get('id')

cronograma_row = {
    'id_planificacion': id_plan,
    'numero': 1,
    'fecha_programada': '2026-09-01T10:00:00',
    'tema_clase': 'Introduccion',
    'tipo': 'clase',
    'estado_clase': 'programada'
}
res = requests.post(f"{SUPABASE_URL}/rest/v1/cronograma_clases", headers=headers, json=cronograma_row)
print('cronograma insert status', res.status_code, res.text)
if res.status_code not in (200,201):
    print('Fallo al insertar cronograma via REST:', res.status_code, res.text)
    sys.exit(1)

print('4) Llamar al endpoint backend DELETE curso...')
res = requests.delete(f"{BASE}/proyectos/cursos/{id_curso}")
print('backend delete status', res.status_code, res.text)

print('5) Verificar con REST que no existan planificaciones para id_curso')
res = requests.get(f"{SUPABASE_URL}/rest/v1/planificacion?select=*&id_curso=eq.{id_curso}", headers=headers)
print('planificacion remaining status', res.status_code, res.text)

res = requests.get(f"{SUPABASE_URL}/rest/v1/cronograma_clases?select=*&id_planificacion=eq.{id_plan}", headers=headers)
print('cronograma remaining status', res.status_code, res.text)

print('FIN')
