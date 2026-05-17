// src/views/CalendarioView.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import CalendarioDocente from '../components/dashboard/CalendarioDocente';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_CORTO = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const DIAS_SEMANA = [
  { num: 1, label: 'Lun' }, { num: 2, label: 'Mar' },
  { num: 3, label: 'Mié' }, { num: 4, label: 'Jue' },
  { num: 5, label: 'Vie' }, { num: 6, label: 'Sáb' },
  { num: 7, label: 'Dom' },
];
const COLORES = ['#f472b6','#818cf8','#34d399','#fb923c','#60a5fa','#a78bfa','#f87171'];

const MESES_LARGO = ['enero','febrero','marzo','abril','mayo','junio',
                     'julio','agosto','septiembre','octubre','noviembre','diciembre'];

const FORM_EVENTO_VACIO = {
  titulo: '', materia: '', nombre_escuela: '',
  hora_inicio: '08:00', hora_fin: '09:00',
  dias_semana: [], fecha_inicio: '', fecha_fin: '',
  color: '#f472b6',
};
const FORM_FERIADO_VACIO = {
  nombre: '', fecha_inicio: '', fecha_fin: '', tipo: 'feriado',
};

const extraerError = (e) => {
  const detail = e.response?.data?.detail;
  if (!detail) return e.message || 'Error desconocido';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map(d => `${d.loc?.join('→') || ''}: ${d.msg}`).join('\n');
  }
  return JSON.stringify(detail);
};

const formatFechaLarga = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  const f = new Date(y, m - 1, d);
  const diasNombre = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  return `${diasNombre[f.getDay()]} ${d} de ${MESES_LARGO[m - 1]} de ${y}`;
};

