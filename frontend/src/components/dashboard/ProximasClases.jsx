// src/components/dashboard/ProximasClases.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import './ProximasClases.css';

const calcularRestante = (fecha) => {
  const ahora = new Date();
  const clase = new Date(fecha);
  const diff = clase - ahora;

  if (diff < 0) return { texto: 'Ya pasó', urgente: false, vencido: true };

  const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
  const horas = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutos = Math.floor((diff / (1000 * 60)) % 60);

  let texto = '';
  if (dias > 0) texto = `Falta${dias > 1 ? 'n' : ''} ${dias} día${dias > 1 ? 's' : ''}`;
  else if (horas > 0) texto = `Falta${horas > 1 ? 'n' : ''} ${horas}h ${minutos}m`;
  else texto = `¡Faltan ${minutos} min!`;

  return { texto, urgente: dias === 0 && horas < 3, vencido: false };
};

const ProximasClases = () => {
  const { user } = useAuth();
  const [clases, setClases]     = useState([]);
  const [cargando, setCargando] = useState(true);
  const [, setTick]             = useState(0);
  const [seleccionada, setSeleccionada] = useState(null);

  const userId = user?.id || user?.id_docente || user?.user?.id;

  useEffect(() => {
    const cargar = async () => {
      if (!userId) return;
      try {
        const res = await api.get(`/generar/planificacion/proximas/${userId}?dias=30`);
        setClases(res.data || []);
      } catch (e) {
        console.error("Error cargando próximas clases:", e);
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, [userId]);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  if (cargando) return null;

  const fechaCompleta = (f) => new Date(f).toLocaleString('es-AR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="proximas-container">
      <h3 className="proximas-title">📅 Próximas clases</h3>
      {clases.length === 0 ? (
        <p className="proximas-vacio">No tenés clases programadas. ¡Agregá una desde Herramientas!</p>
      ) : (
        <div className="proximas-lista">
          {clases.slice(0, 2).map(c => {
            const r = calcularRestante(c.fecha);
            const fechaFmt = new Date(c.fecha).toLocaleString('es-AR', {
              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
            });
            return (
              <div
                key={c.id_planificacion}
                className={`proxima-card ${r.urgente ? 'urgente' : ''} ${r.vencido ? 'vencida' : ''}`}
                onClick={() => setSeleccionada(c)}
                style={{ cursor: 'pointer' }}
                title="Ver detalles"
              >
                <div className="proxima-nombre">{c.nombre_clase}</div>
                <div className="proxima-fecha">📅 {fechaFmt}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE DETALLES */}
      {seleccionada && (
        <div
          onClick={() => setSeleccionada(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: 16, padding: 30,
              width: '90%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto',
              fontFamily: "'Indie Flower', cursive",
              position: 'relative',
            }}
          >
            {/* ✕ Cerrar — esquina superior derecha */}
            <button
              onClick={() => setSeleccionada(null)}
              style={{
                position: 'absolute', top: 14, right: 16,
                background: 'none', border: 'none',
                fontSize: '1.6rem', cursor: 'pointer',
                color: '#94a3b8', lineHeight: 1,
                padding: 4,
              }}
              title="Cerrar"
            >
              ✕
            </button>

            <h2 style={{ color: '#be185d', marginTop: 0, fontSize: '2rem', paddingRight: 36 }}>
              📚 {seleccionada.nombre_clase}
            </h2>

            <div style={{ background: '#fef3c7', padding: 16, borderRadius: 10, marginBottom: 16 }}>
              <p style={{ margin: '4px 0', fontSize: '1.1rem' }}>
                <b>📅 Fecha:</b> {fechaCompleta(seleccionada.fecha)}
              </p>
              {seleccionada.duracion && (
                <p style={{ margin: '4px 0', fontSize: '1.1rem' }}>
                  <b>⏱ Duración:</b> {seleccionada.duracion}
                </p>
              )}
              <p style={{ margin: '4px 0', fontSize: '1.1rem', color: '#be185d' }}>
                <b>⏰ {calcularRestante(seleccionada.fecha).texto}</b>
              </p>
            </div>

            {seleccionada.tema && (
              <div style={{ marginBottom: 16 }}>
                <b style={{ fontSize: '1.1rem' }}>📌 Tema:</b>
                <p style={{ margin: '4px 0', color: '#475569', fontSize: '1.05rem' }}>
                  {seleccionada.tema}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24, flexWrap: 'wrap' }}>
              {seleccionada.url_archivo && (
                <a
                  href={seleccionada.url_archivo}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: '10px 20px', background: '#22c55e', color: 'white',
                    border: 'none', borderRadius: 8, textDecoration: 'none', fontWeight: 'bold'
                  }}
                >
                  ⬇ Descargar planificación
                </a>
              )}
              <button
                onClick={() => setSeleccionada(null)}
                style={{
                  padding: '10px 20px', background: '#e5e7eb', border: 'none',
                  borderRadius: 8, cursor: 'pointer', fontWeight: 'bold'
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProximasClases;