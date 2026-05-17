from app.core.database import supabase

class BIService:
    @staticmethod
    def get_user_stats(id_docente: str):
        """
        Obtiene estadísticas de uso para el dashboard del docente.
        """
        # 1. Conteo por tipo de archivo (PPTX vs DOCX vs XLSX)
        # Usamos la capacidad de filtrado de Supabase
        res = supabase.table("archivos_generados") \
            .select("tipo_formato") \
            .eq("id_docente", id_docente) \
            .execute()
        
        stats = {
            "pptx": 0,
            "docx": 0,
            "xlsx": 0,
            "total": len(res.data)
        }
        
        for row in res.data:
            fmt = row['tipo_formato'].lower()
            if fmt in stats:
                stats[fmt] += 1
                
        return stats

    @staticmethod
    def get_recent_activity(id_docente: str, limit: int = 5):
        """
        Trae los últimos archivos generados para la lista del escritorio.
        """
        res = supabase.table("archivos_generados") \
            .select("nombre_archivo, tema_especifico, fecha_creacion") \
            .eq("id_docente", id_docente) \
            .order("fecha_creacion", desc=True) \
            .limit(limit) \
            .execute()
        return res.data