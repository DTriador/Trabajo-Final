// src/components/dashboard/PlanificacionWizard.steps.jsx
import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

// ─── Helpers exportados ───────────────────────────────────────────────────────
export const toISO = (d) => {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

export const DIAS_CHIP = [
  { dow: 1, label: 'Lun' }, { dow: 2, label: 'Mar' },
  { dow: 3, label: 'Mié' }, { dow: 4, label: 'Jue' },
  { dow: 5, label: 'Vie' },
];

// ─── Estilos compartidos exportados ──────────────────────────────────────────
export const S = {
  card: {
    background: 'rgba(255,255,255,0.6)',
    border: '1px solid rgba(0,0,0,0.1)',
    borderRadius: 14,
    padding: '18px 20px',
    marginBottom: 14,
  },
  label: {
    display: 'block', fontWeight: 'bold', fontSize: '0.9rem',
    marginBottom: 5, color: '#374151',
  },
  input: {
    width: '100%', padding: '9px 13px', borderRadius: 10,
    border: '2px solid #cbd5e1', fontFamily: "'Inkfree', cursive",
    fontSize: '1rem', marginBottom: 12, boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.8)',
  },
  textarea: {
    width: '100%', minHeight: 80, padding: '9px 13px', borderRadius: 10,
    border: '2px solid #cbd5e1', fontFamily: "'Inkfree', cursive",
    fontSize: '1rem', marginBottom: 12, boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.8)', resize: 'vertical',
  },
  btnPrimary: {
    background: 'white', border: '2px solid #cbd5e1', borderRadius: 20,
    padding: '8px 18px', cursor: 'pointer',
    fontFamily: "'Inkfree', cursive", fontSize: '0.95rem',
  },
  btnAccent: (color = '#f472b6') => ({
    background: color, color: 'white', border: 'none', borderRadius: 20,
    padding: '8px 20px', cursor: 'pointer',
    fontFamily: "'Inkfree', cursive", fontWeight: 'bold', fontSize: '0.95rem',
  }),
  badge: (color) => ({
    display: 'inline-block', background: color, color: 'white',
    borderRadius: 20, padding: '2px 10px', fontSize: '0.78rem',
    fontWeight: 'bold', marginRight: 4,
  }),
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  sectionTitle: {
    fontFamily: "'KG Midnight Memories', cursive",
    fontSize: '1.2rem', color: '#1e3a8a', marginBottom: 10,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PASO 1 — Materia + Unidades  (versión nueva completa)
// ─────────────────────────────────────────────────────────────────────────────
export function PasoMateria({ data, onChange, escuelas, cursos, onEscuelaChange }) {

  const agregarUnidad = () => {
    onChange('unidades', [
      ...data.unidades,
      { numero: data.unidades.length + 1, nombre: '', contenido: '', bibliografia_especifica: '' },
    ]);
  };

  const eliminarUnidad = (idx) => {
    onChange('unidades',
      data.unidades.filter((_, i) => i !== idx).map((u, i) => ({ ...u, numero: i + 1 }))
    );
  };

  const updateUnidad = (idx, field, value) => {
    onChange('unidades', data.unidades.map((u, i) => i === idx ? { ...u, [field]: value } : u));
  };

  return (
    <div>
      {/* Escuela + Materia */}
      <div style={S.card}>
        <p style={S.sectionTitle}>📚 Configuración de la materia</p>

        <div style={S.row2}>
          <div>
            <label style={S.label}>Escuela</label>
            <select style={S.input} value={data.id_escuela} onChange={onEscuelaChange}>
              <option value="">Seleccioná una escuela...</option>
              {escuelas.map(e => (
                <option key={e.id_escuela} value={e.id_escuela}>{e.nombre_escuela}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={S.label}>Materia / Curso</label>
            <select style={S.input} value={data.id_curso}
              onChange={e => onChange('id_curso', e.target.value)}
              disabled={!data.id_escuela}>
              <option value="">Seleccioná una materia...</option>
              {cursos.map(c => (
                <option key={c.id_curso} value={c.id_curso}>
                  {c.nombre_materia} — {c.division}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={S.row2}>
          <div>
            <label style={S.label}>Nombre de la planificación</label>
            <input style={S.input} placeholder="Ej: Sistemas de Control — 2026"
              value={data.nombre_clase}
              onChange={e => onChange('nombre_clase', e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Cantidad total de clases</label>
            <input type="number" style={S.input} min={1} max={300}
              placeholder="Ej: 40"
              value={data.cant_clases}
              onChange={e => onChange('cant_clases', e.target.value)} />
          </div>
        </div>

        <div style={S.row2}>
          <div>
            <label style={S.label}>Duración de cada clase</label>
            <input style={S.input} placeholder="Ej: 80 minutos"
              value={data.duracion}
              onChange={e => onChange('duracion', e.target.value)} />
          </div>
        </div>

        <div>
          <label style={S.label}>Contenido mínimo general de la asignatura</label>
          <textarea style={S.textarea}
            placeholder="Modelado de sistemas, Respuesta Temporal, Función de Transferencia..."
            value={data.contenido_minimo}
            onChange={e => onChange('contenido_minimo', e.target.value)} />
        </div>

        <div>
          <label style={S.label}>Bibliografía general</label>
          <textarea style={{ ...S.textarea, minHeight: 55 }}
            placeholder="Sistemas de Control Automático — Benjamín Kuo&#10;Ingeniería de Control Moderno — Katshuiko Ogata"
            value={data.bibliografia_general}
            onChange={e => onChange('bibliografia_general', e.target.value)} />
        </div>
      </div>

      {/* Unidades dinámicas */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <p style={{ ...S.sectionTitle, marginBottom: 0 }}>📂 Unidades ({data.unidades.length})</p>
          <button type="button" onClick={agregarUnidad}
            style={{ ...S.btnAccent('#818cf8'), padding: '6px 14px', fontSize: '0.88rem' }}>
            + Agregar unidad
          </button>
        </div>

        {data.unidades.length === 0 && (
          <p style={{ color: '#111827', fontStyle: 'italic', textAlign: 'center', padding: 16 }}>
            Agregá al menos una unidad con su contenido mínimo.
          </p>
        )}

        {data.unidades.map((u, idx) => (
          <div key={idx} style={{
            background: 'rgba(129,140,248,0.07)',
            border: '1.5px solid rgba(129,140,248,0.25)',
            borderRadius: 12, padding: 14, marginBottom: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontWeight: 'bold', color: '#4f46e5', fontSize: '0.95rem' }}>
                Unidad {u.numero}
              </span>
              <button type="button" onClick={() => eliminarUnidad(idx)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '1.1rem' }}>
                ✕
              </button>
            </div>

            <label style={S.label}>Nombre de la unidad</label>
            <input style={S.input}
              placeholder="Ej: Función de Transferencia"
              value={u.nombre}
              onChange={e => updateUnidad(idx, 'nombre', e.target.value)} />

            <label style={S.label}>Contenido mínimo de esta unidad</label>
            <textarea style={{ ...S.textarea, minHeight: 75 }}
              placeholder="Ej: Transformada de Laplace, Diagrama de bloques, Función de transferencia de lazo abierto y cerrado..."
              value={u.contenido}
              onChange={e => updateUnidad(idx, 'contenido', e.target.value)} />

            <label style={S.label}>Bibliografía específica de esta unidad</label>
            <textarea style={{ ...S.textarea, minHeight: 45, marginBottom: 0 }}
              placeholder="Ej: Sistemas de Control Automático — Benjamín Kuo (Cap. 3)"
              value={u.bibliografia_especifica}
              onChange={e => updateUnidad(idx, 'bibliografia_especifica', e.target.value)} />
          </div>
        ))}
      </div>

      {/* Archivos */}
      <div style={S.card}>
        <p style={S.sectionTitle}>📎 Archivos adjuntos (opcional)</p>
        <div onClick={() => document.getElementById('wiz-file-input').click()}
          style={{
            border: '2px dashed #cbd5e1', borderRadius: 10, padding: 20,
            textAlign: 'center', color: '#111827', cursor: 'pointer',
          }}>
          📂 Hacé click para adjuntar PDFs u otros archivos
        </div>
        <input type="file" id="wiz-file-input" multiple style={{ display: 'none' }}
          onChange={e => onChange('archivos', Array.from(e.target.files))} />
        {data.archivos?.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {data.archivos.map((f, i) => (
              <span key={i} style={{ background: '#e0f2fe', color: '#0c4a6e', borderRadius: 20, padding: '3px 10px', fontSize: '0.82rem' }}>
                📄 {f.name}
                <button onClick={() => onChange('archivos', data.archivos.filter((_, j) => j !== i))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 4 }}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PASO 2 — Calendario: rango + chips días + calendario visual + feriados backend
// Combina: auto-cálculo de fechas (nueva) + grilla visual + feriados del backend (vieja)
// ─────────────────────────────────────────────────────────────────────────────
export function PasoCalendario({
  totalClases,
  fechasCalculadas,
  setFechasCalculadas,
  horariosDias,
  setHorariosDias,
}) {
  const { user } = useAuth();

  const [calYear,  setCalYear]  = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [rangoInicio, setRangoInicio] = useState('');
  const [rangoFin,    setRangoFin]    = useState('');
  const [diasSemana,  setDiasSemana]  = useState(new Set());
  const [feriados,    setFeriados]    = useState({});  // { "YYYY-MM-DD": "nombre" }
  const [feriadosExtra, setFeriadosExtra] = useState([]);
  const [feriadoFecha,  setFeriadoFecha]  = useState('');
  const [feriadoNombre, setFeriadoNombre] = useState('');

  // Cargar feriados: nacionales (API) + propios del docente (backend)
  useEffect(() => {
    const fetchFeriados = async () => {
      const mapa = {};
      // 1. Feriados nacionales
      try {
        const r = await fetch(`https://nolaborables.com.ar/api/v2/feriados/${calYear}`);
        if (r.ok) {
          const data = await r.json();
          data.forEach(f => {
            const key = `${calYear}-${String(f.mes).padStart(2,'0')}-${String(f.dia).padStart(2,'0')}`;
            mapa[key] = f.motivo || 'Feriado nacional';
          });
        }
      } catch (_) {}
      // 2. Feriados guardados por el docente en el backend
      try {
        const userId = user?.id || user?.id_docente || user?.user?.id;
        if (userId) {
          const res = await api.get(`/calendario/feriados/${userId}`);
          const feriadosDB = res.data?.feriados || [];
          feriadosDB.forEach(f => {
            let cur = new Date(f.fecha_inicio + 'T12:00:00');
            const fin = new Date(f.fecha_fin + 'T12:00:00');
            while (cur <= fin) {
              mapa[toISO(cur)] = f.nombre || 'Sin clase';
              cur.setDate(cur.getDate() + 1);
            }
          });
        }
      } catch (_) {}
      setFeriados(prev => ({ ...mapa, ...prev })); // los manuales no se pisan
    };
    fetchFeriados();
  }, [calYear, user]); // eslint-disable-line

  useEffect(() => {
    setHorariosDias(prev => {
      const next = { ...prev };
      diasSemana.forEach(dow => {
        if (!next[dow]) next[dow] = { hora_inicio: '08:00', hora_fin: '09:00' };
      });
      Object.keys(next).forEach(key => {
        if (!diasSemana.has(Number(key))) delete next[key];
      });
      return next;
    });
  }, [diasSemana, setHorariosDias]);

  // Recalcular fechasCalculadas cada vez que cambia rango, días o feriados
  useEffect(() => {
    if (!rangoInicio || !rangoFin || diasSemana.size === 0) {
      setFechasCalculadas([]);
      return;
    }
    const fechas = [];
    let cur = new Date(rangoInicio + 'T12:00:00');
    const end = new Date(rangoFin + 'T12:00:00');
    while (cur <= end) {
      const dow = cur.getDay();
      const key = toISO(cur);
      if (diasSemana.has(dow) && !feriados[key]) fechas.push(key);
      cur.setDate(cur.getDate() + 1);
    }
    setFechasCalculadas(fechas);
  }, [rangoInicio, rangoFin, diasSemana, feriados]); // eslint-disable-line

  const toggleDia = (dow) => {
    setDiasSemana(prev => { const n = new Set(prev); n.has(dow) ? n.delete(dow) : n.add(dow); return n; });
  };

  const updateHorarioDia = (dow, field, value) => {
    setHorariosDias(prev => ({
      ...prev,
      [dow]: {
        ...(prev[dow] || { hora_inicio: '08:00', hora_fin: '09:00' }),
        [field]: value,
      },
    }));
  };

  const agregarFeriado = () => {
    if (!feriadoFecha) return;
    const nombre = feriadoNombre || 'Sin clase';
    setFeriados(prev => ({ ...prev, [feriadoFecha]: nombre }));
    // Quitar esa fecha de las calculadas si estaba
    setFechasCalculadas(prev => prev.filter(f => f !== feriadoFecha));
    setFeriadosExtra(prev => [...prev, { fecha: feriadoFecha, nombre }]);
    setFeriadoFecha(''); setFeriadoNombre('');
  };

  const quitarFeriado = (fecha) => {
    setFeriados(prev => { const n = { ...prev }; delete n[fecha]; return n; });
    setFeriadosExtra(prev => prev.filter(f => f.fecha !== fecha));
  };

  const prevMes = () => { let m = calMonth - 1, y = calYear; if (m < 0) { m = 11; y--; } setCalMonth(m); setCalYear(y); };
  const nextMes = () => { let m = calMonth + 1, y = calYear; if (m > 11) { m = 0; y++; } setCalMonth(m); setCalYear(y); };

  const construirGrilla = () => {
    const first  = new Date(calYear, calMonth, 1);
    const offset = first.getDay();
    const inicio = new Date(calYear, calMonth, 1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(inicio); d.setDate(inicio.getDate() + i); return d;
    });
  };

  const startRange = rangoInicio ? new Date(rangoInicio + 'T00:00:00') : null;
  const endRange   = rangoFin   ? new Date(rangoFin   + 'T23:59:59') : null;

  const disponibles = fechasCalculadas.length;
  const ok  = disponibles >= totalClases && totalClases > 0;
  const falta = totalClases - disponibles;

  return (
    <div>
      {/* Rango + días */}
      <div style={S.card}>
        <p style={S.sectionTitle}>📅 Rango lectivo</p>
        <div style={S.row2}>
          <div>
            <label style={S.label}>Fecha de inicio</label>
            <input type="date" style={S.input} value={rangoInicio} onChange={e => setRangoInicio(e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Fecha de fin</label>
            <input type="date" style={S.input} value={rangoFin} onChange={e => setRangoFin(e.target.value)} />
          </div>
        </div>

        <label style={S.label}>Días de clase en la semana</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {DIAS_CHIP.map(({ dow, label }) => (
            <button key={dow} type="button" onClick={() => toggleDia(dow)}
              style={{
                padding: '6px 14px', borderRadius: 20, border: '2px solid', cursor: 'pointer',
                fontFamily: "'Inkfree', cursive", fontWeight: 'bold',
                borderColor: diasSemana.has(dow) ? '#f472b6' : '#cbd5e1',
                background:  diasSemana.has(dow) ? '#f472b6' : 'white',
                color:       diasSemana.has(dow) ? 'white'   : '#374151',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Resultado del cálculo automático */}
        <div style={{
          padding: '12px 16px', borderRadius: 10,
          background: ok ? 'rgba(220,252,231,0.6)' : disponibles > 0 ? 'rgba(254,243,199,0.8)' : 'rgba(241,245,249,0.6)',
          border: `1.5px solid ${ok ? '#86efac' : disponibles > 0 ? '#fcd34d' : '#e2e8f0'}`,
        }}>
          {disponibles === 0 ? (
            <p style={{ margin: 0, color: '#111827', fontSize: '0.88rem' }}>
              Seleccioná un rango y los días de clase. Necesitás <b>{totalClases}</b> fechas.
            </p>
          ) : ok ? (
            <>
              <p style={{ margin: '0 0 3px', fontWeight: 'bold', color: '#166534', fontSize: '0.9rem' }}>
                ✅ {disponibles} fechas disponibles — suficientes para {totalClases} clases
              </p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#166534' }}>
                Primera: {fechasCalculadas[0]} — Última clase #{totalClases}: {fechasCalculadas[totalClases - 1]}
              </p>
            </>
          ) : (
            <p style={{ margin: 0, fontWeight: 'bold', color: '#92400e', fontSize: '0.9rem' }}>
              ⚠️ Solo {disponibles} fechas disponibles. Necesitás {falta} más. Ampliá el rango o agregá más días.
            </p>
          )}
        </div>
      </div>

      {/* Calendario visual — para visualizar y poder excluir días individuales */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <button type="button" onClick={prevMes} style={S.btnPrimary}>‹</button>
          <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>{MESES[calMonth]} {calYear}</span>
          <button type="button" onClick={nextMes} style={S.btnPrimary}>›</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, textAlign: 'center', fontSize: '0.8rem', color: '#111827', marginBottom: 4 }}>
          {['D','L','M','X','J','V','S'].map(d => <div key={d} style={{ fontWeight: 'bold' }}>{d}</div>)}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {construirGrilla().map((d, i) => {
            const iso        = toISO(d);
            const esMes      = d.getMonth() === calMonth;
            const inRange    = startRange && endRange ? (d >= startRange && d <= endRange) : false;
            const esFeriado  = !!feriados[iso];
            const esFinde    = d.getDay() === 0 || d.getDay() === 6;
            const esClase    = fechasCalculadas.includes(iso);
            const bloqueado  = esFeriado || esFinde;

            let bg = 'transparent', color = esMes ? '#374151' : '#bbb', border = '1px solid transparent';
            if (!inRange && esMes)  { color = '#aaa'; }
            if (esFinde)             { bg = '#f1f5f9'; color = '#94a3b8'; }
            if (esFeriado)           { bg = '#fee2e2'; color = '#dc2626'; }
            if (esClase)             { bg = '#dbeafe'; color = '#1d4ed8'; border = '1px solid #93c5fd'; }

            return (
              <button key={i} type="button"
                disabled={bloqueado || !inRange}
                title={esFeriado ? feriados[iso] : esFinde ? 'Fin de semana' : ''}
                onClick={() => {
                  // Click manual: excluir o incluir una fecha puntual
                  if (bloqueado || !inRange) return;
                  setFechasCalculadas(prev =>
                    prev.includes(iso) ? prev.filter(f => f !== iso) : [...prev, iso].sort()
                  );
                }}
                style={{
                  width: '100%', aspectRatio: '1', borderRadius: '50%',
                  border, background: bg, color, fontSize: '0.8rem',
                  cursor: (bloqueado || !inRange) ? 'default' : 'pointer',
                  opacity: !inRange ? 0.3 : 1,
                  textDecoration: esFeriado ? 'line-through' : 'none',
                  fontWeight: esClase ? 'bold' : 'normal',
                }}>
                {d.getDate()}
              </button>
            );
          })}
        </div>

        {/* Leyenda */}
        <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: '0.78rem', flexWrap: 'wrap' }}>
          <span><span style={{ display:'inline-block', width:10, height:10, borderRadius:'50%', background:'#dbeafe', marginRight:4 }}/>Clase ({fechasCalculadas.length})</span>
          <span><span style={{ display:'inline-block', width:10, height:10, borderRadius:'50%', background:'#fee2e2', marginRight:4 }}/>Feriado</span>
          <span><span style={{ display:'inline-block', width:10, height:10, borderRadius:'50%', background:'#f1f5f9', marginRight:4 }}/>Fin de semana</span>
          <span style={{ color:'#64748b' }}>Click en un día para incluirlo/excluirlo manualmente</span>
        </div>
      </div>

      <div style={S.card}>
        <p style={S.sectionTitle}>🕒 Horarios por día de dictado</p>
        {DIAS_CHIP.filter(day => diasSemana.has(day.dow)).length === 0 ? (
          <p style={{ color: '#111827', fontStyle: 'italic', textAlign: 'center', padding: 12 }}>
            Elegí primero los días de clase y luego definí el horario que quieres para cada día.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {DIAS_CHIP.filter(day => diasSemana.has(day.dow)).map(({ dow, label }) => {
              const slot = horariosDias[dow] || { hora_inicio: '08:00', hora_fin: '09:00' };
              return (
                <div key={dow} style={{
                  display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 0.8fr', gap: 10,
                  alignItems: 'center', padding: '10px 12px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.08)',
                }}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#1f2937' }}>{label}</div>
                    <div style={{ fontSize: '0.85rem', color: '#111827' }}>Todas las clases de {label} usarán este horario</div>
                  </div>
                  <div>
                    <label style={S.label}>Inicio</label>
                    <input type="time" style={{ ...S.input, marginBottom: 0 }} value={slot.hora_inicio}
                      onChange={e => updateHorarioDia(dow, 'hora_inicio', e.target.value)} />
                  </div>
                  <div>
                    <label style={S.label}>Fin</label>
                    <input type="time" style={{ ...S.input, marginBottom: 0 }} value={slot.hora_fin}
                      onChange={e => updateHorarioDia(dow, 'hora_fin', e.target.value)} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Feriados extra manuales */}
      <div style={S.card}>
        <p style={S.sectionTitle}>🚫 Días sin clase extra</p>
        <p style={{ fontSize: '0.82rem', color: '#374151', marginBottom: 10, fontWeight: 'bold' }}>
          Los feriados nacionales y los tuyos guardados en el calendario se excluyen automáticamente.
        </p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <input type="date" style={{ ...S.input, flex: 1, marginBottom: 0 }}
            value={feriadoFecha} onChange={e => setFeriadoFecha(e.target.value)} />
          <input style={{ ...S.input, flex: 2, marginBottom: 0 }}
            placeholder="Nombre (opcional)"
            value={feriadoNombre} onChange={e => setFeriadoNombre(e.target.value)} />
          <button type="button" style={S.btnAccent('#fb923c')} onClick={agregarFeriado}>+ Agregar</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {feriadosExtra.map(f => (
            <span key={f.fecha} style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 20, padding: '3px 10px', fontSize: '0.82rem' }}>
              {f.fecha} — {f.nombre}
              <button onClick={() => quitarFeriado(f.fecha)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 4 }}>×</button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PASO 3 — Exámenes y recuperatorios (igual en ambas versiones)
// ─────────────────────────────────────────────────────────────────────────────
export function PasoExamenes({ examenes, setExamenes }) {
  const setCant = (n) => {
    const cant = Math.max(0, Math.min(20, parseInt(n) || 0));
    setExamenes(prev => {
      const next = [...prev];
      while (next.length < cant)
        next.push({
          numeroClaseExamen: '',   // ← número de clase donde cae el examen
          clasesExamen:      '',   // ← descripción (para el tema)
          tieneRecup:        false,
          clasesRecupDesde:  '',
          clasesRecupHasta:  '',
        });
      return next.slice(0, cant);
    });
  };

  const update = (i, f, v) =>
    setExamenes(prev => prev.map((ex, idx) => idx === i ? { ...ex, [f]: v } : ex));

  return (
    <div style={S.card}>
      <p style={S.sectionTitle}>📝 Exámenes y recuperatorios</p>

      <div style={{ ...S.row2, alignItems: 'flex-end', marginBottom: 20 }}>
        <div>
          <label style={S.label}>Cantidad de exámenes</label>
          <input type="number" style={S.input} min={0} max={20}
            value={examenes.length} onChange={e => setCant(e.target.value)} />
        </div>
      </div>

      {examenes.map((ex, i) => (
        <div key={i} style={{
          background: 'rgba(255,235,59,0.15)', border: '1.5px solid rgba(0,0,0,0.1)',
          borderRadius: 12, padding: 14, marginBottom: 12,
        }}>
          <span style={S.badge('#f59e0b')}>Examen {i + 1}</span>

          {/* Número de clase en que se toma — determina la posición en el cronograma */}
          <label style={{ ...S.label, marginTop: 10 }}>
            Clase en que se toma el examen
          </label>
          <input
            type="number" style={S.input} min={1}
            placeholder="Ej: 8 (en la clase N° 8 del cronograma)"
            value={ex.numeroClaseExamen}
            onChange={e => update(i, 'numeroClaseExamen', e.target.value)}
          />

          {/* Descripción de qué clases cubre — solo va al tema */}
          <label style={S.label}>¿Qué clases cubre? (para el título del examen)</label>
          <input
            style={S.input}
            placeholder="Ej: Clases 1 a 7  —  Unidades 1 y 2"
            value={ex.clasesExamen}
            onChange={e => update(i, 'clasesExamen', e.target.value)}
          />

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.95rem', marginBottom: 8 }}>
            <input type="checkbox" checked={ex.tieneRecup}
              onChange={e => update(i, 'tieneRecup', e.target.checked)} style={{ width: 'auto' }} />
            Este examen tiene recuperatorio
          </label>

          {ex.tieneRecup && (
            <div style={{ background: 'rgba(220,252,231,0.6)', border: '1px solid #86efac', borderRadius: 10, padding: 12 }}>
              <span style={S.badge('#22c55e')}>Recuperatorio {i + 1}</span>
              <label style={{ ...S.label, marginTop: 8 }}>
                Clase en que se toma el recuperatorio
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
                <input type="number" style={{ ...S.input, marginBottom: 0 }} placeholder="Desde clase N°" min={1}
                  value={ex.clasesRecupDesde} onChange={e => update(i, 'clasesRecupDesde', e.target.value)} />
                <span style={{ fontSize: '0.9rem', color: '#111827' }}>hasta</span>
                <input type="number" style={{ ...S.input, marginBottom: 0 }} placeholder="Hasta clase N°" min={1}
                  value={ex.clasesRecupHasta} onChange={e => update(i, 'clasesRecupHasta', e.target.value)} />
              </div>
            </div>
          )}
        </div>
      ))}

      {examenes.length === 0 && (
        <p style={{ color: '#111827', fontStyle: 'italic', textAlign: 'center', padding: 20 }}>
          Sin exámenes configurados.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PASO 4 — Preview: spinner de IA + lista editable con badge de unidad
// ─────────────────────────────────────────────────────────────────────────────
const COLOR_TIPO   = { clase: '#3b82f6', examen: '#f59e0b', recuperatorio: '#22c55e' };
const COLOR_UNIDAD = ['#818cf8','#f472b6','#34d399','#fb923c','#60a5fa','#a78bfa','#f87171','#fbbf24'];

export function PasoPreview({ clases, setClases, onGuardar, guardando, generando }) {

  if (generando) return (
    <div style={{ textAlign: 'center', padding: 48 }}>
      <div style={{ fontSize: '2.8rem', marginBottom: 14 }}>🤖</div>
      <p style={{ fontWeight: 'bold', color: '#1e3a8a', fontSize: '1.1rem', marginBottom: 8 }}>
        La IA está distribuyendo los temas entre las clases...
      </p>
      <p style={{ color: '#111827', fontSize: '0.88rem' }}>
        Groq está analizando el contenido mínimo de cada unidad y asignando los temas a cada fecha.
        Puede tardar unos segundos.
      </p>
    </div>
  );

  if (clases.length === 0) return (
    <div style={{ textAlign: 'center', padding: 40, color: '#111827' }}>
      No se generaron clases. Revisá los pasos anteriores.
    </div>
  );

  const updateTema  = (i, v) => setClases(prev => prev.map((c, idx) => idx === i ? { ...c, tema:  v } : c));
  const updateFecha = (i, v) => setClases(prev => prev.map((c, idx) => idx === i ? { ...c, fecha: v } : c));

  return (
    <div>
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <p style={{ ...S.sectionTitle, marginBottom: 0 }}>
            📋 Planificación generada — {clases.length} entradas
          </p>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {Object.entries(COLOR_TIPO).map(([t, c]) => (
              <span key={t} style={S.badge(c)}>{t}</span>
            ))}
          </div>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#111827', marginBottom: 10 }}>
          Editá el tema de cualquier clase haciendo click. Las fechas también son editables.
        </p>

        <div style={{ maxHeight: 370, overflowY: 'auto' }}>
          {clases.map((c, i) => {
            const ct = COLOR_TIPO[c.tipo] || '#3b82f6';
            const cu = c.unidad ? COLOR_UNIDAD[(c.unidad - 1) % COLOR_UNIDAD.length] : null;
            const [y, m, d] = c.fecha.split('-');
            const fechaStr  = `${d}/${m}/${y}`;
            return (
              <div key={i} style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                padding: '9px 0', borderBottom: '1px dashed rgba(0,0,0,0.1)',
              }}>
                {/* Círculo numerado */}
                <div style={{
                  minWidth: 30, height: 30, borderRadius: '50%', background: ct,
                  color: 'white', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', flexShrink: 0,
                }}>
                  {c.numero}
                </div>

                <div style={{ flex: 1 }}>
                  {/* Fecha + badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                    <input type="date" value={c.fecha} onChange={e => updateFecha(i, e.target.value)}
                      style={{
                        border: 'none', borderBottom: '1px dashed #94a3b8',
                        background: 'transparent', fontSize: '0.78rem',
                        color: '#111827', fontFamily: "'Inkfree', cursive",
                      }} />
                    <span style={S.badge(ct)}>
                      {c.tipo === 'clase' ? `Clase ${c.numero}` : c.tipo === 'examen' ? `Examen ${c.numExamen || ''}` : `Recup. ${c.numExamen || ''}`}
                    </span>
                    {cu && (
                      <span style={{ ...S.badge(cu), opacity: 0.85 }}>U{c.unidad}</span>
                    )}
                  </div>

                  {/* Tema editable */}
                  <input value={c.tema} onChange={e => updateTema(i, e.target.value)}
                    style={{
                      width: '100%', border: 'none', borderBottom: '1px solid #e2e8f0',
                      background: 'transparent', fontSize: '0.92rem',
                      color: '#1f2937', fontFamily: "'Inkfree', cursive", padding: '2px 0',
                    }} />

                  {(c.hora_inicio || c.hora_fin) && (
                    <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#111827' }}>
                      🕒 {c.hora_inicio || '--:--'} a {c.hora_fin || '--:--'}
                    </p>
                  )}

                  {/* Línea de referencia tipo "Clase N° 25 (16/06): Tema" */}
                  <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#111827' }}>
                    → {c.tipo === 'clase' ? `Clase N° ${c.numero}` : c.tipo === 'examen' ? 'Examen' : 'Recuperatorio'} ({fechaStr}): {c.tema}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onGuardar} disabled={guardando}
          style={{ ...S.btnAccent('#f472b6'), opacity: guardando ? 0.6 : 1, fontSize: '1rem', padding: '10px 24px' }}>
          {guardando ? 'Guardando...' : '💾 Guardar planificación'}
        </button>
      </div>
    </div>
  );
}