export default function CalendarioView({ onVolver }) {
  const { user } = useAuth();
  const userId = user?.id || user?.id_docente || user?.user?.id;

  const [mes, setMes]             = useState(new Date());
  const [datos, setDatos]         = useState({ eventos: [], planificaciones: [], feriados: [] });
  const [cargando, setCargando]   = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [modalEvento,    setModalEvento]    = useState(false);
  const [modalFeriado,   setModalFeriado]   = useState(false);
  const [modalDetalle,   setModalDetalle]   = useState(null);   // detalle evento recurrente
  const [modalExcepcion, setModalExcepcion] = useState(null);
  const [modalDia,       setModalDia]       = useState(null);   // ← NUEVO: detalle del día

  const [planSeleccionada, setPlanSeleccionada] = useState(null);

  const [formEvento,  setFormEvento]  = useState(FORM_EVENTO_VACIO);
  const [formFeriado, setFormFeriado] = useState(FORM_FERIADO_VACIO);
  const [formExc,     setFormExc]     = useState({ fecha_nueva: '', hora_inicio: '', hora_fin: '', motivo: '' });
  const [editando,    setEditando]    = useState(null);

  const cargarMes = useCallback(async () => {
    if (!userId) return;
    setCargando(true);
    try {
      const anio = mes.getFullYear();
      const m    = mes.getMonth() + 1;
      const res  = await api.get(`/calendario/mes/${userId}/${anio}/${m}`);
      setDatos(res.data);
    } catch (e) {
      console.error('Error cargando mes:', e);
    } finally {
      setCargando(false);
    }
  }, [userId, mes]);

  useEffect(() => { cargarMes(); }, [cargarMes]);

  const construirGrilla = () => {
    const year  = mes.getFullYear();
    const month = mes.getMonth();
    const primer = new Date(year, month, 1);
    const offset = (primer.getDay() + 6) % 7;
    const inicio = new Date(year, month, 1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      return d;
    });
  };

  const toISO = d => {
    const y   = d.getFullYear();
    const m   = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const eventosDelDia = iso => ({
    evs:   datos.eventos.filter(e => e.fecha === iso),
    plans: datos.planificaciones.filter(p => p.fecha === iso),
    fers:  datos.feriados.filter(f => f.fecha_inicio <= iso && f.fecha_fin >= iso),
  });

  // ── Abrir modal de día ────────────────────────────────────────────────────
  const abrirModalDia = (iso, contenido) => {
    setModalDia({ iso, ...contenido });
  };

  const validarEvento = () => {
    const errores = [];
    if (!formEvento.titulo.trim())           errores.push('• Título');
    if (formEvento.dias_semana.length === 0)  errores.push('• Al menos un día de la semana');
    if (!formEvento.hora_inicio)              errores.push('• Hora de inicio');
    if (!formEvento.hora_fin)                 errores.push('• Hora de fin');
    if (!formEvento.fecha_inicio)             errores.push('• Fecha de inicio');
    if (formEvento.hora_inicio >= formEvento.hora_fin) errores.push('• La hora de fin debe ser posterior a la de inicio');
    return errores;
  };

  const handleGuardarEvento = async () => {
    const errores = validarEvento();
    if (errores.length > 0) {
      alert(`Completá los siguientes campos:\n${errores.join('\n')}`);
      return;
    }
    setGuardando(true);
    const payload = { ...formEvento, id_docente: userId };
    try {
      if (editando) {
        await api.put(`/calendario/eventos/${editando}`, payload);
      } else {
        await api.post('/calendario/eventos', payload);
      }
      setModalEvento(false);
      setFormEvento(FORM_EVENTO_VACIO);
      setEditando(null);
      await cargarMes();
      alert(editando ? '✅ Evento actualizado.' : '✅ Evento creado. Aparece en el calendario.');
    } catch (e) {
      alert(`Error al guardar:\n${extraerError(e)}`);
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminarEvento = async (idEvento) => {
    if (!window.confirm('¿Eliminar este evento recurrente y todas sus ocurrencias?')) return;
    try {
      await api.delete(`/calendario/eventos/${idEvento}`);
      setModalDetalle(null);
      await cargarMes();
    } catch (e) {
      alert(`Error al eliminar:\n${extraerError(e)}`);
    }
  };

  const handleEditarEvento = (ev) => {
    setFormEvento({
      titulo:         ev.titulo || '',
      materia:        ev.materia || '',
      nombre_escuela: ev.nombre_escuela || '',
      hora_inicio:    ev.hora_inicio || '08:00',
      hora_fin:       ev.hora_fin || '09:00',
      dias_semana:    ev.dias_semana || [],
      fecha_inicio:   ev.fecha_inicio || '',
      fecha_fin:      ev.fecha_fin || '',
      color:          ev.color || '#f472b6',
    });
    setEditando(ev.id_evento);
    setModalDetalle(null);
    setModalDia(null);
    setModalEvento(true);
  };

  const handleGuardarExcepcion = async () => {
    if (!modalExcepcion) return;
    setGuardando(true);
    try {
      await api.post('/calendario/excepciones', {
        id_evento:      modalExcepcion.id_evento,
        fecha_original: modalExcepcion.fecha,
        fecha_nueva:    formExc.fecha_nueva  || null,
        hora_inicio:    formExc.hora_inicio  || null,
        hora_fin:       formExc.hora_fin     || null,
        motivo:         formExc.motivo       || null,
      });
      setModalExcepcion(null);
      setModalDetalle(null);
      setModalDia(null);
      setFormExc({ fecha_nueva: '', hora_inicio: '', hora_fin: '', motivo: '' });
      await cargarMes();
      alert('✅ Excepción guardada.');
    } catch (e) {
      alert(`Error:\n${extraerError(e)}`);
    } finally {
      setGuardando(false);
    }
  };

  const handleGuardarFeriado = async () => {
    if (!formFeriado.nombre.trim() || !formFeriado.fecha_inicio || !formFeriado.fecha_fin) {
      alert('Completá nombre, fecha desde y fecha hasta.');
      return;
    }
    if (formFeriado.fecha_inicio > formFeriado.fecha_fin) {
      alert('La fecha "desde" no puede ser posterior a "hasta".');
      return;
    }
    setGuardando(true);
    try {
      await api.post('/calendario/feriados', { ...formFeriado, id_docente: userId });
      setModalFeriado(false);
      setFormFeriado(FORM_FERIADO_VACIO);
      await cargarMes();
      alert('✅ Feriado/Vacaciones guardado.');
    } catch (e) {
      alert(`Error:\n${extraerError(e)}`);
    } finally {
      setGuardando(false);
    }
  };

  const toggleDia = (num) => {
    setFormEvento(prev => ({
      ...prev,
      dias_semana: prev.dias_semana.includes(num)
        ? prev.dias_semana.filter(d => d !== num)
        : [...prev.dias_semana, num].sort(),
    }));
  };

  const grilla    = construirGrilla();
  const mesActual = mes.getMonth();

  return (
    <div style={{
      width: '95%', maxWidth: '1050px', height: '78vh',
      margin: '0 auto', display: 'flex', flexDirection: 'column',
      background: '#fff9c4', borderBottomRightRadius: '60px 220px',
      boxShadow: '10px 10px 30px rgba(0,0,0,0.35)',
      transform: 'rotate(-0.3deg)', fontFamily: "'Inkfree', cursive",
      overflow: 'hidden', position: 'relative',
    }}>

      {/* Chinche */}
      <div style={{
        position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
        width: 18, height: 18, background: '#dc2626', borderRadius: '50%',
        boxShadow: '2px 2px 5px rgba(0,0,0,0.4)', zIndex: 10,
      }} />

      {/* ── HEADER ── */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '24px 28px 12px',
        borderBottom: '2px dashed rgba(0,0,0,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setMes(m => { const n = new Date(m); n.setMonth(n.getMonth()-1); return n; })}
            style={btnNavStyle}>‹
          </button>
          <h2 style={{ fontFamily: "'KG Midnight Memories', cursive", fontSize: '2rem', margin: 0 }}>
            {cargando ? '...' : `${MESES[mes.getMonth()]} ${mes.getFullYear()}`}
          </h2>
          <button
            onClick={() => setMes(m => { const n = new Date(m); n.setMonth(n.getMonth()+1); return n; })}
            style={btnNavStyle}>›
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { setFormEvento(FORM_EVENTO_VACIO); setEditando(null); setModalEvento(true); }}
            style={btnAccionStyle('#f472b6')}>
            + Evento recurrente
          </button>
          <button
            onClick={() => { setFormFeriado(FORM_FERIADO_VACIO); setModalFeriado(true); }}
            style={btnAccionStyle('#fb923c')}>
            + Feriado / Vacaciones
          </button>
          <button onClick={onVolver} style={btnAccionStyle('#94a3b8')}>⬅ Volver</button>
        </div>
      </div>

      {/* ── GRILLA ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 4, marginBottom: 4,
        }}>
          {DIAS_CORTO.map(d => (
            <div key={d} style={{
              textAlign: 'center', fontWeight: 'bold',
              fontSize: '0.85rem', color: '#64748b', padding: '4px 0',
            }}>{d}</div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {grilla.map((d, i) => {
            const iso          = toISO(d);
            const esOtroMes    = d.getMonth() !== mesActual;
            const esHoy        = iso === toISO(new Date());
            const { evs, plans, fers } = eventosDelDia(iso);
            const tieneFeriado = fers.length > 0;

            return (
              <div
                key={i}
                onClick={() => abrirModalDia(iso, { evs, plans, fers })}
                style={{
                  minHeight: 80, borderRadius: 10,
                  background: tieneFeriado ? '#ffedd5' : esOtroMes ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.7)',
                  border: esHoy ? '2px solid #f472b6' : '1px solid rgba(0,0,0,0.07)',
                  padding: '4px 5px', overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                <div style={{
                  fontWeight: esHoy ? 'bold' : 'normal',
                  color: esOtroMes ? '#aaa' : '#1f2937',
                  fontSize: '0.82rem', marginBottom: 2,
                }}>
                  {d.getDate()}
                </div>

                {fers.map((f, fi) => (
                  <div key={fi} style={chipStyle('#fb923c')} title={f.nombre}>
                    🏖 {f.nombre.length > 8 ? f.nombre.slice(0,8)+'…' : f.nombre}
                  </div>
                ))}

                {evs.map((ev, ei) => (
                  <div key={ei}
                    onClick={e => { e.stopPropagation(); setModalDetalle(ev); }}
                    style={{ ...chipStyle(ev.color), cursor: 'pointer' }}
                    title={`${ev.titulo} ${ev.hora_inicio}–${ev.hora_fin}`}>
                    {ev.replanificado ? '🔄 ' : ''}{ev.hora_inicio?.slice(0,5)} {ev.titulo.length > 9 ? ev.titulo.slice(0,9)+'…' : ev.titulo}
                  </div>
                ))}

                {plans.map((p, pi) => (
                  <div key={pi}
                    onClick={e => { e.stopPropagation(); setPlanSeleccionada(p.id_planificacion); }}
                    style={{ ...chipStyle('#818cf8'), cursor: 'pointer' }}
                    title={p.nombre_clase}>
                    📋 {(p.nombre_clase||'').length > 8 ? (p.nombre_clase||'').slice(0,8)+'…' : p.nombre_clase}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════════ MODAL DÍA ═══════════════ */}
      {modalDia && (
        <Overlay onClose={() => setModalDia(null)}>
          <h3 style={modalTitulo}>
            📅 {formatFechaLarga(modalDia.iso).replace(/^\w/, l => l.toUpperCase())}
          </h3>

          {/* Sin eventos */}
          {modalDia.evs.length === 0 && modalDia.plans.length === 0 && modalDia.fers.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: '1.1rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📭</div>
              Sin eventos para este día
            </div>
          )}

          {/* Feriados */}
          {modalDia.fers.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 'bold', color: '#fb923c', marginBottom: 6, fontSize: '0.95rem' }}>
                🏖 Feriado / Vacaciones
              </div>
              {modalDia.fers.map((f, i) => (
                <div key={i} style={{
                  background: '#ffedd5', borderRadius: 10,
                  padding: '10px 14px', marginBottom: 6, fontSize: '1rem',
                }}>
                  <b>{f.nombre}</b>
                  {f.tipo && <span style={{ color: '#999', marginLeft: 8, fontSize: '0.85rem' }}>({f.tipo})</span>}
                </div>
              ))}
            </div>
          )}

          {/* Eventos recurrentes */}
          {modalDia.evs.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 'bold', color: '#374151', marginBottom: 6, fontSize: '0.95rem' }}>
                🕐 Eventos
              </div>
              {modalDia.evs.map((ev, i) => (
                <div key={i} style={{
                  background: ev.color + '22',
                  border: `2px solid ${ev.color}`,
                  borderRadius: 10, padding: '10px 14px', marginBottom: 8,
                }}>
                  <div style={{ fontWeight: 'bold', color: '#1f2937', fontSize: '1.05rem' }}>
                    {ev.titulo}
                    {ev.replanificado && <span style={{ color: '#fb923c', marginLeft: 6, fontSize: '0.85rem' }}>🔄 Replanificado</span>}
                  </div>
                  <div style={{ color: '#555', fontSize: '0.9rem', marginTop: 4 }}>
                    🕐 {ev.hora_inicio?.slice(0,5)} – {ev.hora_fin?.slice(0,5)}
                    {ev.materia && <span style={{ marginLeft: 10 }}>📚 {ev.materia}</span>}
                    {ev.nombre_escuela && <span style={{ marginLeft: 10 }}>🏫 {ev.nombre_escuela}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <button type="button"
                      onClick={() => { handleEditarEvento(ev); }}
                      style={btnAccionStyle('#818cf8')}>✏️ Editar serie
                    </button>
                    <button type="button"
                      onClick={() => { setModalExcepcion(ev); setModalDia(null); }}
                      style={btnAccionStyle('#fb923c')}>🔄 Replanificar este día
                    </button>
                    <button type="button"
                      onClick={() => handleEliminarEvento(ev.id_evento)}
                      style={btnAccionStyle('#f87171')}>🗑 Eliminar serie
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Planificaciones */}
          {modalDia.plans.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 'bold', color: '#374151', marginBottom: 6, fontSize: '0.95rem' }}>
                📋 Clases planificadas
              </div>
              {modalDia.plans.map((p, i) => (
                <div key={i} style={{
                  background: '#ede9fe', border: '2px solid #818cf8',
                  borderRadius: 10, padding: '10px 14px', marginBottom: 8,
                }}>
                  <div style={{ fontWeight: 'bold', color: '#1f2937', fontSize: '1.05rem' }}>
                    {p.nombre_clase}
                  </div>
                  {p.tema && <div style={{ color: '#555', fontSize: '0.9rem', marginTop: 2 }}>Tema: {p.tema}</div>}
                  {p.duracion && <div style={{ color: '#555', fontSize: '0.9rem' }}>Duración: {p.duracion}</div>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button type="button"
                      onClick={() => { setPlanSeleccionada(p.id_planificacion); setModalDia(null); }}
                      style={btnAccionStyle('#818cf8')}>
                      📋 Ver cronograma
                    </button>
                    {p.url_archivo && (
                      <a href={p.url_archivo} target="_blank" rel="noreferrer"
                        style={{ ...btnAccionStyle('#34d399'), textDecoration: 'none', display: 'inline-block' }}>
                        📄 Ver planificación
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" onClick={() => setModalDia(null)} style={btnAccionStyle('#94a3b8')}>
              Cerrar
            </button>
          </div>
        </Overlay>
      )}

      {/* ═══════════════ MODAL EVENTO RECURRENTE ═══════════════ */}
      {modalEvento && (
        <Overlay onClose={() => { if (!guardando) { setModalEvento(false); setEditando(null); } }}>
          <h3 style={modalTitulo}>{editando ? '✏️ Editar evento' : '+ Nuevo evento recurrente'}</h3>

          <label style={labelStyle}>Título *</label>
          <input style={inputStyle} placeholder="Ej: Física 3° B"
            value={formEvento.titulo}
            onChange={e => setFormEvento(p => ({...p, titulo: e.target.value}))} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Materia</label>
              <input style={inputStyle} placeholder="Ej: Física"
                value={formEvento.materia}
                onChange={e => setFormEvento(p => ({...p, materia: e.target.value}))} />
            </div>
            <div>
              <label style={labelStyle}>Escuela</label>
              <input style={inputStyle} placeholder="Nombre de la institución"
                value={formEvento.nombre_escuela}
                onChange={e => setFormEvento(p => ({...p, nombre_escuela: e.target.value}))} />
            </div>
          </div>

          <label style={labelStyle}>
            Días de la semana *
            {formEvento.dias_semana.length === 0 && (
              <span style={{ color: '#ef4444', marginLeft: 8, fontWeight: 'normal', fontSize: '0.85rem' }}>
                (seleccioná al menos uno)
              </span>
            )}
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {DIAS_SEMANA.map(({ num, label }) => (
              <button key={num} type="button" onClick={() => toggleDia(num)}
                style={{
                  padding: '6px 12px', borderRadius: 20, border: '2px solid',
                  borderColor: formEvento.dias_semana.includes(num) ? '#f472b6' : '#cbd5e1',
                  background:  formEvento.dias_semana.includes(num) ? '#f472b6' : 'white',
                  color:       formEvento.dias_semana.includes(num) ? 'white'   : '#374151',
                  cursor: 'pointer', fontFamily: "'Inkfree', cursive", fontWeight: 'bold',
                }}>
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Hora inicio *</label>
              <input type="time" style={inputStyle}
                value={formEvento.hora_inicio}
                onChange={e => setFormEvento(p => ({...p, hora_inicio: e.target.value}))} />
            </div>
            <div>
              <label style={labelStyle}>Hora fin *</label>
              <input type="time" style={inputStyle}
                value={formEvento.hora_fin}
                onChange={e => setFormEvento(p => ({...p, hora_fin: e.target.value}))} />
            </div>
            <div>
              <label style={labelStyle}>Fecha inicio *</label>
              <input type="date" style={inputStyle}
                value={formEvento.fecha_inicio}
                onChange={e => setFormEvento(p => ({...p, fecha_inicio: e.target.value}))} />
            </div>
            <div>
              <label style={labelStyle}>Fecha fin (opcional)</label>
              <input type="date" style={inputStyle}
                value={formEvento.fecha_fin}
                onChange={e => setFormEvento(p => ({...p, fecha_fin: e.target.value}))} />
            </div>
          </div>

          <label style={labelStyle}>Color</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {COLORES.map(c => (
              <div key={c}
                onClick={() => setFormEvento(p => ({...p, color: c}))}
                style={{
                  width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                  border: formEvento.color === c ? '3px solid #1f2937' : '2px solid transparent',
                }} />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button"
              onClick={() => { setModalEvento(false); setEditando(null); }}
              style={btnAccionStyle('#94a3b8')} disabled={guardando}>
              Cancelar
            </button>
            <button type="button" onClick={handleGuardarEvento} disabled={guardando}
              style={{ ...btnAccionStyle('#f472b6'), opacity: guardando ? 0.6 : 1 }}>
              {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear evento'}
            </button>
          </div>
        </Overlay>
      )}

      {/* ═══════════════ MODAL FERIADO ═══════════════ */}
      {modalFeriado && (
        <Overlay onClose={() => { if (!guardando) setModalFeriado(false); }}>
          <h3 style={modalTitulo}>+ Feriado / Vacaciones</h3>

          <label style={labelStyle}>Nombre *</label>
          <input style={inputStyle} placeholder="Ej: Día del Maestro"
            value={formFeriado.nombre}
            onChange={e => setFormFeriado(p => ({...p, nombre: e.target.value}))} />

          <label style={labelStyle}>Tipo</label>
          <select style={inputStyle} value={formFeriado.tipo}
            onChange={e => setFormFeriado(p => ({...p, tipo: e.target.value}))}>
            <option value="feriado">🗓 Feriado nacional</option>
            <option value="vacaciones">🏖 Vacaciones</option>
            <option value="otro">📌 Otro</option>
          </select>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Desde *</label>
              <input type="date" style={inputStyle}
                value={formFeriado.fecha_inicio}
                onChange={e => setFormFeriado(p => ({...p, fecha_inicio: e.target.value}))} />
            </div>
            <div>
              <label style={labelStyle}>Hasta *</label>
              <input type="date" style={inputStyle}
                value={formFeriado.fecha_fin}
                onChange={e => setFormFeriado(p => ({...p, fecha_fin: e.target.value}))} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button"
              onClick={() => setModalFeriado(false)}
              style={btnAccionStyle('#94a3b8')} disabled={guardando}>
              Cancelar
            </button>
            <button type="button" onClick={handleGuardarFeriado} disabled={guardando}
              style={{ ...btnAccionStyle('#fb923c'), opacity: guardando ? 0.6 : 1 }}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Overlay>
      )}

      {/* ═══════════════ MODAL DETALLE EVENTO (desde chip) ═══════════════ */}
      {modalDetalle && (
        <Overlay onClose={() => setModalDetalle(null)}>
          <h3 style={{ ...modalTitulo, color: modalDetalle.color }}>{modalDetalle.titulo}</h3>
          {modalDetalle.materia        && <p style={detalleP}>📚 Materia: <b>{modalDetalle.materia}</b></p>}
          {modalDetalle.nombre_escuela && <p style={detalleP}>🏫 Escuela: <b>{modalDetalle.nombre_escuela}</b></p>}
          <p style={detalleP}>🕐 {modalDetalle.hora_inicio?.slice(0,5)} – {modalDetalle.hora_fin?.slice(0,5)}</p>
          <p style={detalleP}>📅 {modalDetalle.fecha}</p>
          {modalDetalle.replanificado && (
            <p style={{ ...detalleP, color: '#fb923c' }}>🔄 Replanificado — {modalDetalle.motivo}</p>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <button type="button"
              onClick={() => handleEditarEvento(modalDetalle)}
              style={btnAccionStyle('#818cf8')}>✏️ Editar serie
            </button>
            <button type="button"
              onClick={() => { setModalExcepcion(modalDetalle); setModalDetalle(null); }}
              style={btnAccionStyle('#fb923c')}>🔄 Replanificar este día
            </button>
            <button type="button"
              onClick={() => handleEliminarEvento(modalDetalle.id_evento)}
              style={btnAccionStyle('#f87171')}>🗑 Eliminar serie
            </button>
            <button type="button"
              onClick={() => setModalDetalle(null)}
              style={btnAccionStyle('#94a3b8')}>Cerrar
            </button>
          </div>
        </Overlay>
      )}

      {/* ═══════════════ MODAL EXCEPCIÓN ═══════════════ */}
      {modalExcepcion && (
        <Overlay onClose={() => { if (!guardando) setModalExcepcion(null); }}>
          <h3 style={modalTitulo}>🔄 Replanificar — {modalExcepcion.titulo}</h3>
          <p style={detalleP}>Clase original: <b>{modalExcepcion.fecha}</b></p>

          <label style={labelStyle}>Nueva fecha (vacío = cancelar este día)</label>
          <input type="date" style={inputStyle}
            value={formExc.fecha_nueva}
            onChange={e => setFormExc(p => ({...p, fecha_nueva: e.target.value}))} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Nueva hora inicio</label>
              <input type="time" style={inputStyle}
                value={formExc.hora_inicio}
                onChange={e => setFormExc(p => ({...p, hora_inicio: e.target.value}))} />
            </div>
            <div>
              <label style={labelStyle}>Nueva hora fin</label>
              <input type="time" style={inputStyle}
                value={formExc.hora_fin}
                onChange={e => setFormExc(p => ({...p, hora_fin: e.target.value}))} />
            </div>
          </div>

          <label style={labelStyle}>Motivo</label>
          <input style={inputStyle} placeholder="Ej: Feriado, enfermedad..."
            value={formExc.motivo}
            onChange={e => setFormExc(p => ({...p, motivo: e.target.value}))} />

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button"
              onClick={() => setModalExcepcion(null)}
              style={btnAccionStyle('#94a3b8')} disabled={guardando}>
              Cancelar
            </button>
            <button type="button" onClick={handleGuardarExcepcion} disabled={guardando}
              style={{ ...btnAccionStyle('#fb923c'), opacity: guardando ? 0.6 : 1 }}>
              {guardando ? 'Guardando...' : 'Confirmar'}
            </button>
          </div>
        </Overlay>
      )}

      {/* ═══════════════ MODAL CRONOGRAMA DE PLANIFICACIÓN ═══════════════ */}
      {planSeleccionada && (
        <Overlay onClose={() => setPlanSeleccionada(null)}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: 16,
          }}>
            <h3 style={modalTitulo}>📋 Cronograma de clases</h3>
            <button
              onClick={() => setPlanSeleccionada(null)}
              style={btnAccionStyle('#94a3b8')}>
              ✕ Cerrar
            </button>
          </div>
          <CalendarioDocente idPlanificacion={planSeleccionada} />
        </Overlay>
      )}

    </div>
  );
}

// ── Overlay ───────────────────────────────────────────────────────────────────
function Overlay({ children, onClose }) {
  return (
    <div
      style={{
        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, borderRadius: 'inherit',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff9c4', borderRadius: 20, padding: '28px 32px',
          width: '90%', maxWidth: 520, maxHeight: '88%', overflowY: 'auto',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)', fontFamily: "'Inkfree', cursive",
        }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const btnNavStyle = {
  background: 'transparent', border: 'none', fontSize: '1.8rem',
  cursor: 'pointer', color: '#374151', padding: '0 6px',
};
const btnAccionStyle = color => ({
  background: color, color: 'white', border: 'none', borderRadius: 20,
  padding: '8px 16px', cursor: 'pointer', fontFamily: "'Inkfree', cursive",
  fontWeight: 'bold', fontSize: '0.9rem',
});
const chipStyle = color => ({
  background: color, color: 'white', borderRadius: 6,
  padding: '1px 4px', fontSize: '0.68rem', marginBottom: 2,
  display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
});
const inputStyle = {
  width: '100%', padding: '9px 14px', borderRadius: 10,
  border: '2px solid #cbd5e1', fontFamily: "'Inkfree', cursive",
  fontSize: '1rem', marginBottom: 12, boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.8)', outline: 'none',
};
const labelStyle = {
  display: 'block', fontWeight: 'bold', marginBottom: 4,
  fontSize: '0.9rem', color: '#374151',
};
const modalTitulo = {
  fontFamily: "'KG Midnight Memories', cursive",
  fontSize: '1.6rem', marginBottom: 16, color: '#1f2937',
};
const detalleP = { margin: '4px 0', fontSize: '1rem' };