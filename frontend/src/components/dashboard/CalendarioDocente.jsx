import React, { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';

import api from '../../api/axios';


const CalendarioDocente = ({ idPlanificacion }) => {
  const [eventos, setEventos] = useState([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    const cargarDatos = async () => {
      if (!idPlanificacion) return;
      
      setCargando(true);
      try {
        // Realizamos la petición al backend de FastAPI
        const res = await api.get(`/planificacion/cronograma/${idPlanificacion}`);
        
        // Mapeamos los datos de la base de datos al formato que entiende FullCalendar
        const mapeados = res.data.map(clase => ({
          id: clase.id,
          title: `${clase.tipo === 'examen' ? 'Examen' : clase.tipo === 'recuperatorio' ? 'Recup.' : 'Clase'} ${clase.numero}${clase.tema_clase ? ` · ${clase.tema_clase}` : ''}`,
          start: clase.fecha_programada,
          extendedProps: { 
            estado: clase.estado_clase 
          },
          // Colores dinámicos según el estado (RF05)
          backgroundColor: clase.estado_clase === 'reprogramada'
            ? '#f87171'
            : clase.tipo === 'examen'
              ? '#f59e0b'
              : clase.tipo === 'recuperatorio'
                ? '#22c55e'
                : '#3b82f6',
          borderColor: clase.estado_clase === 'reprogramada'
            ? '#ef4444'
            : clase.tipo === 'examen'
              ? '#d97706'
              : clase.tipo === 'recuperatorio'
                ? '#16a34a'
                : '#2563eb',
        }));
        
        setEventos(mapeados);
      } catch (err) {
        console.error("Error al cargar el cronograma desde el backend:", err);
      } finally {
        setCargando(false);
      }
    };

    cargarDatos();
  }, [idPlanificacion]);

  return (
    <div className="p-6 bg-white rounded-xl shadow-md border border-gray-100">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white-800">Cronograma de Clases</h2>
        {cargando && <span className="text-sm text-blue-500 animate-pulse">Sincronizando...</span>}
      </div>

      <div className="calendar-container">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale="es"
          events={eventos}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,dayGridWeek'
          }}
          buttonText={{
            today: 'Hoy',
            month: 'Mes',
            week: 'Semana'
          }}
          // Aplicamos estilos visuales a los eventos al renderizarse
          eventDidMount={(info) => {
            info.el.style.borderRadius = '4px';
            info.el.style.padding = '2px';
            info.el.style.fontSize = '0.8rem';
          }}
        />
      </div>

      {/* Leyenda para el docente */}
      <div className="mt-4 flex gap-4 text-xs font-medium text-white-600">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
          <span>Programada</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-amber-500 rounded-full mr-2"></div>
          <span>Examen</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
          <span>Recuperatorio</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-red-400 rounded-full mr-2"></div>
          <span>Reprogramada (Alerta)</span>
        </div>
      </div>
    </div>
  );
};

export default CalendarioDocente;