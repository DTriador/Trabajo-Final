# backend/app/api/router_bi.py
from fastapi import APIRouter, HTTPException
from app.core.database import supabase
from collections import Counter

router = APIRouter()

@router.get("/dashboard/{id_docente}")
async def get_full_stats(id_docente: str):
    try:
        res = supabase.table("archivos_generados").select("*").eq("id_docente", id_docente).execute()
        data = res.data or []

        # 1. Tipos de Archivo (filtra None y vacíos)
        formatos = Counter([
            (item.get('tipo_formato') or 'desconocido')
            for item in data
        ])
        pie_formatos = [{"name": k, "value": v} for k, v in formatos.items()]

        # 2. Sub-tipos pedagógicos (de DOCX y PDF)
        evals = [item for item in data if item.get('tipo_formato') in ('docx', 'pdf')]
        subtipos = Counter([
            (item.get('sub_tipo') or item.get('categoria_ia') or 'Otro')
            for item in evals
        ])
        pie_pedagogico = [{"name": k, "value": v} for k, v in subtipos.items()]

        # 3. Ranking de Temas (filtra None)
        temas_validos = [
            item.get('tema_especifico')
            for item in data
            if item.get('tema_especifico')
        ]
        temas_top = Counter(temas_validos).most_common(5)
        ranking_temas = [{"tema": t[0], "cantidad": t[1]} for t in temas_top]

        # 4. Tiempo ahorrado (45 min por archivo)
        total_archivos = len(data)
        horas_ahorradas = round((total_archivos * 45) / 60, 1)

        return {
            "pie_formatos": pie_formatos,
            "pie_pedagogico": pie_pedagogico,
            "ranking_temas": ranking_temas,
            "horas_ahorradas": horas_ahorradas,
            "total_generados": total_archivos
        }
    except Exception as e:
        print(f"❌ Error en /stats/dashboard/{id_docente}: {e}")
        raise HTTPException(status_code=500, detail=f"Error obteniendo estadísticas: {str(e)}")