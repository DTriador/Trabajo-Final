// src/components/dashboard/calendario/ModalFeriado.jsx
import React from 'react';
import Overlay from './Overlay';
import { btnAccionStyle, inputStyle, labelStyle, modalTitulo } from './calendarioHelpers';

export default function ModalFeriado({ visible, formFeriado, setFormFeriado, guardando, onGuardar, onCancelar }) {
  if (!visible) return null;

  return (
    <Overlay onClose={() => { if (!guardando) onCancelar(); }}>
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
        <button type="button" onClick={onCancelar} style={btnAccionStyle('#94a3b8')} disabled={guardando}>
          Cancelar
        </button>
        <button type="button" onClick={onGuardar} disabled={guardando}
          style={{ ...btnAccionStyle('#fb923c'), opacity: guardando ? 0.6 : 1 }}>
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </Overlay>
  );
}
