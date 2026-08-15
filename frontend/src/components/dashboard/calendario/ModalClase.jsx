// src/components/dashboard/calendario/ModalClase.jsx
import React from 'react';
import Overlay from './Overlay';
import { tipoCronogramaEtiqueta, tipoCronogramaColor, btnAccionStyle, modalTitulo, detalleP } from './calendarioHelpers';

export default function ModalClase({ modalClase, onClose, onEliminar }) {
  if (!modalClase) return null;

  const etiqueta = `${tipoCronogramaEtiqueta(modalClase.tipo, modalClase.numero)}${modalClase.materia ? ` de ${modalClase.materia}` : ''}`;

  const confirmarEliminarSola = () => {
    if (window.confirm(`¿Eliminar solo "${etiqueta}"?\n\nEsta acción no se puede deshacer.`)) {
      onEliminar(modalClase.id, false);
    }
  };

  const confirmarEliminarCascada = () => {
    if (window.confirm(
      `¿Eliminar "${etiqueta}" Y TODAS las clases posteriores de esta planificación?\n\n` +
      `Esto va a borrar la clase ${modalClase.numero} en adelante. Esta acción no se puede deshacer.`
    )) {
      onEliminar(modalClase.id, true);
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
