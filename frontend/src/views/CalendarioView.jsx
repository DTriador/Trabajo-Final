// src/views/CalendarioView.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

import ModalDia           from '../components/dashboard/calendario/ModalDia';
import ModalClase         from '../components/dashboard/calendario/ModalClase';
import ModalEvento        from '../components/dashboard/calendario/ModalEvento';
import ModalFeriado       from '../components/dashboard/calendario/ModalFeriado';
import ModalDetalleEvento from '../components/dashboard/calendario/ModalDetalleEvento';
import ModalExcepcion     from '../components/dashboard/calendario/ModalExcepcion';
import ModalCronograma    from '../components/dashboard/calendario/ModalCronograma';

import {
  MESES, DIAS_CORTO, FORM_EVENTO_VACIO, FORM_FERIADO_VACIO,
  extraerError, tipoCronogramaEtiqueta, tipoCronogramaColor,
  btnNavStyle, btnAccionStyle, chipStyle,
} from '../components/dashboard/calendario/calendarioHelpers';

export default function CalendarioView({ onVolver }) {
  const { user } = useAuth();
  const userId = user?.id || user?.id_docente || user?.user?.id;

  const [mes, setMes]             = useState(new Date());
  const [datos, setDatos]         = useState({ eventos: [], planificaciones: [], feriados: [] });
  const [cargando, setCargando]   = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cronograma, setCronograma] = useState([]);

  const [modalEvento,    setModalEvento]    = useState(false);
  const [modalFeriado,   setModalFeriado]   = useState(false);
  const [modalDetalle,   setModalDetalle]   = useState(null);   // detalle evento recurrente
  const [modalExcepcion, setModalExcepcion] = useState(null);
  const [modalDia,       setModalDia]       = useState(null);   // detalle del día
  const [modalClase,     setModalClase]     = useState(null);   // detalle de una clase puntual

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
      setCronograma(res.data.cronograma || []);
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
    cronograma: cronograma.filter(c => (c.fecha_programada || '').slice(0, 10) === iso),
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

  const handleEliminarClase = async (idClase, incluirSiguientes) => {
    try {
      await api.delete(`/generar/planificacion/clase/${idClase}`, {
        params: { incluir_siguientes: incluirSiguientes },
      });
      setModalClase(null);
      await cargarMes();
      alert(incluirSiguientes
        ? '✅ Clase y siguientes eliminadas.'
        : '✅ Clase eliminada.');
    } catch (e) {
      alert(`Error al eliminar:\n${extraerError(e)}`);
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
            const { evs, plans, fers, cronograma: cronoDia } = eventosDelDia(iso);
            const tieneFeriado = fers.length > 0;

            return (
              <div
                key={i}
                onClick={() => abrirModalDia(iso, { evs, plans, fers, cronograma: cronoDia })}
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

                {cronoDia.map((c, ci) => (
                  <div key={ci}
                    onClick={e => { e.stopPropagation(); setModalClase(c); }}
                    style={{ ...chipStyle(tipoCronogramaColor(c.tipo)), cursor: 'pointer' }}
                    title={`${tipoCronogramaEtiqueta(c.tipo, c.numero)}${c.nombre_plan ? ` · ${c.nombre_plan}` : ''}`}>
                    {tipoCronogramaEtiqueta(c.tipo, c.numero)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════════ MODALES ═══════════════ */}

      <ModalDia
        modalDia={modalDia}
        onClose={() => setModalDia(null)}
        onEditarEvento={handleEditarEvento}
        onReplanificarEvento={(ev) => { setModalExcepcion(ev); setModalDia(null); }}
        onEliminarEvento={handleEliminarEvento}
        onVerCronograma={(idPlan) => { setPlanSeleccionada(idPlan); setModalDia(null); }}
        onSeleccionarClase={(c) => { setModalClase(c); setModalDia(null); }}
      />

      <ModalClase
        modalClase={modalClase}
        onClose={() => setModalClase(null)}
        onEliminar={handleEliminarClase}
      />

      <ModalEvento
        visible={modalEvento}
        formEvento={formEvento}
        setFormEvento={setFormEvento}
        editando={editando}
        guardando={guardando}
        onGuardar={handleGuardarEvento}
        onCancelar={() => { setModalEvento(false); setEditando(null); }}
        toggleDia={toggleDia}
      />

      <ModalFeriado
        visible={modalFeriado}
        formFeriado={formFeriado}
        setFormFeriado={setFormFeriado}
        guardando={guardando}
        onGuardar={handleGuardarFeriado}
        onCancelar={() => setModalFeriado(false)}
      />

      <ModalDetalleEvento
        modalDetalle={modalDetalle}
        onClose={() => setModalDetalle(null)}
        onEditar={handleEditarEvento}
        onReplanificar={(ev) => { setModalExcepcion(ev); setModalDetalle(null); }}
        onEliminar={handleEliminarEvento}
      />

      <ModalExcepcion
        modalExcepcion={modalExcepcion}
        formExc={formExc}
        setFormExc={setFormExc}
        guardando={guardando}
        onConfirmar={handleGuardarExcepcion}
        onCancelar={() => setModalExcepcion(null)}
      />

      <ModalCronograma
        idPlanificacion={planSeleccionada}
        onClose={() => setPlanSeleccionada(null)}
      />

    </div>
  );
}
