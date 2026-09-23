// src/components/dashboard/calendario/ModalClase.jsx
import React, { useEffect, useState } from 'react';
import Overlay from './Overlay';
import {
  tipoCronogramaEtiqueta, tipoCronogramaColor,
  btnAccionStyle, inputStyle, labelStyle, modalTitulo, detalleP,
} from './calendarioHelpers';

const MOTIVOS_SUSPENSION = [
  'Feriado',
  'Jornada institucional',
  'Suspensión de actividades',
  'Problema edilicio',
  'Ausencia docente',
  'Actividad institucional',
  'Cambio de calendario escolar',
  'Otro',
];

export default function ModalClase({ modalClase, onClose, onEliminar, onSuspender, onReprogramar, guardando = false }) {
  const [motivo, setMotivo] = useState(MOTIVOS_SUSPENSION[0]);
  const [observacion, setObservacion] = useState('');
  const [mostrarSuspension, setMostrarSuspension] = useState(false);
  const [mostrarReprogramacion, setMostrarReprogramacion] = useState(false);
  const [temaClase, setTemaClase] = useState('');
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [motivoReprogramacion, setMotivoReprogramacion] = useState('');
  const [desplazar, setDesplazar] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!modalClase) return;
    setMostrarSuspension(false);
    setMostrarReprogramacion(false);
    setNuevaFecha('');
    setMotivoReprogramacion('');
    setDesplazar(true);
    setTemaClase(modalClase.tema_clase || '');
    setError('');
  }, [modalClase]);

  if (!modalClase) return null;

  const etiqueta = `${tipoCronogramaEtiqueta(modalClase.tipo, modalClase.numero, modalClase.numero_tipo)}${modalClase.materia ? ` de ${modalClase.materia}` : ''}`;
  const yaSuspendida = modalClase.estado_clase === 'cancelada';
  const fechaActual = (modalClase.fecha_programada || modalClase.fecha || '').slice(0, 10);

  const confirmarEliminarSola = () => {
    if (window.confirm(`¿Eliminar solo "${etiqueta}"?\n\nEsta acción no se puede deshacer.`)) {
      onEliminar(modalClase.id_clase, false);
    }
  };

  const confirmarEliminarCascada = () => {
    if (window.confirm(
      `¿Eliminar "${etiqueta}" Y TODAS las clases posteriores de esta planificación?\n\n` +
      `Esto va a borrar la clase ${modalClase.numero} en adelante. Esta acción no se puede deshacer.`
    )) {
      onEliminar(modalClase.id_clase, true);
    }
  };

  const confirmarSuspenderManteniendo = () => {
    if (window.confirm(`¿Suspender "${etiqueta}"?\n\nEl resto del cronograma mantiene sus fechas.`)) {
      onSuspender(modalClase.id_clase, motivo, observacion, false);
    }
  };

  const confirmarSuspenderDesplazando = () => {
    if (window.confirm(
      `¿Suspender "${etiqueta}" y desplazar las clases posteriores?\n\n` +
      `Todas las clases siguientes se van a mover un día hacia adelante (respetando feriados).`
    )) {
      onSuspender(modalClase.id_clase, motivo, observacion, true);
    }
  };

  const confirmarReprogramacion = () => {
    setError('');
    if (!nuevaFecha) {
      setError('Elegí una fecha nueva para la clase.');
      return;
    }
    if (nuevaFecha === fechaActual && !temaClase.trim()) {
      setError('Cambiale el tema o elegí una fecha nueva.');
      return;
    }
    onReprogramar?.(
      modalClase.id_clase,
      nuevaFecha,
      motivoReprogramacion.trim(),
      desplazar,
      temaClase.trim(),
    );
  };

  return (
    <Overlay onClose={onClose}>
      <h3 style={{ ...modalTitulo, color: tipoCronogramaColor(modalClase.tipo) }}>
        {tipoCronogramaEtiqueta(modalClase.tipo, modalClase.numero, modalClase.numero_tipo)}
        {modalClase.materia ? ` de ${modalClase.materia}` : ''}
      </h3>

      {modalClase.nombre_escuela && (
        <p style={detalleP}>Escuela: <b>{modalClase.nombre_escuela}</b></p>
      )}

      {modalClase.hora_inicio && modalClase.hora_fin && (
        <p style={detalleP}>Horario: {modalClase.hora_inicio} a {modalClase.hora_fin} hs</p>
      )}

      {modalClase.tema_clase && (
        <p style={detalleP}>Tema: {modalClase.tema_clase}</p>
      )}

      {fechaActual && <p style={detalleP}>Fecha actual: <b>{fechaActual}</b></p>}

      {yaSuspendida && (
        <div style={{
          background: '#fee2e2', border: '2px solid #f87171',
          borderRadius: 10, padding: '10px 14px', marginTop: 12,
        }}>
          <p style={{ ...detalleP, fontWeight: 'bold', color: '#b91c1c' }}>Clase suspendida</p>
          {modalClase.motivo_suspension && (
            <p style={detalleP}>Motivo: {modalClase.motivo_suspension}</p>
          )}
          {modalClase.observacion_suspension && (
            <p style={detalleP}>Observación: {modalClase.observacion_suspension}</p>
          )}
        </div>
      )}

      {onReprogramar && (
        <div style={{
          marginTop: 18, paddingTop: 14,
          borderTop: '2px dashed rgba(0,0,0,0.12)',
        }}>
          <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#64748b', marginBottom: 8 }}>
            Reprogramar esta clase
          </div>
          {!mostrarReprogramacion ? (
            <button
              type="button"
              data-testid="button-reprogramar-clase"
              onClick={() => setMostrarReprogramacion(true)}
              style={btnAccionStyle('#818cf8')}
              disabled={guardando}
            >
              Elegir nueva fecha
            </button>
          ) : (
            <>
              <label style={labelStyle} htmlFor="fecha-reprogramacion">Nueva fecha</label>
               <label style={labelStyle} htmlFor="tema-clase">Tema de la clase</label>
               <input
                 id="tema-clase"
                 data-testid="input-tema-clase"
                 style={inputStyle}
                 value={temaClase}
                 onChange={e => setTemaClase(e.target.value)}
                 disabled={guardando}
               />
              <input
                id="fecha-reprogramacion"
                data-testid="input-fecha-reprogramacion"
                type="date"
                style={inputStyle}
                value={nuevaFecha}
                onChange={e => setNuevaFecha(e.target.value)}
                disabled={guardando}
              />
              <label style={labelStyle} htmlFor="motivo-reprogramacion">Motivo (opcional)</label>
              <input
                id="motivo-reprogramacion"
                data-testid="input-motivo-reprogramacion"
                style={inputStyle}
                placeholder="Ej: jornada institucional"
                value={motivoReprogramacion}
                onChange={e => setMotivoReprogramacion(e.target.value)}
                disabled={guardando}
              />
              <label style={{
                display: 'flex', gap: 9, alignItems: 'flex-start', cursor: guardando ? 'not-allowed' : 'pointer',
                background: desplazar ? '#ede9fe' : 'rgba(255,255,255,0.55)',
                border: `2px solid ${desplazar ? '#818cf8' : '#d6d3d1'}`,
                borderRadius: 10, padding: '10px 12px', marginBottom: 10,
              }}>
                <input
                  data-testid="checkbox-desplazar-clases"
                  type="checkbox"
                  checked={desplazar}
                  onChange={e => setDesplazar(e.target.checked)}
                  disabled={guardando}
                  style={{ marginTop: 3, accentColor: '#818cf8' }}
                />
                <span>
                  <strong>Desplazar las clases siguientes</strong>
                  <span style={{ display: 'block', color: '#64748b', fontSize: '0.8rem', marginTop: 3 }}>
                    Las clases posteriores se moverán en cascada y respetarán los feriados.
                  </span>
                </span>
              </label>
              {error && <div role="alert" style={{ color: '#b91c1c', background: '#fee2e2', borderRadius: 8, padding: '8px 10px', marginBottom: 10, fontSize: '0.88rem' }}>{error}</div>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={confirmarReprogramacion} style={{ ...btnAccionStyle('#818cf8'), opacity: guardando ? 0.6 : 1 }} disabled={guardando}>
                  {guardando ? 'Guardando…' : 'Guardar reprogramación'}
                </button>
                <button type="button" onClick={() => setMostrarReprogramacion(false)} style={btnAccionStyle('#94a3b8')} disabled={guardando}>
                  Cancelar
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Suspender / Cancelar clase ── */}
      {onSuspender && !yaSuspendida && (
        <div style={{
          marginTop: 18, paddingTop: 14,
          borderTop: '2px dashed rgba(0,0,0,0.12)',
        }}>
          <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#64748b', marginBottom: 8 }}>
            Suspender o cancelar esta clase
          </div>

          {!mostrarSuspension ? (
            <button type="button" onClick={() => setMostrarSuspension(true)} style={btnAccionStyle('#f59e0b')}>
              Suspender clase
            </button>
          ) : (
            <>
              <label style={labelStyle}>Motivo</label>
              <select style={inputStyle} value={motivo} onChange={e => setMotivo(e.target.value)}>
                {MOTIVOS_SUSPENSION.map(m => <option key={m} value={m}>{m}</option>)}
              </select>

              <label style={labelStyle}>Observación (opcional)</label>
              <input
                style={inputStyle}
                placeholder="Ej: Paro docente provincial"
                value={observacion}
                onChange={e => setObservacion(e.target.value)}
              />

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={confirmarSuspenderManteniendo} style={btnAccionStyle('#f59e0b')}>
                  Suspender (mantener fechas)
                </button>
                <button type="button" onClick={confirmarSuspenderDesplazando} style={btnAccionStyle('#d97706')}>
                  Suspender y desplazar siguientes
                </button>
                <button type="button" onClick={() => setMostrarSuspension(false)} style={btnAccionStyle('#94a3b8')}>
                  Cancelar
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Eliminar clase ── */}
      {onEliminar && (
        <div style={{
          marginTop: 18, paddingTop: 14,
          borderTop: '2px dashed rgba(0,0,0,0.12)',
        }}>
          <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#64748b', marginBottom: 8 }}>
            Eliminar esta clase del cronograma
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={confirmarEliminarSola} style={btnAccionStyle('#f87171')}>
              Solo esta clase
            </button>
            <button type="button" onClick={confirmarEliminarCascada} style={btnAccionStyle('#dc2626')}>
              Esta y las siguientes
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose} style={btnAccionStyle('#94a3b8')}>
          Cerrar
        </button>
      </div>
    </Overlay>
  );
}
