// src/components/dashboard/calendario/ModalClase.jsx
import React from 'react';
import Overlay from './Overlay';
import { tipoCronogramaEtiqueta, tipoCronogramaColor, btnAccionStyle, modalTitulo, detalleP } from './calendarioHelpers';

export default function ModalClase({ modalClase, onClose }) {
  if (!modalClase) return null;

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

      <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose} style={btnAccionStyle('#94a3b8')}>
          Cerrar
        </button>
      </div>
    </Overlay>
  );
}
