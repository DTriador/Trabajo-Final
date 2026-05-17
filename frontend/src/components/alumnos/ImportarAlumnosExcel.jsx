// src/components/alumnos/ImportarAlumnosExcel.jsx
import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import api from '../../api/axios';

/**
 * Botón para importar alumnos desde un archivo Excel o CSV.
 *
 * El Excel debe tener columnas: nombre | apellido | email
 * (el orden no importa, usa la primera fila como cabecera)
 *
 * Props:
 *   idDocente  — string UUID del docente
 *   idCurso    — string UUID del curso (opcional)
 *   onImportado — callback que se llama al terminar (para recargar la lista)
 */
export default function ImportarAlumnosExcel({ idDocente, idCurso, onImportado }) {
  const inputRef              = useRef(null);
  const [preview, setPreview] = useState(null);   // { filas, errores }
  const [enviando, setEnviando] = useState(false);

  const handleArchivo = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb   = XLSX.read(ev.target.result, { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (rows.length === 0) {
          alert('El archivo está vacío.');
          return;
        }

        // Normalizar claves (minúsculas, sin tildes)
        const normalizar = (s) =>
          String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

        const filas = rows.map((row, i) => {
          const claves = Object.keys(row);
          const get = (...posibles) => {
            for (const p of posibles) {
              const match = claves.find(k => normalizar(k) === p);
              if (match) return String(row[match]).trim();
            }
            return '';
          };
          return {
            numero:   i + 1,
            nombre:   get('nombre', 'name', 'first name', 'primer nombre'),
            apellido: get('apellido', 'apellidos', 'last name', 'surname'),
            email:    get('email', 'mail', 'correo', 'e-mail'),
          };
        });

        const conError = filas.filter(f => !f.nombre || !f.email);
        setPreview({ filas, errores: conError });
      } catch (err) {
        alert(`No se pudo leer el archivo: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
    // Resetear input para poder subir el mismo archivo de nuevo
    e.target.value = '';
  };

  const handleImportar = async () => {
    if (!preview) return;
    const validas = preview.filas.filter(f => f.nombre && f.email);
    if (validas.length === 0) {
      alert('No hay filas válidas para importar (nombre y email son obligatorios).');
      return;
    }

    // Convertir a CSV y enviar al endpoint existente
    setEnviando(true);
    try {
      const csvHeader = 'nombre,apellido,email\n';
      const csvBody   = validas
        .map(f => `${f.nombre},${f.apellido},${f.email}`)
        .join('\n');
      const blob = new Blob([csvHeader + csvBody], { type: 'text/csv' });
      const fd   = new FormData();
      fd.append('id_docente', idDocente);
      if (idCurso) fd.append('id_curso', idCurso);
      fd.append('file', blob, 'alumnos.csv');

      const res = await api.post('/alumnos/importar-csv', fd, {
        headers: { 'Content-Type': undefined },
      });

      const { creados, errores } = res.data;
      alert(
        `✅ ${creados} alumno(s) importado(s).` +
        (errores?.length ? `\n⚠ ${errores.length} error(es):\n${errores.join('\n')}` : '')
      );
      setPreview(null);
      onImportado?.();
    } catch (err) {
      alert(`❌ Error al importar: ${err.response?.data?.detail || err.message}`);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div>
      {/* Botón disparador */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        style={{
          background: 'white', color: '#1e5c3a',
          border: '2px solid #1e5c3a', borderRadius: 20,
          padding: '8px 18px', cursor: 'pointer',
          fontFamily: "'Indie Flower', cursive", fontWeight: 'bold',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}
      >
        📂 Importar desde Excel
      </button>
      <input
        ref={inputRef} type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
        onChange={handleArchivo}
      />

      {/* Vista previa antes de confirmar */}
      {preview && (
        <div style={{
          marginTop: 14, background: 'rgba(255,255,255,0.85)',
          border: '1.5px solid #a7f3d0', borderRadius: 12, padding: 16,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontWeight: 'bold', color: '#1e5c3a', fontSize: '0.95rem' }}>
              Vista previa — {preview.filas.length} fila(s) encontradas
            </span>
            <button
              type="button"
              onClick={() => setPreview(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1rem' }}
            >✕</button>
          </div>

          {/* Aviso de filas con error */}
          {preview.errores.length > 0 && (
            <div style={{
              background: '#fef3c7', border: '1px solid #fcd34d',
              borderRadius: 8, padding: '8px 12px', marginBottom: 10,
              fontSize: '0.83rem', color: '#92400e',
            }}>
              ⚠ {preview.errores.length} fila(s) sin nombre o email serán ignoradas.
            </div>
          )}

          {/* Tabla de preview (máx 8 filas) */}
          <div style={{ overflowX: 'auto', maxHeight: 220, overflowY: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  {['#', 'Nombre', 'Apellido', 'Email', ''].map(h => (
                    <th key={h} style={{
                      background: '#1e5c3a', color: 'white',
                      padding: '6px 10px', textAlign: 'left',
                      position: 'sticky', top: 0,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.filas.map((f, i) => {
                  const valida = f.nombre && f.email;
                  return (
                    <tr key={i} style={{ background: valida ? (i % 2 ? '#f0fdf4' : 'white') : '#fef2f2' }}>
                      <td style={{ padding: '5px 10px', color: '#9ca3af' }}>{f.numero}</td>
                      <td style={{ padding: '5px 10px' }}>{f.nombre || <span style={{ color: '#dc2626' }}>—</span>}</td>
                      <td style={{ padding: '5px 10px', color: '#6b7280' }}>{f.apellido}</td>
                      <td style={{ padding: '5px 10px' }}>{f.email || <span style={{ color: '#dc2626' }}>—</span>}</td>
                      <td style={{ padding: '5px 10px' }}>
                        {valida ? '✅' : <span style={{ color: '#dc2626' }}>✗</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Botones */}
          <div style={{ display: 'flex', gap: 10, marginTop: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setPreview(null)}
              style={{
                padding: '8px 18px', borderRadius: 20,
                border: '1.5px solid #cbd5e1', background: 'white',
                cursor: 'pointer', color: '#6b7280', fontWeight: 'bold',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleImportar}
              disabled={enviando || preview.filas.filter(f => f.nombre && f.email).length === 0}
              style={{
                padding: '8px 22px', borderRadius: 20, border: 'none',
                background: '#1e5c3a', color: 'white',
                cursor: 'pointer', fontWeight: 'bold',
                opacity: enviando ? 0.6 : 1,
              }}
            >
              {enviando ? 'Importando...' : `Importar ${preview.filas.filter(f => f.nombre && f.email).length} alumnos`}
            </button>
          </div>
        </div>
      )}

      {/* Ayuda de formato */}
      <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 6 }}>
        El archivo debe tener columnas: <strong>nombre</strong>, <strong>apellido</strong>, <strong>email</strong> (primera fila = cabecera).
      </p>
    </div>
  );
}