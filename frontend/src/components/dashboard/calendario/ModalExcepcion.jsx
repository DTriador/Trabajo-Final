// src/components/dashboard/calendario/ModalExcepcion.jsx
import React from 'react';
import Overlay from './Overlay';
import { btnAccionStyle, inputStyle, labelStyle, modalTitulo, detalleP } from './calendarioHelpers';

export default function ModalExcepcion({ modalExcepcion, formExc, setFormExc, guardando, onConfirmar, onCancelar }) {
  if (!modalExcepcion) return null;

  return (
    <Overlay onClose={() => { if (!guardando) onCancelar(); }}>
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
        <button type="button" onClick={onCancelar} style={btnAccionStyle('#94a3b8')} disabled={guardando}>
          Cancelar
        </button>
        <button type="button" onClick={onConfirmar} disabled={guardando}
          style={{ ...btnAccionStyle('#fb923c'), opacity: guardando ? 0.6 : 1 }}>
          {guardando ? 'Guardando...' : 'Confirmar'}
        </button>
      </div>
    </Overlay>
  );
}
