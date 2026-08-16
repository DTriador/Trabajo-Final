// src/components/dashboard/calendario/ModalClase.jsx
import React, { useState } from 'react';
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

export default function ModalClase({ modalClase, onClose, onEliminar, onSuspender }) {
  const [motivo, setMotivo] = useState(MOTIVOS_SUSPENSION[0]);
  const [observacion, setObservacion] = useState('');
  const [mostrarSuspension, setMostrarSuspension] = useState(false);

  if (!modalClase) return null;

  const etiqueta = `${tipoCronogramaEtiqueta(modalClase.tipo, modalClase.numero)}${modalClase.materia ? ` de ${modalClase.materia}` : ''}`;
  const yaSuspendida = modalClase.estado_clase === 'cancelada';

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

  return (
    <Overlay onClose={onClose}>
      <h3 style={{ ...modalTitulo, color: tipoCronogramaColor(modalClase.tipo) }}>
        {tipoCronogramaEtiqueta(modalClase.tipo, modalClase.numero)}
        {modalClase.materia ? ` de ${modalClase.materia}` : ''}
      </h3>

      {modalClase.nombre_escuela && (
        <p style={detalleP}>🏫 Escuela: <b>{modalClase.nombre_escuela}</b></p>
      )}

      {modalClase.hora_inicio && modalClase.hora_fin && (
        <p style={detalleP}>🕐 {modalClase.hora_inicio} a {modalClase.hora_fin} hs</p>
      )}

      {modalClase.tema_clase && (
        <p style={detalleP}>📌 Tema: {modalClase.tema_clase}</p>
      )}

      {yaSuspendida && (
        <div style={{
          background: '#fee2e2', border: '2px solid #f87171',
          borderRadius: 10, padding: '10px 14px', marginTop: 12,
        }}>
          <p style={{ ...detalleP, fontWeight: 'bold', color: '#b91c1c' }}>🚫 Clase suspendida</p>
          {modalClase.motivo_suspension && (
            <p style={detalleP}>Motivo: {modalClase.motivo_suspension}</p>
          )}
          {modalClase.observacion_suspension && (
            <p style={detalleP}>Observación: {modalClase.observacion_suspension}</p>
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
            🚫 Suspender / cancelar esta clase
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
            🗑 Eliminar esta clase del cronograma
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
