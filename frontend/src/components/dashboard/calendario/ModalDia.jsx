// src/components/dashboard/calendario/ModalDia.jsx
import React from 'react';
import Overlay from './Overlay';
import {
  formatFechaLarga, tipoCronogramaEtiqueta, tipoCronogramaColor,
  btnAccionStyle, modalTitulo,
} from './calendarioHelpers';

export default function ModalDia({
  modalDia, onClose,
  onEditarEvento, onReplanificarEvento, onEliminarEvento,
  onVerCronograma, onSeleccionarClase,
}) {
  if (!modalDia) return null;
  const { iso, evs, plans, fers, cronograma } = modalDia;

  return (
    <Overlay onClose={onClose}>
      <h3 style={modalTitulo}>
        📅 {formatFechaLarga(iso).replace(/^\w/, l => l.toUpperCase())}
      </h3>

      {/* Sin eventos */}
      {evs.length === 0 && plans.length === 0 && fers.length === 0 && cronograma.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: '1.1rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📭</div>
          Sin eventos para este día
        </div>
      )}

      {/* Feriados */}
      {fers.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 'bold', color: '#fb923c', marginBottom: 6, fontSize: '0.95rem' }}>
            🏖 Feriado / Vacaciones
          </div>
          {fers.map((f, i) => (
            <div key={i} style={{
              background: '#ffedd5', borderRadius: 10,
              padding: '10px 14px', marginBottom: 6, fontSize: '1rem',
            }}>
              <b>{f.nombre}</b>
              {f.tipo && <span style={{ color: '#999', marginLeft: 8, fontSize: '0.85rem' }}>({f.tipo})</span>}
            </div>
          ))}
        </div>
      )}

      {/* Eventos recurrentes */}
      {evs.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 'bold', color: '#374151', marginBottom: 6, fontSize: '0.95rem' }}>
            🕐 Eventos
          </div>
          {evs.map((ev, i) => (
            <div key={i} style={{
              background: ev.color + '22',
              border: `2px solid ${ev.color}`,
              borderRadius: 10, padding: '10px 14px', marginBottom: 8,
            }}>
              <div style={{ fontWeight: 'bold', color: '#1f2937', fontSize: '1.05rem' }}>
                {ev.titulo}
                {ev.replanificado && <span style={{ color: '#fb923c', marginLeft: 6, fontSize: '0.85rem' }}>🔄 Replanificado</span>}
              </div>
              <div style={{ color: '#555', fontSize: '0.9rem', marginTop: 4 }}>
                🕐 {ev.hora_inicio?.slice(0,5)} – {ev.hora_fin?.slice(0,5)}
                {ev.materia && <span style={{ marginLeft: 10 }}>📚 {ev.materia}</span>}
                {ev.nombre_escuela && <span style={{ marginLeft: 10 }}>🏫 {ev.nombre_escuela}</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => onEditarEvento(ev)} style={btnAccionStyle('#818cf8')}>
                  ✏️ Editar serie
                </button>
                <button type="button" onClick={() => onReplanificarEvento(ev)} style={btnAccionStyle('#fb923c')}>
                  🔄 Replanificar este día
                </button>
                <button type="button" onClick={() => onEliminarEvento(ev.id_evento)} style={btnAccionStyle('#f87171')}>
                  🗑 Eliminar serie
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Planificaciones */}
      {plans.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 'bold', color: '#374151', marginBottom: 6, fontSize: '0.95rem' }}>
            📋 Clases planificadas
          </div>
          {plans.map((p, i) => (
            <div key={i} style={{
              background: '#ede9fe', border: '2px solid #818cf8',
              borderRadius: 10, padding: '10px 14px', marginBottom: 8,
            }}>
              <div style={{ fontWeight: 'bold', color: '#1f2937', fontSize: '1.05rem' }}>
                {p.nombre_clase}
              </div>
              {p.tema && <div style={{ color: '#555', fontSize: '0.9rem', marginTop: 2 }}>Tema: {p.tema}</div>}
              {p.duracion && <div style={{ color: '#555', fontSize: '0.9rem' }}>Duración: {p.duracion}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button type="button" onClick={() => onVerCronograma(p.id_planificacion)} style={btnAccionStyle('#818cf8')}>
                  📋 Ver cronograma
                </button>
                {p.url_archivo && (
                  <a href={p.url_archivo} target="_blank" rel="noreferrer"
                    style={{ ...btnAccionStyle('#34d399'), textDecoration: 'none', display: 'inline-block' }}>
                    📄 Ver planificación
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cronograma del día (clases puntuales) */}
      {cronograma.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 'bold', color: '#374151', marginBottom: 6, fontSize: '0.95rem' }}>
            📅 Cronograma del día
          </div>
          {cronograma.map((c, i) => (
            <div key={i}
              onClick={() => onSeleccionarClase(c)}
              style={{
                background: `${tipoCronogramaColor(c.tipo)}22`,
                border: `2px solid ${tipoCronogramaColor(c.tipo)}`,
                borderRadius: 10, padding: '10px 14px', marginBottom: 8,
                cursor: 'pointer',
              }}>
              <div style={{ fontWeight: 'bold', color: '#1f2937', fontSize: '1.05rem' }}>
                {tipoCronogramaEtiqueta(c.tipo, c.numero)}
              </div>
              <div style={{ color: '#555', fontSize: '0.9rem', marginTop: 4 }}>
                {c.nombre_plan && <span style={{ marginRight: 10 }}>📚 {c.nombre_plan}</span>}
                {c.tema_clase && <span>📌 {c.tema_clase}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <button type="button" onClick={onClose} style={btnAccionStyle('#94a3b8')}>
          Cerrar
        </button>
      </div>
    </Overlay>
  );
}
