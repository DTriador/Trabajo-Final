// src/components/dashboard/CalendarioModal.jsx
import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

// ── Constantes ────────────────────────────────────────────────────────────────
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto',
               'septiembre','octubre','noviembre','diciembre'];
const DIAS_SEMANA_LARGO = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const DIAS_SEMANA_CORTO = ['D','L','M','X','J','V','S'];

const TIPO_CONFIG = {
  clase:         { label: 'Clase',         color: '#818cf8', bg: '#ede9fe' },
  examen:        { label: 'Examen',        color: '#f59e0b', bg: '#fef3c7' },
  recuperatorio: { label: 'Recuperatorio', color: '#22c55e', bg: '#dcfce7' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const toISO = (d) => {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatFechaLarga = (isoStr) => {
  const [y, m, d] = isoStr.split('-').map(Number);
  const f = new Date(y, m - 1, d);
  return `${DIAS_SEMANA_LARGO[f.getDay()]} ${d} de ${MESES[m - 1]} de ${y}`;
};

const construirGrilla = (fechaRef) => {
  const year     = fechaRef.getFullYear();
  const month    = fechaRef.getMonth();
  const primerDia = new Date(year, month, 1);
  const offset   = primerDia.getDay();
  const inicio   = new Date(year, month, 1 - offset);
  const dias = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    dias.push(d);
  }
  return dias;
};

// ── Componente ────────────────────────────────────────────────────────────────
const CalendarioModal = ({ agenda, setAgenda }) => {
  const { user } = useAuth();

  const [mesActual,        setMesActual]        = useState(new Date());
  const [diaSeleccionado,  setDiaSeleccionado]  = useState(null);
  const [feriados,         setFeriados]         = useState([]);
  const [cronograma,       setCronograma]       = useState([]);
  const [cargandoMes,      setCargandoMes]      = useState(false);
  const [replanModal,      setReplanModal]      = useState(null);
  // replanModal = { clase, nuevaFecha, motivo, desplazar }

  // ── Cargar datos del mes (feriados + cronograma de clases) ──────────────────
  useEffect(() => {
    const cargarMes = async () => {
      const userId = user?.id || user?.id_docente || user?.user?.id;
      if (!userId) return;
      setCargandoMes(true);
      try {
        const anio = mesActual.getFullYear();
        const mes  = mesActual.getMonth() + 1;
        const res  = await api.get(`/calendario/mes/${userId}/${anio}/${mes}`);
        setFeriados(res.data.feriados     || []);
        setCronograma(res.data.cronograma || []);
      } catch (err) {
        console.error('Error cargando mes:', err);
      } finally {
        setCargandoMes(false);
      }
    };
    if (user) cargarMes();
  }, [mesActual, user]);

  // ── Helpers de calendario ───────────────────────────────────────────────────
  const cambiarMes = (delta) => {
    const nuevo = new Date(mesActual);
    nuevo.setMonth(nuevo.getMonth() + delta);
    setMesActual(nuevo);
  };

  const clasesPorFecha = cronograma.reduce((acc, c) => {
    const fecha = (c.fecha_programada || '').slice(0, 10);
    if (!acc[fecha]) acc[fecha] = [];
    acc[fecha].push(c);
    return acc;
  }, {});

  const esFeriado = (iso) => {
    const fecha = new Date(iso + 'T00:00:00');
    return feriados.some(f => {
      const inicio = new Date(f.fecha_inicio + 'T00:00:00');
      const fin    = new Date(f.fecha_fin    + 'T00:00:00');
      return fecha >= inicio && fecha <= fin;
    });
  };

  const feriadoDelDia = (iso) =>
    feriados.find(f => {
      const fecha  = new Date(iso + 'T00:00:00');
      const inicio = new Date(f.fecha_inicio + 'T00:00:00');
      const fin    = new Date(f.fecha_fin    + 'T00:00:00');
      return fecha >= inicio && fecha <= fin;
    });

  const clasesDelDia = (iso) => clasesPorFecha[iso] || [];

  // ── Replanificar ────────────────────────────────────────────────────────────
  const confirmarReplan = async () => {
    if (!replanModal) return;
    const { clase, nuevaFecha, motivo, desplazar } = replanModal;
    try {
      const res = await api.put(
        `/generar/planificacion/clase/${clase.id}/replanificar`,
        { nueva_fecha: nuevaFecha, motivo, desplazar_siguientes: desplazar }
      );
      const desplazadas = res.data.clases_desplazadas || 0;
      alert(
        desplazar && desplazadas > 0
          ? `✅ Clase replanificada. Se desplazaron ${desplazadas} clase(s) siguientes.`
          : '✅ Clase replanificada.'
      );
      // Recargar el mes
      const userId = user?.id || user?.id_docente || user?.user?.id;
      const anio   = mesActual.getFullYear();
      const mes    = mesActual.getMonth() + 1;
      const r2     = await api.get(`/calendario/mes/${userId}/${anio}/${mes}`);
      setCronograma(r2.data.cronograma || []);
      setDiaSeleccionado(nuevaFecha);
      setReplanModal(null);
    } catch (err) {
      alert(`❌ No se pudo replanificar: ${err.response?.data?.detail || err.message}`);
    }
  };
  // ── Configuración visual de estados ────────────────────────────────────────
const ESTADO_CONFIG = {
  programada:   { label: 'Programada',   color: '#94a3b8', bg: '#f1f5f9', next: 'dictada'    },
  dictada:      { label: 'Dictada ✓',    color: '#16a34a', bg: '#dcfce7', next: 'cancelada'  },
  cancelada:    { label: 'Cancelada ✗',  color: '#dc2626', bg: '#fee2e2', next: 'programada' },
  reprogramada: { label: 'Reprogramada', color: '#f59e0b', bg: '#fef3c7', next: 'dictada'    },
};

const cambiarEstado = async (clase) => {
  const actual    = clase.estado_clase || 'programada';
  const siguiente = ESTADO_CONFIG[actual]?.next || 'programada';

  // Actualizar local inmediatamente
  setCronograma(prev =>
    prev.map(c => c.id === clase.id ? { ...c, estado_clase: siguiente } : c)
  );

  try {
    await api.put(`/generar/planificacion/clase/${clase.id}/estado`, { estado: siguiente });
  } catch (err) {
    // Revertir si falla
    setCronograma(prev =>
      prev.map(c => c.id === clase.id ? { ...c, estado_clase: actual } : c)
    );
    console.error('Error cambiando estado:', err);
  }
};

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>

      {/* ── MODAL REPLANIFICACIÓN ─────────────────────────────────────────── */}
      {replanModal && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.55)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setReplanModal(null); }}
        >
          <div style={{
            background: 'white', borderRadius: 16, padding: '28px 32px',
            width: 420, maxWidth: '90vw',
            boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
          }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '1.1rem', color: '#1e3a8a' }}>
              📅 Replanificar clase
            </h3>

            {/* Info de la clase */}
            <div style={{
              background: '#f1f5f9', borderRadius: 10, padding: '10px 14px',
              marginBottom: 18, fontSize: '0.9rem',
            }}>
              <div style={{ fontWeight: 'bold', color: '#374151' }}>
                {TIPO_CONFIG[replanModal.clase.tipo]?.label} {replanModal.clase.numero}
                {' — '}{replanModal.clase.nombre_plan}
              </div>
              <div style={{ color: '#64748b', marginTop: 2 }}>
                {replanModal.clase.tema_clase}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 2 }}>
                Fecha actual:{' '}
                <strong>
                  {formatFechaLarga((replanModal.clase.fecha_programada || '').slice(0, 10))}
                </strong>
              </div>
            </div>

            {/* Nueva fecha */}
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.88rem', color: '#374151', marginBottom: 4 }}>
              Nueva fecha
            </label>
            <input
              type="date"
              value={replanModal.nuevaFecha}
              onChange={e => setReplanModal(prev => ({ ...prev, nuevaFecha: e.target.value }))}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '9px 13px', borderRadius: 10,
                border: '2px solid #cbd5e1', fontSize: '1rem', marginBottom: 14,
              }}
            />

            {/* Motivo */}
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.88rem', color: '#374151', marginBottom: 4 }}>
              Motivo (opcional)
            </label>
            <input
              type="text"
              placeholder="Ej: feriado no registrado, cambio de horario..."
              value={replanModal.motivo}
              onChange={e => setReplanModal(prev => ({ ...prev, motivo: e.target.value }))}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '9px 13px', borderRadius: 10,
                border: '2px solid #cbd5e1', fontSize: '0.95rem', marginBottom: 16,
              }}
            />

            {/* Checkbox cascada */}
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              cursor: 'pointer', marginBottom: 22,
              background: replanModal.desplazar ? '#ede9fe' : '#f8fafc',
              border: `2px solid ${replanModal.desplazar ? '#818cf8' : '#e2e8f0'}`,
              borderRadius: 10, padding: '10px 14px',
              transition: 'all 0.15s',
            }}>
              <input
                type="checkbox"
                checked={replanModal.desplazar}
                onChange={e => setReplanModal(prev => ({ ...prev, desplazar: e.target.checked }))}
                style={{ marginTop: 2, accentColor: '#818cf8', width: 16, height: 16 }}
              />
              <div>
                <div style={{ fontWeight: 'bold', color: '#374151', fontSize: '0.9rem' }}>
                  Desplazar clases siguientes en cascada
                </div>
                <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 3 }}>
                  {replanModal.desplazar
                    ? 'Todas las clases posteriores se moverán la misma cantidad de días, respetando feriados.'
                    : 'Solo se mueve esta clase. Las siguientes conservan sus fechas originales.'}
                </div>
              </div>
            </label>

            {/* Botones */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setReplanModal(null)}
                style={{
                  padding: '9px 20px', borderRadius: 20,
                  border: '2px solid #cbd5e1', background: 'white',
                  cursor: 'pointer', fontWeight: 'bold', color: '#64748b', fontSize: '0.95rem',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarReplan}
                style={{
                  padding: '9px 22px', borderRadius: 20, border: 'none',
                  background: '#818cf8', color: 'white',
                  cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem',
                }}
              >
                Confirmar 📅
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CALENDARIO ────────────────────────────────────────────────────── */}
      <div style={{ backgroundColor: '#1f1f1f', borderRadius: '16px', padding: '20px', color: 'white' }}>
        {/* Fecha seleccionada / hoy */}
        <div style={{ fontSize: '0.95rem', color: '#bbb' }}>
          {DIAS_SEMANA_LARGO[
            new Date((diaSeleccionado || toISO(new Date())) + 'T00:00:00').getDay()
          ]}
        </div>
        <div style={{ fontSize: '1.3rem', marginBottom: '16px', color: '#eee' }}>
          {formatFechaLarga(diaSeleccionado || toISO(new Date()))}
        </div>

        {/* Nav de mes */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <button type="button" onClick={() => cambiarMes(-1)}
            style={{ background: 'transparent', border: 'none', color: '#ddd', cursor: 'pointer', fontSize: '1.2rem' }}>‹</button>
          <div style={{ fontWeight: 'bold' }}>
            {MESES[mesActual.getMonth()]} {mesActual.getFullYear()}
            {cargandoMes && <span style={{ marginLeft: 6, fontSize: '0.7rem', color: '#888' }}>⟳</span>}
          </div>
          <button type="button" onClick={() => cambiarMes(1)}
            style={{ background: 'transparent', border: 'none', color: '#ddd', cursor: 'pointer', fontSize: '1.2rem' }}>›</button>
        </div>

        {/* Cabecera días */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', color: '#888', fontSize: '0.8rem', marginBottom: '4px' }}>
          {DIAS_SEMANA_CORTO.map(d => <div key={d}>{d}</div>)}
        </div>

        {/* Grilla */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {construirGrilla(mesActual).map((d, i) => {
            const iso            = toISO(d);
            const esOtroMes      = d.getMonth() !== mesActual.getMonth();
            const esSeleccionado = iso === diaSeleccionado;
            const diaEsFeriado   = esFeriado(iso);
            const clasesHoy      = clasesDelDia(iso);
            const tieneClases    = clasesHoy.length > 0;
            const tipoIndicador  = clasesHoy.find(c => c.tipo === 'examen')
              ? 'examen'
              : clasesHoy.find(c => c.tipo === 'recuperatorio')
              ? 'recuperatorio'
              : 'clase';

            return (
              <button
                key={i}
                type="button"
                title={
                  diaEsFeriado  ? feriadoDelDia(iso)?.nombre :
                  tieneClases   ? `${clasesHoy.length} clase(s)` : ''
                }
                onClick={() => {
                  setDiaSeleccionado(iso);
                  if (esOtroMes) setMesActual(new Date(d.getFullYear(), d.getMonth(), 1));
                }}
                style={{
                  width: '36px', height: '36px', margin: '0 auto',
                  borderRadius: '50%', border: 'none', cursor: 'pointer',
                  fontSize: '0.9rem', position: 'relative',
                  color: esSeleccionado ? 'white'
                       : esOtroMes     ? '#555'
                       : diaEsFeriado  ? '#ff6b6b'
                       : tieneClases   ? (TIPO_CONFIG[tipoIndicador]?.color || '#ff7eb9')
                       : '#ddd',
                  backgroundColor: esSeleccionado ? '#e53e6b' : 'transparent',
                  fontWeight: tieneClases || esSeleccionado ? 'bold' : 'normal',
                  textDecoration: diaEsFeriado ? 'line-through' : 'none',
                }}
              >
                {d.getDate()}
                {tieneClases && !esSeleccionado && (
                  <span style={{
                    position: 'absolute', bottom: 2, left: '50%',
                    transform: 'translateX(-50%)',
                    width: 4, height: 4, borderRadius: '50%',
                    background: TIPO_CONFIG[tipoIndicador]?.color || '#818cf8',
                    display: 'block',
                  }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Leyenda */}
        <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '0.75rem' }}>
          {Object.entries(TIPO_CONFIG).map(([tipo, cfg]) => (
            <span key={tipo} style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#ccc' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, display: 'inline-block' }} />
              {cfg.label}
            </span>
          ))}
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#ff6b6b' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff6b6b', display: 'inline-block' }} />
            Feriado
          </span>
        </div>

        {/* Panel día seleccionado */}
        <div style={{ marginTop: '16px', backgroundColor: '#2a2a2a', borderRadius: '10px', padding: '12px', minHeight: 60 }}>
          {(() => {
            const iso     = diaSeleccionado || toISO(new Date());
            const clases  = clasesDelDia(iso);
            const feriado = feriadoDelDia(iso);

            if (feriado) return (
              <div style={{ color: '#ff6b6b', fontSize: '0.9rem' }}>🚫 {feriado.nombre}</div>
            );
            if (clases.length === 0) return (
              <div style={{ color: '#777', fontSize: '0.85rem' }}>No hay clases este día.</div>
            );
            return clases.map((c, i) => {
              const cfg     = TIPO_CONFIG[c.tipo] || TIPO_CONFIG.clase;
              const esCfg   = ESTADO_CONFIG[c.estado_clase || 'programada'] || ESTADO_CONFIG.programada;
              return (
                <div key={i} style={{
                  marginBottom: i < clases.length - 1 ? 8 : 0,
                  padding: '6px 8px', borderRadius: 8,
                  borderLeft: `3px solid ${cfg.color}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{
                      background: cfg.color, color: 'white',
                      borderRadius: 20, padding: '1px 8px',
                      fontSize: '0.72rem', fontWeight: 'bold',
                    }}>
                      {cfg.label} {c.numero}
                    </span>
                    {/* Badge de estado — clickeable */}
                    <button
                      type="button"
                      title="Click para cambiar estado"
                      onClick={() => cambiarEstado(c)}
                      style={{
                        background: esCfg.bg, color: esCfg.color,
                        border: `1px solid ${esCfg.color}`,
                        borderRadius: 20, padding: '1px 8px',
                        fontSize: '0.72rem', fontWeight: 'bold',
                        cursor: 'pointer',
                      }}
                    >
                      {esCfg.label}
                    </button>
                    <span style={{ color: '#888', fontSize: '0.78rem' }}>{c.nombre_plan}</span>
                  </div>
                  <div style={{ color: '#eee', fontSize: '0.88rem', marginTop: 4 }}>{c.tema_clase}</div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* ── AGENDA LATERAL ────────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: 'white', color: '#222', borderRadius: '16px',
        overflow: 'hidden', maxHeight: '560px',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          textAlign: 'center', padding: '14px',
          fontSize: '1.6rem', fontWeight: 'bold',
          borderBottom: '1px solid #ddd', fontFamily: 'serif',
        }}>
          Agenda
        </div>

        <div style={{ padding: '8px 16px', background: '#f8fafc', borderBottom: '1px solid #eee', fontSize: '0.82rem', color: '#64748b' }}>
          Clases planificadas en {MESES[mesActual.getMonth()]} — {cronograma.length} entr{cronograma.length === 1 ? 'ada' : 'adas'}
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {cronograma.length === 0 && (
            <div style={{ padding: '24px', color: '#777', textAlign: 'center' }}>
              {cargandoMes ? '⟳ Cargando...' : 'No hay clases planificadas este mes.'}
            </div>
          )}

          {cronograma.map((c, idx) => {
            const iso         = (c.fecha_programada || '').slice(0, 10);
            const seleccionada = iso === diaSeleccionado;
            const cfg         = TIPO_CONFIG[c.tipo] || TIPO_CONFIG.clase;
            const reprogramada = c.estado_clase === 'reprogramada';

           return (
            <div key={idx} style={{ borderBottom: '1px solid #eee' }}>
              <button
                type="button"
                onClick={() => {
                  setDiaSeleccionado(iso);
                  const [y, m] = iso.split('-').map(Number);
                  setMesActual(new Date(y, m - 1, 1));
                }}
                style={{
                  width: '100%', textAlign: 'left',
                  padding: '11px 18px',
                  background: seleccionada ? cfg.bg : 'transparent',
                  border: 'none', cursor: 'pointer',
                  borderLeft: `4px solid ${seleccionada ? cfg.color : 'transparent'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    background: cfg.color, color: 'white',
                    borderRadius: 20, padding: '2px 10px',
                    fontSize: '0.75rem', fontWeight: 'bold', whiteSpace: 'nowrap',
                  }}>
                    {cfg.label} {c.numero}
                  </span>
                  <span style={{ fontSize: '0.82rem', color: '#666' }}>
                    {formatFechaLarga(iso)}
                  </span>
                  {reprogramada && (
                    <span style={{
                      background: '#fef3c7', color: '#92400e',
                      borderRadius: 20, padding: '1px 8px',
                      fontSize: '0.72rem', fontWeight: 'bold',
                    }}>
                      reprogramada
                    </span>
                  )}
                </div>
                <div style={{
                  marginTop: 4, fontSize: '0.92rem',
                  color: '#222', fontWeight: seleccionada ? 'bold' : 'normal',
                }}>
                  {c.tema_clase}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#888', marginTop: 2 }}>
                  {c.nombre_plan}
                </div>
              </button>

              {/* Panel expandido al seleccionar */}
              {seleccionada && (() => {
                const esCfg = ESTADO_CONFIG[c.estado_clase || 'programada'] || ESTADO_CONFIG.programada;
                return (
                  <div style={{ padding: '0 18px 14px 18px', background: cfg.bg }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                      {/* Botón replanificar */}
                      <button
                        type="button"
                        onClick={() => setReplanModal({
                          clase:      c,
                          nuevaFecha: iso,
                          motivo:     '',
                          desplazar:  true,
                        })}
                        style={{
                          padding: '7px 16px', borderRadius: 20, border: 'none',
                          background: cfg.color, color: 'white',
                          cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem',
                        }}
                      >
                        Replanificar 📅
                      </button>

                      {/* Badge de estado — click para ciclar */}
                      <button
                        type="button"
                        title={`Estado: ${esCfg.label}. Click para cambiar.`}
                        onClick={() => cambiarEstado(c)}
                        style={{
                          padding: '7px 14px', borderRadius: 20,
                          border: `2px solid ${esCfg.color}`,
                          background: esCfg.bg, color: esCfg.color,
                          cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem',
                        }}
                      >
                        {esCfg.label}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
          })}
        </div>
      </div>

    </div>
  );
};

export default CalendarioModal;