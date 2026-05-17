// src/components/dashboard/CloudStorageBadge.jsx
import React from 'react';

const CloudStorageBadge = ({ usedMB }) => {
  const LIMIT_MB = 50;
  const percentage = Math.min((usedMB / LIMIT_MB) * 100, 100);

  // Color de la "tiza" líquida del termómetro
  const getChalkColor = () => {
    if (percentage < 60) return '#4ade80'; // Verde tiza
    if (percentage < 85) return '#facc15'; // Amarillo tiza
    return '#f87171'; // Rojo tiza
  };

  return (
    <div className="flex flex-col items-center p-4 bg-black/20 rounded-xl border-2 border-dashed border-white/30">
      <p className="text-white font-bold mb-2 text-xs uppercase tracking-tighter" style={{ fontFamily: 'Verdana' }}>
        Memoria del Aula
      </p>

      <div className="relative flex items-end h-40 w-12 bg-gray-800/50 rounded-full border-4 border-white shadow-inner overflow-hidden">
        {/* El "Líquido" del termómetro (Tiza) */}
        <div 
          className="w-full transition-all duration-1000 ease-out"
          style={{ 
            height: `${percentage}%`, 
            backgroundColor: getChalkColor(),
            boxShadow: `0 0 15px ${getChalkColor()}` 
          }}
        >
          {/* Efecto de burbuja/brillo arriba del líquido */}
          <div className="w-full h-2 bg-white/30 animate-pulse"></div>
        </div>
        
        {/* Marcas de escala (Renglones) */}
        <div className="absolute inset-0 flex flex-col justify-between py-4 pointer-events-none">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-full h-[1px] bg-white/20"></div>
          ))}
        </div>
      </div>

      <div className="mt-3 text-center">
        <span 
          className="text-white text-xl font-bold block" 
          style={{ fontFamily: 'Inkfree' }}
        >
          {usedMB.toFixed(1)} / {LIMIT_MB} MB
        </span>
        {percentage > 90 && (
          <span className="text-red-400 text-[10px] animate-bounce font-black uppercase">
            ¡Casi lleno!
          </span>
        )}
      </div>
    </div>
  );
};

export default CloudStorageBadge;