// src/components/alumnos/TablaCalificaciones.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';

// ── Helpers ───────────────────────────────────────────────────────────────────
const promedio = (notas, columnas, idAlumno) => {
  const vals = columnas
    .map(col => {
      const n = notas[idAlumno]?.[col.id];
      return n !== undefined && n !== '' && n !== '-' ? parseFloat(n) : NaN;
    })
    .filter(v => !isNaN(v));
  if (!vals.length) return '-';
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
};

// ── Estilos ───────────────────────────────────────────────────────────────────
const TH = {
  background: '#1e5c3a',
  color: 'white',
  padding: '10px 14px',
  fontWeight: 'bold',
  fontSize: '0.92rem',
  whiteSpace: 'nowrap',
  borderRight: '1px solid rgba(255,255,255,0.15)',
  fontFamily: "'Indie Flower', cursive",
};
const TD = {
  padding: '8px 10px',
  borderBottom: '1px solid #e5e7eb',
  borderRight: '1px solid #f3f4f6',
  fontSize: '0.95rem',
  fontFamily: "'Indie Flower', cursive",
  background: 'white',
};
const INPUT_NOTA = {
  width: '60px',
  border: 'none',
  borderBottom: '2px solid #d1d5db',
  background: 'transparent',
  textAlign: 'center',
  fontSize: '0.95rem',
  fontFamily: "'Indie Flower', cursive",
  outline: 'none',
  color: '#1f2937',
};

