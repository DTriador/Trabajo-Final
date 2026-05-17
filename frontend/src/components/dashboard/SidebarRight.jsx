// src/components/dashboard/SidebarRight.jsx
import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import CloudStorageBadge from './CloudStorageBadge';

const SidebarRight = () => {
  const [stats, setStats] = useState({ archivos: [], uso_mb: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/stats/recientes/me');
        setStats(res.data);
      } catch (err) { console.log(err); }
    };
    fetchStats();
  }, []);

  return (
    <div className="h-full flex flex-col p-4">
      {/* Carpeta/Clip de documentos */}
      <div className="flex-1 bg-[#fdf6e3] rounded-sm shadow-lg p-4 border-t-8 border-blue-400 relative overflow-hidden">
        {/* Clip metálico decorativo */}
        <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 w-12 h-6 bg-gray-400 rounded-b-lg shadow-md"></div>
        
        <h3 className="text-white-700 font-bold mb-4 mt-2 border-b-2 border-dashed border-gray-300 pb-2 italic" style={{ fontFamily: 'Inkfree', fontSize: '1.4rem' }}>
          Documentos Generados
        </h3>

        <div className="space-y-4 overflow-y-auto max-h-[50vh] pr-2 custom-scrollbar">
          {stats.archivos.length === 0 ? (
            <p className="text-white-400 text-sm italic">No hay archivos todavía...</p>
          ) : (
            stats.archivos.map((doc) => (
              <div key={doc.id} className="flex flex-col border-b border-gray-200 pb-2 group">
                <span className="text-sm font-medium text-white-800 truncate">{doc.nombre}</span>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[10px] text-white-400 uppercase tracking-widest">{doc.fecha}</span>
                  <a 
                    href={doc.url_firmada} 
                    download 
                    className="text-blue-500 text-xs font-bold hover:underline"
                  >
                    Descargar ↓
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* El Termómetro de Tiza abajo de todo */}
      <div className="mt-6">
        <CloudStorageBadge usedMB={stats.uso_mb} />
      </div>
    </div>
  );
};

export default SidebarRight;