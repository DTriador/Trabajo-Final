// src/components/dashboard/calendario/ModalCronograma.jsx
import React from 'react';
import Overlay from './Overlay';
import CalendarioDocente from '../CalendarioDocente';
import { btnAccionStyle, modalTitulo } from './calendarioHelpers';

export default function ModalCronograma({ idPlanificacion, onClose }) {
  if (!idPlanificacion) return null;

  return (
    <Overlay onClose={onClose}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 16,
      }}>
        <h3 style={modalTitulo}>📋 Cronograma de clases</h3>
        <button onClick={onClose} style={btnAccionStyle('#94a3b8')}>
          ✕ Cerrar
        </button>
      </div>
      <CalendarioDocente idPlanificacion={idPlanificacion} />
    </Overlay>
  );
}