export default function TablaCalificaciones({ alumnos, idDocente }) {
  const [columnas, setColumnas]     = useState([]);
  const [notas, setNotas]           = useState({});  // { id_alumno: { id_columna: valor } }
  const [cargando, setCargando]     = useState(true);
  const [nuevaCol, setNuevaCol]     = useState('');
  const [agregando, setAgregando]   = useState(false);
  const [guardandoNota, setGuardandoNota] = useState(null); // id_columna guardándose

  // ── Carga inicial ─────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [colsRes, notasRes] = await Promise.all([
        api.get(`/alumnos/calificaciones/columnas/${idDocente}`),
        api.get(`/alumnos/calificaciones/notas/${idDocente}`),
      ]);

      setColumnas(colsRes.data || []);

      // Agrupar notas: { id_alumno: { id_columna: valor } }
      const agrupadas = {};
      for (const n of (notasRes.data || [])) {
        if (!agrupadas[n.id_alumno]) agrupadas[n.id_alumno] = {};
        agrupadas[n.id_alumno][n.id_columna] = n.valor ?? '';
      }
      setNotas(agrupadas);
    } catch (e) {
      console.error('Error cargando calificaciones:', e);
    } finally {
      setCargando(false);
    }
  }, [idDocente]);

  useEffect(() => { cargar(); }, [cargar]);

  // ── Agregar columna ───────────────────────────────────────────────────────
  const handleAgregarColumna = async () => {
    if (!nuevaCol.trim()) return;
    setAgregando(true);
    try {
      const res = await api.post('/alumnos/calificaciones/columnas', {
        id_docente: idDocente,
        nombre:     nuevaCol.trim(),
        tipo:       'manual',
      });
      setColumnas(prev => [...prev, res.data]);
      setNuevaCol('');
    } catch (e) {
      alert(`Error: ${e.response?.data?.detail || e.message}`);
    } finally {
      setAgregando(false);
    }
  };

  // ── Eliminar columna ──────────────────────────────────────────────────────
  const handleEliminarColumna = async (col) => {
    if (!window.confirm(`¿Eliminar la columna "${col.nombre}" y todas sus notas?`)) return;
    try {
      await api.delete(`/alumnos/calificaciones/columnas/${col.id}`);
      setColumnas(prev => prev.filter(c => c.id !== col.id));
      // Limpiar notas locales de esa columna
      setNotas(prev => {
        const next = { ...prev };
        for (const aid in next) {
          const { [col.id]: _, ...rest } = next[aid];
          next[aid] = rest;
        }
        return next;
      });
    } catch (e) {
      alert(`Error: ${e.response?.data?.detail || e.message}`);
    }
  };

  // ── Cambiar nota local ────────────────────────────────────────────────────
  const handleCambioNota = (idAlumno, idColumna, valor) => {
    setNotas(prev => ({
      ...prev,
      [idAlumno]: { ...(prev[idAlumno] || {}), [idColumna]: valor },
    }));
  };

  // ── Guardar nota al salir del campo ──────────────────────────────────────
  const handleGuardarNota = async (idAlumno, idColumna) => {
    const valor = notas[idAlumno]?.[idColumna] ?? '';
    setGuardandoNota(`${idAlumno}-${idColumna}`);
    try {
      await api.put('/alumnos/calificaciones/nota', {
        id_alumno:  idAlumno,
        id_columna: idColumna,
        id_docente: idDocente,
        valor:      String(valor),
      });
    } catch (e) {
      console.error('Error guardando nota:', e);
    } finally {
      setGuardandoNota(null);
    }
  };

  if (cargando) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>Cargando calificaciones...</div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Barra: agregar columna */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Nueva columna (Ej: Examen 1, TP 2...)"
          value={nuevaCol}
          onChange={e => setNuevaCol(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAgregarColumna()}
          style={{
            flex: 1, minWidth: 200,
            background: 'rgba(255,255,255,0.7)',
            border: '2px solid #1e5c3a',
            borderRadius: 10, padding: '8px 12px',
            fontSize: '0.95rem', fontFamily: "'Indie Flower', cursive",
            outline: 'none',
          }}
        />
        <button
          onClick={handleAgregarColumna}
          disabled={agregando || !nuevaCol.trim()}
          style={{
            background: '#1e5c3a', color: 'white', border: 'none',
            borderRadius: 20, padding: '8px 20px', cursor: 'pointer',
            fontFamily: "'Indie Flower', cursive", fontWeight: 'bold',
            opacity: (!nuevaCol.trim() || agregando) ? 0.5 : 1,
          }}
        >
          + Agregar columna
        </button>
      </div>

      {/* Tabla */}
      <div style={{ overflowX: 'auto', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 400 }}>
          <thead>
            <tr>
              <th style={{ ...TH, minWidth: 140, position: 'sticky', left: 0, zIndex: 2 }}>Alumno</th>
              {columnas.map(col => (
                <th key={col.id} style={{ ...TH, minWidth: 110 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
                    <span>{col.nombre}</span>
                    <button
                      onClick={() => handleEliminarColumna(col)}
                      title="Eliminar columna"
                      style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '0.85rem', padding: '0 2px' }}
                    >✕</button>
                  </div>
                </th>
              ))}
              {/* Columna fantasma "Agregar columna" */}
              <th style={{ ...TH, background: '#2d7a4f', minWidth: 140, opacity: 0.7 }}>
                Agregar columna ↑
              </th>
              <th style={{ ...TH, background: '#155234', minWidth: 90 }}>Promedio</th>
            </tr>
          </thead>
          <tbody>
            {alumnos.length === 0 ? (
              <tr>
                <td colSpan={columnas.length + 3} style={{ ...TD, textAlign: 'center', color: '#9ca3af', padding: 32 }}>
                  No hay alumnos cargados todavía.
                </td>
              </tr>
            ) : (
              alumnos.map((a, i) => (
                <tr key={a.id_alumno} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb' }}>
                  {/* Nombre fijo */}
                  <td style={{ ...TD, fontWeight: 'bold', background: i % 2 === 0 ? '#f0fdf4' : '#dcfce7', position: 'sticky', left: 0, zIndex: 1 }}>
                    {a.apellido ? `${a.apellido}, ${a.nombre}` : a.nombre}
                  </td>

                  {/* Notas editables */}
                  {columnas.map(col => {
                    const key = `${a.id_alumno}-${col.id}`;
                    const guardando = guardandoNota === key;
                    return (
                      <td key={col.id} style={{ ...TD, textAlign: 'center' }}>
                        <input
                          type="text"
                          value={notas[a.id_alumno]?.[col.id] ?? ''}
                          onChange={e => handleCambioNota(a.id_alumno, col.id, e.target.value)}
                          onBlur={() => handleGuardarNota(a.id_alumno, col.id)}
                          style={{ ...INPUT_NOTA, opacity: guardando ? 0.5 : 1 }}
                          placeholder="-"
                        />
                      </td>
                    );
                  })}

                  {/* Celda vacía bajo "Agregar columna" */}
                  <td style={{ ...TD, background: '#f9fafb' }} />

                  {/* Promedio */}
                  <td style={{ ...TD, textAlign: 'center', fontWeight: 'bold', background: '#f0fdf4', color: '#166534' }}>
                    {promedio(notas, columnas, a.id_alumno)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: 0 }}>
        💡 Las notas se guardan automáticamente al salir de cada celda. El promedio ignora celdas vacías o con "-".
      </p>
    </div>
  );
}