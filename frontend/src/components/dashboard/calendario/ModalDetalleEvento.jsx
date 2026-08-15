// src/components/dashboard/calendario/ModalDetalleEvento.jsx
import React from 'react';
import Overlay from './Overlay';
import { btnAccionStyle, modalTitulo, detalleP } from './calendarioHelpers';

export default function ModalDetalleEvento({ modalDetalle, onClose, onEditar, onReplanificar, onEliminar }) {
  if (!modalDetalle) return null;

  return (
    <Overlay onClose={onClose}>
      <h3 style={{ ...modalTitulo, color: modalDetalle.color }}>{modalDetalle.titulo}</h3>
      {modalDetalle.materia        && <p style={detalleP}>📚 Materia: <b>{modalDetalle.materia}</b></p>}
      {modalDetalle.nombre_escuela && <p style={detalleP}>🏫 Escuela: <b>{modalDetalle.nombre_escuela}</b></p>}
      <p style={detalleP}>🕐 {modalDetalle.hora_inicio?.slice(0,5)} – {modalDetalle.hora_fin?.slice(0,5)}</p>
      <p style={detalleP}>📅 {modalDetalle.fecha}</p>
      {modalDetalle.replanificado && (
        <p style={{ ...detalleP, color: '#fb923c' }}>🔄 Replanificado — {modalDetalle.motivo}</p>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => onEditar(modalDetalle)} style={btnAccionStyle('#818cf8')}>
          ✏️ Editar serie
        </button>
        <button type="button" onClick={() => onReplanificar(modalDetalle)} style={btnAccionStyle('#fb923c')}>
          🔄 Replanificar este día
        </button>
        <button type="button" onClick={() => onEliminar(modalDetalle.id_evento)} style={btnAccionStyle('#f87171')}>
          🗑 Eliminar serie
        </button>
        <button type="button" onClick={onClose} style={btnAccionStyle('#94a3b8')}>
          Cerrar
        </button>
      </div>
    </Overlay>
  );
}
