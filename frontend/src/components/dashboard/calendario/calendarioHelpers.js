// src/components/dashboard/calendario/calendarioHelpers.js

export const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
export const DIAS_CORTO = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
export const DIAS_SEMANA = [
  { num: 1, label: 'Lun' }, { num: 2, label: 'Mar' },
  { num: 3, label: 'Mié' }, { num: 4, label: 'Jue' },
  { num: 5, label: 'Vie' }, { num: 6, label: 'Sáb' },
  { num: 7, label: 'Dom' },
];
export const COLORES = ['#f472b6','#818cf8','#34d399','#fb923c','#60a5fa','#a78bfa','#f87171'];

export const MESES_LARGO = ['enero','febrero','marzo','abril','mayo','junio',
                     'julio','agosto','septiembre','octubre','noviembre','diciembre'];

export const FORM_EVENTO_VACIO = {
  titulo: '', materia: '', nombre_escuela: '',
  hora_inicio: '08:00', hora_fin: '09:00',
  dias_semana: [], fecha_inicio: '', fecha_fin: '',
  color: '#f472b6',
};
export const FORM_FERIADO_VACIO = {
  nombre: '', fecha_inicio: '', fecha_fin: '', tipo: 'feriado',
};

export const extraerError = (e) => {
  const detail = e.response?.data?.detail;
  if (!detail) return e.message || 'Error desconocido';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map(d => `${d.loc?.join('→') || ''}: ${d.msg}`).join('\n');
  }
  return JSON.stringify(detail);
};

export const formatFechaLarga = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  const f = new Date(y, m - 1, d);
  const diasNombre = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  return `${diasNombre[f.getDay()]} ${d} de ${MESES_LARGO[m - 1]} de ${y}`;
};

export const tipoCronogramaEtiqueta = (tipo, numero) => {
  const etiqueta = tipo === 'examen' ? 'Examen' : tipo === 'recuperatorio' ? 'Recup.' : 'Clase';
  return `${etiqueta} ${numero}`.trim();
};

export const tipoCronogramaColor = (tipo) => {
  if (tipo === 'examen') return '#f59e0b';
  if (tipo === 'recuperatorio') return '#22c55e';
  return '#818cf8';
};

// ── Estilos compartidos entre el calendario y sus modales ──────────────────
export const btnNavStyle = {
  background: 'transparent', border: 'none', fontSize: '1.8rem',
  cursor: 'pointer', color: '#374151', padding: '0 6px',
};
export const btnAccionStyle = color => ({
  background: color, color: 'white', border: 'none', borderRadius: 20,
  padding: '8px 16px', cursor: 'pointer', fontFamily: "'Inkfree', cursive",
  fontWeight: 'bold', fontSize: '0.9rem',
});
export const chipStyle = color => ({
  background: color, color: 'white', borderRadius: 6,
  padding: '1px 4px', fontSize: '0.68rem', marginBottom: 2,
  display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
});
export const inputStyle = {
  width: '100%', padding: '9px 14px', borderRadius: 10,
  border: '2px solid #cbd5e1', fontFamily: "'Inkfree', cursive",
  fontSize: '1rem', marginBottom: 12, boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.8)', outline: 'none',
};
export const labelStyle = {
  display: 'block', fontWeight: 'bold', marginBottom: 4,
  fontSize: '0.9rem', color: '#374151',
};
export const modalTitulo = {
  fontFamily: "'KG Midnight Memories', cursive",
  fontSize: '1.6rem', marginBottom: 16, color: '#1f2937',
};
export const detalleP = { margin: '4px 0', fontSize: '1rem' };
