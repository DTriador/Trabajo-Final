// src/components/dashboard/calendario/ModalEvento.jsx
import React from 'react';
import Overlay from './Overlay';
import { DIAS_SEMANA, COLORES, btnAccionStyle, inputStyle, labelStyle, modalTitulo } from './calendarioHelpers';

export default function ModalEvento({
  visible, formEvento, setFormEvento, editando, guardando,
  onGuardar, onCancelar, toggleDia,
}) {
  if (!visible) return null;

  return (
    <Overlay onClose={() => { if (!guardando) onCancelar(); }}>
      <h3 style={modalTitulo}>{editando ? '✏️ Editar evento' : '+ Nuevo evento recurrente'}</h3>

      <label style={labelStyle}>Título *</label>
      <input style={inputStyle} placeholder="Ej: Física 3° B"
        value={formEvento.titulo}
        onChange={e => setFormEvento(p => ({...p, titulo: e.target.value}))} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Materia</label>
          <input style={inputStyle} placeholder="Ej: Física"
            value={formEvento.materia}
            onChange={e => setFormEvento(p => ({...p, materia: e.target.value}))} />
        </div>
        <div>
          <label style={labelStyle}>Escuela</label>
          <input style={inputStyle} placeholder="Nombre de la institución"
            value={formEvento.nombre_escuela}
            onChange={e => setFormEvento(p => ({...p, nombre_escuela: e.target.value}))} />
        </div>
      </div>

      <label style={labelStyle}>
        Días de la semana *
        {formEvento.dias_semana.length === 0 && (
          <span style={{ color: '#ef4444', marginLeft: 8, fontWeight: 'normal', fontSize: '0.85rem' }}>
            (seleccioná al menos uno)
          </span>
        )}
      </label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {DIAS_SEMANA.map(({ num, label }) => (
          <button key={num} type="button" onClick={() => toggleDia(num)}
            style={{
              padding: '6px 12px', borderRadius: 20, border: '2px solid',
              borderColor: formEvento.dias_semana.includes(num) ? '#f472b6' : '#cbd5e1',
              background:  formEvento.dias_semana.includes(num) ? '#f472b6' : 'white',
              color:       formEvento.dias_semana.includes(num) ? 'white'   : '#374151',
              cursor: 'pointer', fontFamily: "'Inkfree', cursive", fontWeight: 'bold',
            }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Hora inicio *</label>
          <input type="time" style={inputStyle}
            value={formEvento.hora_inicio}
            onChange={e => setFormEvento(p => ({...p, hora_inicio: e.target.value}))} />
        </div>
        <div>
          <label style={labelStyle}>Hora fin *</label>
          <input type="time" style={inputStyle}
            value={formEvento.hora_fin}
            onChange={e => setFormEvento(p => ({...p, hora_fin: e.target.value}))} />
        </div>
        <div>
          <label style={labelStyle}>Fecha inicio *</label>
          <input type="date" style={inputStyle}
            value={formEvento.fecha_inicio}
            onChange={e => setFormEvento(p => ({...p, fecha_inicio: e.target.value}))} />
        </div>
        <div>
          <label style={labelStyle}>Fecha fin (opcional)</label>
          <input type="date" style={inputStyle}
            value={formEvento.fecha_fin}
            onChange={e => setFormEvento(p => ({...p, fecha_fin: e.target.value}))} />
        </div>
      </div>

      <label style={labelStyle}>Color</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {COLORES.map(c => (
          <div key={c}
            onClick={() => setFormEvento(p => ({...p, color: c}))}
            style={{
              width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
              border: formEvento.color === c ? '3px solid #1f2937' : '2px solid transparent',
            }} />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancelar} style={btnAccionStyle('#94a3b8')} disabled={guardando}>
          Cancelar
        </button>
        <button type="button" onClick={onGuardar} disabled={guardando}
          style={{ ...btnAccionStyle('#f472b6'), opacity: guardando ? 0.6 : 1 }}>
          {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear evento'}
        </button>
      </div>
    </Overlay>
  );
}
