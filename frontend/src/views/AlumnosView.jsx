// src/views/AlumnosView.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import TablaCalificaciones from '../components/alumnos/TablaCalificaciones';
import TablaAsistencia     from '../components/alumnos/TablaAsistencia';

// ── Estilos compartidos ───────────────────────────────────────────────────────
const BTN = {
  volver: {
    backgroundColor: '#e0f2fe', color: '#0c4a6e',
    border: '2px solid #38bdf8', borderRadius: '50px',
    padding: '6px 18px', cursor: 'pointer',
    fontFamily: "'Indie Flower', cursive", fontWeight: 'bold', fontSize: '1rem',
  },
  add: {
    backgroundColor: '#ff7eb9', color: 'white', border: 'none',
    borderRadius: '50px', padding: '8px 20px', cursor: 'pointer',
    fontFamily: "'Indie Flower', cursive", fontWeight: 'bold', fontSize: '1rem',
    boxShadow: '0 3px 8px rgba(255,126,185,0.4)', whiteSpace: 'nowrap',
  },
  csv: {
    backgroundColor: '#34d399', color: 'white', border: 'none',
    borderRadius: '50px', padding: '8px 20px', cursor: 'pointer',
    fontFamily: "'Indie Flower', cursive", fontWeight: 'bold', fontSize: '1rem',
    boxShadow: '0 3px 8px rgba(52,211,153,0.4)', whiteSpace: 'nowrap',
  },
  guardar: {
    backgroundColor: '#a78bfa', color: 'white', border: 'none',
    borderRadius: '50px', padding: '6px 18px', cursor: 'pointer',
    fontFamily: "'Indie Flower', cursive", fontWeight: 'bold', fontSize: '0.95rem',
    boxShadow: '0 3px 8px rgba(167,139,250,0.4)',
  },
  cancelarEdit: {
    backgroundColor: 'transparent', color: '#6b7280',
    border: '2px solid #d1d5db', borderRadius: '50px',
    padding: '6px 14px', cursor: 'pointer',
    fontFamily: "'Indie Flower', cursive", fontWeight: 'bold', fontSize: '0.95rem',
  },
  editar:   { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: '2px 6px' },
  eliminar: { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: '2px 6px' },
};

const INPUT_BASE = {
  background: 'rgba(255,255,255,0.7)',
  border: '2px solid rgba(167,139,250,0.5)', borderRadius: '8px',
  padding: '6px 10px', fontSize: '0.95rem',
  fontFamily: "'Indie Flower', cursive", outline: 'none',
  color: '#1f2937', width: '100%', boxSizing: 'border-box',
};

const INPUT_TOOLBAR = {
  flex: '1', background: 'rgba(255,255,255,0.6)',
  border: '2px solid rgba(180,83,9,0.25)', borderRadius: '12px',
  padding: '10px 14px', fontSize: '1rem',
  fontFamily: "'Indie Flower', cursive", outline: 'none',
  color: '#1f2937', minWidth: '200px',
};

// ── Pestañas disponibles ──────────────────────────────────────────────────────
const TABS = [
  { id: 'alumnos',          label: '👨‍🎓 Alumnos' },
  { id: 'calificaciones',   label: '📊 Calificaciones' },
  { id: 'asistencia',       label: '📅 Asistencia' },
];

