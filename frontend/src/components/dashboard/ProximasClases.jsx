// src/components/dashboard/ProximasClases.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import './ProximasClases.css';

const calcularRestante = (fecha) => {
  const ahora = new Date();
  const clase = parseFechaFlexible(fecha) || new Date(fecha);
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

const esFutura = (fecha) => {
  if (!fecha) return false;
  const tieneHora = /[T\s]/.test(fecha);
  if (tieneHora) {
    const clase = new Date(fecha);
    return !Number.isNaN(clase.getTime()) && clase.getTime() > Date.now();
  }
  const [anio, mes, dia] = fecha.split('-').map(Number);
  if (!anio || !mes || !dia) return false;
  const finDelDia = new Date(anio, mes - 1, dia, 23, 59, 59, 999);
  return finDelDia.getTime() > Date.now();
};

const etiquetaCronograma = (tipo, numero) => {
  const base = tipo === 'examen' ? 'Examen' : tipo === 'recuperatorio' ? 'Recup.' : 'Clase';
  return `${base} ${numero}`.trim();
};

const sumarMes = (fecha) => new Date(fecha.getFullYear(), fecha.getMonth() + 1, 1);

const parseFechaFlexible = (fecha) => {
  if (!fecha) return null;
  if (/[T\s]/.test(fecha)) {
    const parsed = new Date(fecha);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const [anio, mes, dia] = fecha.split('-').map(Number);
  if (!anio || !mes || !dia) return null;
  return new Date(anio, mes - 1, dia, 12, 0, 0, 0);
};

const minutosDesdeMedianoche = (hora) => {
  if (!hora) return null;
  const [hh, mm] = hora.split(':').map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
};

const duracionEnMinutos = (valor) => {
  if (!valor) return 60;
  const match = String(valor).match(/\d+/);
  return match ? Math.max(15, parseInt(match[0], 10)) : 60;
};

const rangoDeItem = (item) => {
  const fechaBase = item.fecha_programada || item.fecha;
  if (!fechaBase) return null;

  if (/[T\s]/.test(fechaBase)) {
    const inicio = new Date(fechaBase);
    if (Number.isNaN(inicio.getTime())) return null;
    const duracion = duracionEnMinutos(item.duracion || item.planificacion?.duracion);
    return { inicio, fin: new Date(inicio.getTime() + duracion * 60000) };
  }

  const inicioMin = minutosDesdeMedianoche(item.hora_inicio);
  const finMin = minutosDesdeMedianoche(item.hora_fin);
  if (inicioMin !== null && finMin !== null) {
    const [anio, mes, dia] = fechaBase.split('-').map(Number);
    const inicio = new Date(anio, mes - 1, dia, Math.floor(inicioMin / 60), inicioMin % 60, 0, 0);
    const fin = new Date(anio, mes - 1, dia, Math.floor(finMin / 60), finMin % 60, 0, 0);
    return { inicio, fin };
  }

  const inicio = parseFechaFlexible(fechaBase);
  if (!inicio) return null;
  const fin = new Date(inicio.getTime() + 60 * 60000);
  return { inicio, fin };
};

const solapan = (a, b) => a && b && a.inicio < b.fin && b.inicio < a.fin;

const normalizarItemCalendario = (item) => {
  const fechaBase = item.fecha_programada || item.fecha;
  const rango = rangoDeItem(item);
  return { ...item, fechaBase, rango };
};

const parseFechaSalida = (fecha) => parseFechaFlexible(fecha) || new Date(fecha);

const detectarConflicto = (clase, itemsCalendario) => {
  const rangoClase = rangoDeItem(clase);
  if (!rangoClase) return null;

  for (const item of itemsCalendario) {
    if (item.id === clase.id || item.id_evento === clase.id_evento) continue;
    const rangoItem = item.rango || rangoDeItem(item);
    if (!rangoItem) continue;

    const mismaFecha = (item.fechaBase || '').slice(0, 10) === (clase.fecha_programada || clase.fecha || '').slice(0, 10);
    if (mismaFecha && solapan(rangoClase, rangoItem)) {
      const etiqueta = item.tipo === 'evento' ? 'otro evento' : item.tipo === 'recuperatorio' ? 'otro recuperatorio' : item.tipo === 'examen' ? 'otro examen' : 'otra clase';
      return `Se cruza con ${etiqueta}`;
    }
  }

  return null;
};

const ProximasClases = () => {
  const { user } = useAuth();
  const [clases, setClases]     = useState([]);
  const [cargando, setCargando] = useState(true);
  const [, setTick]             = useState(0);
  const [seleccionada, setSeleccionada] = useState(null);
  const [, setItemsCalendario] = useState([]);

  const userId = user?.id || user?.id_docente || user?.user?.id;

  useEffect(() => {
    const cargar = async () => {
      if (!userId) {
        setCargando(false);
        return;
      }
      try {
        const hoy = new Date();
        const mesActual = hoy.getMonth() + 1;
        const anioActual = hoy.getFullYear();
        const siguienteMes = sumarMes(hoy);

        const [resProximas, resCalendarioActual, resCalendarioSiguiente] = await Promise.all([
          api.get(`/generar/planificacion/proximas/${userId}?dias=30`),
          api.get(`/calendario/mes/${userId}/${anioActual}/${mesActual}`),
          api.get(`/calendario/mes/${userId}/${siguienteMes.getFullYear()}/${siguienteMes.getMonth() + 1}`),
        ]);

        const calendarioActual = resCalendarioActual.data || {};
        const calendarioSiguiente = resCalendarioSiguiente.data || {};
        const calendario = [
          ...(calendarioActual.eventos || []).map(normalizarItemCalendario),
          ...(calendarioActual.cronograma || []).map(normalizarItemCalendario),
          ...(calendarioSiguiente.eventos || []).map(normalizarItemCalendario),
          ...(calendarioSiguiente.cronograma || []).map(normalizarItemCalendario),
        ];
        setItemsCalendario(calendario);

        const ahora = Date.now();
        const proximas = (resProximas.data || [])
          .filter(c => {
            const fecha = c.fecha_programada || c.fecha;
            if (!fecha) return false;
            if (/[T\s]/.test(fecha)) {
              const clase = new Date(fecha);
              return !Number.isNaN(clase.getTime()) && clase.getTime() > ahora;
            }
            const clase = parseFechaSalida(fecha);
            if (!clase || Number.isNaN(clase.getTime())) return false;
            const finDelDia = new Date(clase.getFullYear(), clase.getMonth(), clase.getDate(), 23, 59, 59, 999);
            return finDelDia.getTime() > ahora;
          })
          .sort((a, b) => parseFechaSalida(a.fecha_programada || a.fecha) - parseFechaSalida(b.fecha_programada || b.fecha));
        setClases(proximas
          .map(c => ({ ...c, conflicto: detectarConflicto(c, calendario) }))
          .sort((a, b) => parseFechaSalida(a.fecha_programada || a.fecha) - parseFechaSalida(b.fecha_programada || b.fecha)));
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

  const fechaCompleta = (f) => (parseFechaFlexible(f) || new Date(f)).toLocaleString('es-AR', {
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
            const fecha = c.fecha_programada || c.fecha;
            const r = calcularRestante(fecha);
            return (
              <div
                key={c.id}
                className={`proxima-card ${r.urgente ? 'urgente' : ''} ${r.vencido ? 'vencida' : ''}`}
                onClick={() => setSeleccionada(c)}
                style={{ cursor: 'pointer' }}
                title="Ver detalles"
              >
                <div className="proxima-nombre">{etiquetaCronograma(c.tipo, c.numero)}</div>
                <div className="proxima-fecha">
                  📅 {(parseFechaFlexible(fecha) || new Date(fecha)).toLocaleString('es-AR', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                  })}
                </div>
                {c.conflicto && (
                  <div className="proxima-fecha" style={{ color: '#b45309', fontWeight: 'bold' }}>
                    ⚠️ {c.conflicto}
                  </div>
                )}
                <div className="proxima-fecha" style={{ opacity: 0.85 }}>
                  {c.planificacion?.nombre_clase || c.tema_clase || 'Sin detalle de planificación'}
                </div>
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
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)',
            zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px', overflowY: 'auto'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: 18, padding: '24px 24px 20px',
              width: 'min(720px, 100%)', maxWidth: 720, maxHeight: 'min(84vh, 760px)', overflowY: 'auto',
              minWidth: 'min(320px, 100%)', fontFamily: "'Indie Flower', cursive",
              position: 'relative', boxSizing: 'border-box'
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
              📚 {etiquetaCronograma(seleccionada.tipo, seleccionada.numero)}
            </h2>

            <div style={{ background: '#fef3c7', padding: 16, borderRadius: 10, marginBottom: 16 }}>
              <p style={{ margin: '4px 0', fontSize: '1.1rem' }}>
                <b>📅 Fecha:</b> {fechaCompleta(seleccionada.fecha_programada || seleccionada.fecha)}
              </p>
              {(seleccionada.duracion || seleccionada.planificacion?.duracion) && (
                <p style={{ margin: '4px 0', fontSize: '1.1rem' }}>
                  <b>⏱ Duración:</b> {seleccionada.duracion || seleccionada.planificacion?.duracion}
                </p>
              )}
              <p style={{ margin: '4px 0', fontSize: '1.1rem', color: '#be185d' }}>
                <b>⏰ {calcularRestante(seleccionada.fecha_programada || seleccionada.fecha).texto}</b>
              </p>
            </div>

            {(seleccionada.tema_clase || seleccionada.tema || seleccionada.planificacion?.tema) && (
              <div style={{ marginBottom: 16 }}>
                <b style={{ fontSize: '1.1rem' }}>📌 Tema:</b>
                <p style={{ margin: '4px 0', color: '#475569', fontSize: '1.05rem' }}>
                  {seleccionada.tema_clase || seleccionada.tema || seleccionada.planificacion?.tema}
                </p>
              </div>
            )}

            {seleccionada.planificacion?.nombre_clase && (
              <div style={{ marginBottom: 16 }}>
                <b style={{ fontSize: '1.1rem' }}>📚 Planificación:</b>
                <p style={{ margin: '4px 0', color: '#475569', fontSize: '1.05rem' }}>
                  {seleccionada.planificacion.nombre_clase}
                </p>
              </div>
            )}

            {seleccionada.url_archivo && (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24, flexWrap: 'wrap' }}>
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
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProximasClases;