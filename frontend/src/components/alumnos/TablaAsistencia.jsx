// src/components/alumnos/TablaAsistencia.jsx
import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import api from '../../api/axios';

const COLOR_ESTADO = {
  P:   { bg: '#166534', text: 'white' },
  A:   { bg: '#dc2626', text: 'white' },
  '-': { bg: 'white',   text: '#9ca3af' },
};
const ESTADOS_CICLO = ['-', 'P', 'A'];

const TH = {
  background: '#1e5c3a', color: 'white',
  padding: '10px 10px', fontWeight: 'bold', fontSize: '0.88rem',
  whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.15)',
  fontFamily: "'Indie Flower', cursive", textAlign: 'center',
};
const TD = {
  padding: '6px 8px', borderBottom: '1px solid #e5e7eb',
  borderRight: '1px solid #f3f4f6', fontSize: '0.92rem',
  fontFamily: "'Indie Flower', cursive", textAlign: 'center', background: 'white',
};

export default function TablaAsistencia({ alumnos, idDocente }) {
  const [fechas,     setFechas]     = useState([]);
  const [asistencia, setAsistencia] = useState({});
  const [cargando,   setCargando]   = useState(true);
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [agregando,  setAgregando]  = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res       = await api.get(`/alumnos/asistencia/${idDocente}`);
      const registros = res.data || [];
      const setF      = new Set(registros.map(r => r.fecha));
      setFechas(Array.from(setF).sort());
      const agrupado = {};
      for (const r of registros) {
        if (!agrupado[r.id_alumno]) agrupado[r.id_alumno] = {};
        agrupado[r.id_alumno][r.fecha] = r.estado;
      }
      setAsistencia(agrupado);
    } catch (e) {
      console.error('Error cargando asistencia:', e);
    } finally {
      setCargando(false);
    }
  }, [idDocente]);

  useEffect(() => { cargar(); }, [cargar]);

  const handleAgregarFecha = async () => {
    if (!nuevaFecha) return;
    if (fechas.includes(nuevaFecha)) { alert('Esa fecha ya existe.'); return; }
    setAgregando(true);
    try {
      const fd = new FormData();
      fd.append('id_docente', idDocente);
      fd.append('fecha', nuevaFecha);
      await api.post('/alumnos/asistencia/fecha', fd, { headers: { 'Content-Type': undefined } });
      setFechas(prev => [...prev, nuevaFecha].sort());
      setAsistencia(prev => {
        const next = { ...prev };
        for (const a of alumnos) {
          next[a.id_alumno] = { ...(next[a.id_alumno] || {}), [nuevaFecha]: '-' };
        }
        return next;
      });
      setNuevaFecha('');
    } catch (e) {
      alert(`Error: ${e.response?.data?.detail || e.message}`);
    } finally {
      setAgregando(false);
    }
  };

  const handleEliminarFecha = async (fecha) => {
    if (!window.confirm(`¿Eliminar la columna del ${formatFecha(fecha)}?`)) return;
    try {
      await api.delete(`/alumnos/asistencia/fecha/${idDocente}/${fecha}`);
      setFechas(prev => prev.filter(f => f !== fecha));
      setAsistencia(prev => {
        const next = { ...prev };
        for (const aid in next) {
          const { [fecha]: _, ...rest } = next[aid];
          next[aid] = rest;
        }
        return next;
      });
    } catch (e) {
      alert(`Error: ${e.response?.data?.detail || e.message}`);
    }
  };

  const handleCicloEstado = async (idAlumno, fecha) => {
    const actual = asistencia[idAlumno]?.[fecha] ?? '-';
    const idx    = ESTADOS_CICLO.indexOf(actual);
    const nuevo  = ESTADOS_CICLO[(idx + 1) % ESTADOS_CICLO.length];
    setAsistencia(prev => ({
      ...prev,
      [idAlumno]: { ...(prev[idAlumno] || {}), [fecha]: nuevo },
    }));
    try {
      await api.put('/alumnos/asistencia/registro', {
        id_alumno: idAlumno, id_docente: idDocente, fecha, estado: nuevo,
      });
    } catch (e) {
      console.error('Error guardando asistencia:', e);
      setAsistencia(prev => ({
        ...prev,
        [idAlumno]: { ...(prev[idAlumno] || {}), [fecha]: actual },
      }));
    }
  };

  const formatFecha = (iso) => {
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
  };

  const resumen = (idAlumno) => {
    const reg = asistencia[idAlumno] || {};
    const p   = Object.values(reg).filter(v => v === 'P').length;
    const a   = Object.values(reg).filter(v => v === 'A').length;
    if (!p && !a) return '-';
    return `${p}P / ${a}A`;
  };

  // ── Exportar a Excel ────────────────────────────────────────────────────────
  const exportarExcel = () => {
    const encabezados = ['Alumno', ...fechas.map(formatFecha), 'Resumen'];
    const filas = alumnos.map(a => {
      const nombre = a.apellido ? `${a.apellido}, ${a.nombre}` : a.nombre;
      const celdas = fechas.map(f => asistencia[a.id_alumno]?.[f] ?? '-');
      const reg    = asistencia[a.id_alumno] || {};
      const p      = Object.values(reg).filter(v => v === 'P').length;
      const aus    = Object.values(reg).filter(v => v === 'A').length;
      const sum    = (p + aus) ? `${p}P / ${aus}A` : '-';
      return [nombre, ...celdas, sum];
    });
    const ws = XLSX.utils.aoa_to_sheet([encabezados, ...filas]);
    ws['!cols'] = [{ wch: 28 }, ...fechas.map(() => ({ wch: 7 })), { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Asistencia');
    XLSX.writeFile(wb, `asistencia_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (cargando) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>Cargando asistencia...</div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Barra superior */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="date" value={nuevaFecha}
            onChange={e => setNuevaFecha(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.7)', border: '2px solid #1e5c3a',
              borderRadius: 10, padding: '8px 12px', fontSize: '0.95rem',
              fontFamily: "'Indie Flower', cursive", outline: 'none',
            }}
          />
          <button
            onClick={handleAgregarFecha}
            disabled={agregando || !nuevaFecha}
            style={{
              background: '#1e5c3a', color: 'white', border: 'none',
              borderRadius: 20, padding: '8px 20px', cursor: 'pointer',
              fontFamily: "'Indie Flower', cursive", fontWeight: 'bold',
              opacity: (!nuevaFecha || agregando) ? 0.5 : 1,
            }}
          >
            + Agregar columna
          </button>
        </div>

        {fechas.length > 0 && (
          <button
            onClick={exportarExcel}
            style={{
              background: 'white', color: '#1e5c3a',
              border: '2px solid #1e5c3a', borderRadius: 20,
              padding: '8px 18px', cursor: 'pointer',
              fontFamily: "'Indie Flower', cursive", fontWeight: 'bold',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            📥 Exportar Excel
          </button>
        )}
      </div>

      {/* Tabla */}
      <div style={{ overflowX: 'auto', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 300 }}>
          <thead>
            <tr>
              <th style={{ ...TH, minWidth: 140, textAlign: 'left', position: 'sticky', left: 0, zIndex: 2 }}>
                Alumno
              </th>
              {fechas.map(f => (
                <th key={f} style={{ ...TH, minWidth: 72 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <span>{formatFecha(f)}</span>
                    <button
                      onClick={() => handleEliminarFecha(f)}
                      title="Eliminar esta fecha"
                      style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '0.75rem', lineHeight: 1 }}
                    >✕</button>
                  </div>
                </th>
              ))}
              <th style={{ ...TH, background: '#2d7a4f', minWidth: 110, opacity: 0.7 }}>
                Agregar columna ↑
              </th>
              <th style={{ ...TH, background: '#155234', minWidth: 100 }}>Resumen</th>
            </tr>
          </thead>
          <tbody>
            {alumnos.length === 0 ? (
              <tr>
                <td colSpan={fechas.length + 3} style={{ ...TD, color: '#9ca3af', padding: 32 }}>
                  No hay alumnos cargados todavía.
                </td>
              </tr>
            ) : (
              alumnos.map((a, i) => (
                <tr key={a.id_alumno}>
                  <td style={{ ...TD, textAlign: 'left', fontWeight: 'bold', background: i % 2 === 0 ? '#f0fdf4' : '#dcfce7', position: 'sticky', left: 0, zIndex: 1 }}>
                    {a.apellido ? `${a.apellido}, ${a.nombre}` : a.nombre}
                  </td>
                  {fechas.map(f => {
                    const estado = asistencia[a.id_alumno]?.[f] ?? '-';
                    const col    = COLOR_ESTADO[estado] || COLOR_ESTADO['-'];
                    return (
                      <td key={f} style={{ ...TD, padding: 4 }}>
                        <div
                          onClick={() => handleCicloEstado(a.id_alumno, f)}
                          title="Click para cambiar estado"
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 36, height: 30, borderRadius: 6,
                            background: col.bg, color: col.text,
                            fontWeight: 'bold', fontSize: '0.9rem',
                            cursor: 'pointer', userSelect: 'none',
                            border: estado === '-' ? '1px solid #d1d5db' : 'none',
                            transition: 'background 0.15s',
                          }}
                        >
                          {estado}
                        </div>
                      </td>
                    );
                  })}
                  <td style={{ ...TD, background: '#f9fafb' }} />
                  <td style={{ ...TD, fontWeight: 'bold', background: '#f0fdf4', color: '#166534' }}>
                    {resumen(a.id_alumno)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Leyenda */}
      <div style={{ display: 'flex', gap: 16, fontSize: '0.82rem', color: '#6b7280', alignItems: 'center' }}>
        <span>💡 Click en la celda para cambiar:</span>
        {[['P','#166534','Presente'],['A','#dc2626','Ausente'],['-','#9ca3af','Sin dato']].map(([e,c,l]) => (
          <span key={e} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ background: c, color: 'white', borderRadius: 4, padding: '1px 7px', fontWeight: 'bold', fontSize: '0.85rem' }}>{e}</span>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}