// ── Componente principal ──────────────────────────────────────────────────────
const AlumnosView = ({ onVolver }) => {
  const { user } = useAuth();
  const [alumnos, setAlumnos]         = useState([]);
  const [cargando, setCargando]       = useState(true);
  const [busqueda, setBusqueda]       = useState('');
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nuevoAlumno, setNuevoAlumno] = useState({ nombre: '', apellido: '', email: '' });
  const [editandoId, setEditandoId]   = useState(null);
  const [editData, setEditData]       = useState({ nombre: '', apellido: '', email: '' });
  const [guardando, setGuardando]     = useState(false);
  const [tabActiva, setTabActiva]     = useState('alumnos');

  const userId = user?.id || user?.id_docente || user?.user?.id;

  const cargar = async () => {
    if (!userId) return;
    try {
      const res = await api.get(`/alumnos/${userId}`);
      setAlumnos(res.data || []);
    } catch (e) { console.error('Error cargando alumnos:', e); }
    finally { setCargando(false); }
  };

  useEffect(() => { cargar(); }, [userId]);

  const handleAgregar = async () => {
    if (!nuevoAlumno.nombre.trim() || !nuevoAlumno.email.trim()) {
      alert('Nombre y email son obligatorios'); return;
    }
    try {
      await api.post('/alumnos', { ...nuevoAlumno, id_docente: userId });
      setNuevoAlumno({ nombre: '', apellido: '', email: '' });
      setMostrarForm(false);
      cargar();
    } catch (e) { alert(`Error: ${e.response?.data?.detail || e.message}`); }
  };

  const iniciarEdicion = (alumno) => {
    setEditandoId(alumno.id_alumno);
    setEditData({ nombre: alumno.nombre, apellido: alumno.apellido || '', email: alumno.email });
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setEditData({ nombre: '', apellido: '', email: '' });
  };

  const guardarEdicion = async (id) => {
    if (!editData.nombre.trim() || !editData.email.trim()) {
      alert('Nombre y email son obligatorios'); return;
    }
    setGuardando(true);
    try {
      await api.put(`/alumnos/${id}`, {
        nombre:   editData.nombre.trim(),
        apellido: editData.apellido.trim(),
        email:    editData.email.trim(),
        id_docente: userId,
      });
      setAlumnos(prev => prev.map(a => a.id_alumno === id ? { ...a, ...editData } : a));
      cancelarEdicion();
    } catch (e) { alert(`Error al guardar: ${e.response?.data?.detail || e.message}`); }
    finally { setGuardando(false); }
  };

  const handleEliminar = async (id, nombre) => {
    if (!window.confirm(`¿Eliminar a ${nombre}?`)) return;
    try {
      await api.delete(`/alumnos/${id}`);
      setAlumnos(prev => prev.filter(a => a.id_alumno !== id));
      if (editandoId === id) cancelarEdicion();
    } catch (e) { alert(`Error: ${e.response?.data?.detail || e.message}`); }
  };

  const handleImportarCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!window.confirm(`¿Importar desde "${file.name}"?\n\nColumnas requeridas: nombre, apellido, email`)) return;
    try {
      const fd = new FormData();
      fd.append('id_docente', userId);
      fd.append('file', file);
      const res = await api.post('/alumnos/importar-csv', fd);
      alert(`✅ ${res.data.creados} alumnos importados${res.data.errores.length ? `\n⚠️ ${res.data.errores.length} errores` : ''}`);
      cargar();
    } catch (err) { alert(`Error: ${err.response?.data?.detail || err.message}`); }
  };

  const filtrados = alumnos.filter(a =>
    `${a.nombre} ${a.apellido || ''} ${a.email}`.toLowerCase().includes(busqueda.toLowerCase())
  );

  if (cargando) return (
    <p style={{ padding: 40, color: '#fff', fontSize: '1.5rem' }}>Cargando alumnos...</p>
  );

  return (
    <div style={{
      background: '#fff9c4', width: '100%', maxWidth: '1100px',
      maxHeight: '82vh', display: 'flex', flexDirection: 'column',
      padding: '30px 35px', boxShadow: '10px 10px 30px rgba(0,0,0,0.35)',
      borderBottomRightRadius: '40px 200px', transform: 'rotate(-0.5deg)',
      fontFamily: "'Indie Flower', cursive", color: '#1f2937',
      boxSizing: 'border-box', position: 'relative', overflowY: 'auto',
    }}>

      {/* Chinche */}
      <div style={{ position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)', width: '20px', height: '20px', background: '#dc2626', borderRadius: '50%', boxShadow: '2px 2px 5px rgba(0,0,0,0.4)' }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '2px dashed #b45309', paddingBottom: 12 }}>
        <h1 style={{ fontFamily: "'KG Midnight Memories', cursive", fontSize: '2.5rem', color: '#1e3a8a', margin: 0 }}>
          👨‍🎓 Mis Alumnos
        </h1>
        <button onClick={onVolver} style={BTN.volver}>⬅ Volver</button>
      </div>

      {/* ── PESTAÑAS ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid rgba(180,83,9,0.2)', paddingBottom: 0 }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setTabActiva(tab.id)}
            style={{
              padding: '8px 20px',
              border: 'none',
              borderRadius: '10px 10px 0 0',
              cursor: 'pointer',
              fontFamily: "'Indie Flower', cursive",
              fontWeight: 'bold',
              fontSize: '1rem',
              background: tabActiva === tab.id ? '#1e5c3a' : 'rgba(255,255,255,0.4)',
              color:      tabActiva === tab.id ? 'white'   : '#374151',
              borderBottom: tabActiva === tab.id ? '2px solid #1e5c3a' : '2px solid transparent',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════ TAB: ALUMNOS ══════════════ */}
      {tabActiva === 'alumnos' && (
        <>
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <input
              type="text" placeholder="🔎 Buscar alumno..."
              value={busqueda} onChange={e => setBusqueda(e.target.value)}
              style={INPUT_TOOLBAR}
            />
            <button onClick={() => { setMostrarForm(!mostrarForm); cancelarEdicion(); }} style={BTN.add}>
              {mostrarForm ? '✖ Cancelar' : '➕ Agregar'}
            </button>
            <label style={{ ...BTN.csv, display: 'inline-block' }}>
              📁 Importar CSV
              <input type="file" accept=".csv" onChange={handleImportarCSV} style={{ display: 'none' }} />
            </label>
          </div>

          {/* Formulario nuevo alumno */}
          {mostrarForm && (
            <div style={{ display: 'flex', gap: '10px', marginBottom: 12, flexWrap: 'wrap', alignItems: 'center', background: 'rgba(255,255,255,0.5)', borderRadius: '12px', padding: '12px' }}>
              <input type="text"  placeholder="Nombre *"  value={nuevoAlumno.nombre}   onChange={e => setNuevoAlumno({ ...nuevoAlumno, nombre:   e.target.value })} style={{ ...INPUT_TOOLBAR, minWidth: '120px' }} />
              <input type="text"  placeholder="Apellido"  value={nuevoAlumno.apellido} onChange={e => setNuevoAlumno({ ...nuevoAlumno, apellido: e.target.value })} style={{ ...INPUT_TOOLBAR, minWidth: '120px' }} />
              <input type="email" placeholder="Email *"   value={nuevoAlumno.email}    onChange={e => setNuevoAlumno({ ...nuevoAlumno, email:    e.target.value })} style={{ ...INPUT_TOOLBAR, minWidth: '180px' }} />
              <button onClick={handleAgregar} style={BTN.guardar}>Guardar</button>
            </div>
          )}

          {/* Contador */}
          <div style={{ fontSize: '0.95rem', color: '#555', marginBottom: 8 }}>
            Mostrando <b>{filtrados.length}</b> de <b>{alumnos.length}</b> alumnos
          </div>

          {/* Tabla alumnos */}
          <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: '#b45309 #fff9c4' }}>
            {filtrados.length === 0 ? (
              <div style={{ border: '2px dashed #d1d5db', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: '1.1rem' }}>
                {alumnos.length === 0 ? 'Todavía no cargaste alumnos. ¡Agregá el primero!' : 'No hay alumnos que coincidan.'}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '1rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(180,83,9,0.3)', textAlign: 'left', color: '#b45309' }}>
                    <th style={{ padding: '8px 12px' }}>Nombre</th>
                    <th style={{ padding: '8px 12px' }}>Apellido</th>
                    <th style={{ padding: '8px 12px' }}>Email</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((a, i) => {
                    const enEdicion = editandoId === a.id_alumno;
                    return (
                      <tr key={a.id_alumno} style={{ borderBottom: '1px solid rgba(180,83,9,0.15)', background: enEdicion ? 'rgba(167,139,250,0.12)' : i % 2 === 0 ? 'rgba(255,255,255,0.35)' : 'transparent' }}>
                        {enEdicion ? (
                          <>
                            <td style={{ padding: '8px 10px' }}><input type="text"  value={editData.nombre}   onChange={e => setEditData({ ...editData, nombre:   e.target.value })} style={INPUT_BASE} autoFocus /></td>
                            <td style={{ padding: '8px 10px' }}><input type="text"  value={editData.apellido} onChange={e => setEditData({ ...editData, apellido: e.target.value })} style={INPUT_BASE} /></td>
                            <td style={{ padding: '8px 10px' }}><input type="email" value={editData.email}    onChange={e => setEditData({ ...editData, email:    e.target.value })} style={INPUT_BASE} /></td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <button onClick={() => guardarEdicion(a.id_alumno)} disabled={guardando} style={{ ...BTN.guardar, marginRight: '6px', opacity: guardando ? 0.6 : 1 }}>
                                {guardando ? '...' : '💾 Guardar'}
                              </button>
                              <button onClick={cancelarEdicion} style={BTN.cancelarEdit}>✖</button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ padding: '8px 12px' }}>{a.nombre}</td>
                            <td style={{ padding: '8px 12px' }}>{a.apellido || '-'}</td>
                            <td style={{ padding: '8px 12px' }}>{a.email}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <button onClick={() => iniciarEdicion(a)} style={BTN.editar} title="Editar alumno">✏️</button>
                              <button onClick={() => handleEliminar(a.id_alumno, a.nombre)} style={BTN.eliminar} title="Eliminar alumno">🗑</button>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ══════════════ TAB: CALIFICACIONES ══════════════ */}
      {tabActiva === 'calificaciones' && (
        <TablaCalificaciones alumnos={alumnos} idDocente={userId} />
      )}

      {/* ══════════════ TAB: ASISTENCIA ══════════════ */}
      {tabActiva === 'asistencia' && (
        <TablaAsistencia alumnos={alumnos} idDocente={userId} />
      )}

    </div>
  );
};

export default AlumnosView;