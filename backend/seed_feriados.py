# seed_feriados.py
import asyncio
from app.core.database import supabase

feriados_argentina_2026 = [
    {"nombre": "Año Nuevo", "fecha_inicio": "2026-01-01", "fecha_fin": "2026-01-01", "tipo": "feriado"},
    {"nombre": "Carnaval", "fecha_inicio": "2026-02-17", "fecha_fin": "2026-02-18", "tipo": "feriado"},
    {"nombre": "Día Nacional de la Memoria por la Verdad y la Justicia", "fecha_inicio": "2026-03-24", "fecha_fin": "2026-03-24", "tipo": "feriado"},
    {"nombre": "Día del Veterano y de los Caídos en la Guerra de Malvinas", "fecha_inicio": "2026-04-02", "fecha_fin": "2026-04-02", "tipo": "feriado"},
    {"nombre": "Jueves Santo", "fecha_inicio": "2026-04-02", "fecha_fin": "2026-04-02", "tipo": "feriado"},
    {"nombre": "Viernes Santo", "fecha_inicio": "2026-04-03", "fecha_fin": "2026-04-03", "tipo": "feriado"},
    {"nombre": "Día del Trabajador", "fecha_inicio": "2026-05-01", "fecha_fin": "2026-05-01", "tipo": "feriado"},
    {"nombre": "Día de la Revolución de Mayo", "fecha_inicio": "2026-05-25", "fecha_fin": "2026-05-25", "tipo": "feriado"},
    {"nombre": "Día de la Bandera", "fecha_inicio": "2026-06-20", "fecha_fin": "2026-06-20", "tipo": "feriado"},
    {"nombre": "Día de la Independencia", "fecha_inicio": "2026-07-09", "fecha_fin": "2026-07-09", "tipo": "feriado"},
    {"nombre": "Paso a la Inmortalidad del Gral. José de San Martín", "fecha_inicio": "2026-08-17", "fecha_fin": "2026-08-17", "tipo": "feriado"},
    {"nombre": "Día del Respeto a la Diversidad Cultural", "fecha_inicio": "2026-10-12", "fecha_fin": "2026-10-12", "tipo": "feriado"},
    {"nombre": "Día de la Soberanía Nacional", "fecha_inicio": "2026-11-20", "fecha_fin": "2026-11-20", "tipo": "feriado"},
    {"nombre": "Inmaculada Concepción de María", "fecha_inicio": "2026-12-08", "fecha_fin": "2026-12-08", "tipo": "feriado"},
    {"nombre": "Navidad", "fecha_inicio": "2026-12-25", "fecha_fin": "2026-12-25", "tipo": "feriado"},
    {"nombre": "Vacaciones de Invierno", "fecha_inicio": "2026-07-13", "fecha_fin": "2026-07-24", "tipo": "vacaciones"},
    {"nombre": "Vacaciones de Verano", "fecha_inicio": "2026-12-20", "fecha_fin": "2027-02-28", "tipo": "vacaciones"},
]

async def cargar_feriados():
    print("Cargando feriados nacionales de Argentina 2026...")
    for feriado in feriados_argentina_2026:
        try:
            # upsert en vez de insert evita duplicados
            supabase.table("feriados").upsert(
                feriado,
                on_conflict="nombre,fecha_inicio"   # ajustá a la constraint de tu tabla
            ).execute()
            print(f"✅ {feriado['nombre']}")
        except Exception as e:
            print(f"❌ Error en {feriado['nombre']}: {e}")

if __name__ == "__main__":
    asyncio.run(cargar_feriados())