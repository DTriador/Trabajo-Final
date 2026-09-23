// src/views/AlumnosView.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import proyectosService from '../services/proyectosService';
import api from '../api/axios';
import TablaCalificaciones from '../components/alumnos/TablaCalificaciones';
import TablaAsistencia     from '../components/alumnos/TablaAsistencia';
import ImportarAlumnosExcel from '../components/alumnos/ImportarAlumnosExcel';

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
  { id: 'alumnos',          label: 'Alumnos' },
  { id: 'calificaciones',   label: 'Calificaciones' },
  { id: 'asistencia',       label: 'Asistencia' },
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
  const [editData, setEditData]       = useState({ nombre: '', apellido: '', email: '', id_escuela: '' });
  const [guardando, setGuardando]     = useState(false);
  const [tabActiva, setTabActiva]     = useState('alumnos');
  const [escuelas, setEscuelas]       = useState([]);
  const [escuelaNueva, setEscuelaNueva] = useState('');
  const [escuelaImportacion, setEscuelaImportacion] = useState('');
  const [alumnoEnEdicion, setAlumnoEnEdicion] = useState(null);
  const [errorCarga, setErrorCarga] = useState('');

  const userId = user?.id || user?.id_docente || user?.user?.id;

  const cargar = async () => {
    if (!userId) return;
    try {
      const res = await api.get(`/alumnos/${userId}`);
      setAlumnos(res.data || []);
    } catch (e) {
      console.error('Error cargando alumnos:', e);
      setErrorCarga(e.response?.data?.detail || 'No se pudieron cargar los alumnos.');
    }
    finally { setCargando(false); }
  };

  useEffect(() => {
    cargar();
    if (userId) proyectosService.getEscuelas(userId).then(setEscuelas).catch(console.error);
  }, [userId]);

  const handleAgregar = async () => {
    if (!nuevoAlumno.nombre.trim() || !nuevoAlumno.email.trim()) {
      alert('Nombre y email son obligatorios'); return;
    }
    if (!escuelaNueva) { alert('Seleccioná el colegio del alumno'); return; }
    try {
      await api.post('/alumnos', { ...nuevoAlumno, id_docente: userId, id_escuela: escuelaNueva });
      setNuevoAlumno({ nombre: '', apellido: '', email: '' });
      setEscuelaNueva('');
      setMostrarForm(false);
      cargar();
    } catch (e) { alert(`Error: ${e.response?.data?.detail || e.message}`); }
  };

  const iniciarEdicion = (alumno) => {
    setEditandoId(alumno.id_alumno);
    setAlumnoEnEdicion(alumno);
    setEditData({ nombre: alumno.nombre, apellido: alumno.apellido || '', email: alumno.email, id_escuela: alumno.id_escuela || '' });
  };

  const cancelarEdicion = () => {
    setEditandoId(null);
    setAlumnoEnEdicion(null);
    setEditData({ nombre: '', apellido: '', email: '', id_escuela: '' });
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
        id_escuela: editData.id_escuela || null,
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

  const filtrados = alumnos.filter(a =>
    `${a.nombre} ${a.apellido || ''} ${a.email}`.toLowerCase().includes(busqueda.toLowerCase())
  );
  const gruposConocidos = escuelas.map(escuela => ({
    id: escuela.id_escuela,
    nombre: escuela.nombre_escuela,
    alumnos: alumnos.filter(a => a.id_escuela === escuela.id_escuela),
  }));
  const gruposSinEscuela = {
    id: '__sin_escuela', nombre: 'Sin colegio asignado',
    alumnos: alumnos.filter(a => !a.id_escuela),
  };
  const gruposDesconocidos = alumnos
    .filter(a => a.id_escuela && !escuelas.some(escuela => escuela.id_escuela === a.id_escuela))
    .reduce((grupos, alumno) => {
      const grupo = grupos.find(item => item.id === alumno.id_escuela);
      if (grupo) grupo.alumnos.push(alumno);
      else grupos.push({ id: alumno.id_escuela, nombre: 'Colegio no disponible', alumnos: [alumno] });
      return grupos;
    }, [])
  const gruposPorEscuela = [...gruposConocidos, gruposSinEscuela, ...gruposDesconocidos]
    .map(grupo => ({
    ...grupo,
    alumnos: grupo.alumnos.filter(a => filtrados.includes(a)),
    })).filter(grupo => grupo.alumnos.length > 0);

  if (cargando) return (
    <div role="status" style={{ padding: 40, color: '#fff', fontSize: '1.5rem' }}>Cargando alumnos…</div>
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
          Mis Alumnos
        </h1>
         <button onClick={onVolver} style={BTN.volver}>Volver</button>
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
               type="text" placeholder="Buscar alumno por nombre o email"
              value={busqueda} onChange={e => setBusqueda(e.target.value)}
              style={INPUT_TOOLBAR}
            />
            <button onClick={() => { setMostrarForm(!mostrarForm); cancelarEdicion(); }} style={BTN.add}>
              {mostrarForm ? 'Cancelar' : 'Agregar'}
            </button>
            <select
              aria-label="Colegio para importar"
              value={escuelaImportacion}
              onChange={e => setEscuelaImportacion(e.target.value)}
              style={{ ...INPUT_TOOLBAR, flex: '0 1 220px', minWidth: '180px' }}
            >
              <option value="">Colegio para importar…</option>
              {escuelas.map(escuela => <option key={escuela.id_escuela} value={escuela.id_escuela}>{escuela.nombre_escuela}</option>)}
            </select>
            <ImportarAlumnosExcel
              idDocente={userId}
              idEscuela={escuelaImportacion}
              onImportado={cargar}
            />
          </div>

          {errorCarga && (
            <div role="alert" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 12px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <span>{errorCarga}</span>
              <button type="button" onClick={cargar} style={{ ...BTN.cancelarEdit, color: '#991b1b', borderColor: '#fca5a5' }}>Reintentar</button>
            </div>
          )}

          {/* Formulario nuevo alumno */}
          {mostrarForm && (
            <div style={{ display: 'flex', gap: '10px', marginBottom: 12, flexWrap: 'wrap', alignItems: 'center', background: 'rgba(255,255,255,0.5)', borderRadius: '12px', padding: '12px' }}>
              <input type="text"  placeholder="Nombre *"  value={nuevoAlumno.nombre}   onChange={e => setNuevoAlumno({ ...nuevoAlumno, nombre:   e.target.value })} style={{ ...INPUT_TOOLBAR, minWidth: '120px' }} />
              <input type="text"  placeholder="Apellido"  value={nuevoAlumno.apellido} onChange={e => setNuevoAlumno({ ...nuevoAlumno, apellido: e.target.value })} style={{ ...INPUT_TOOLBAR, minWidth: '120px' }} />
              <input type="email" placeholder="Email *"   value={nuevoAlumno.email}    onChange={e => setNuevoAlumno({ ...nuevoAlumno, email:    e.target.value })} style={{ ...INPUT_TOOLBAR, minWidth: '180px' }} />
              <select value={escuelaNueva} onChange={e => setEscuelaNueva(e.target.value)} style={{ ...INPUT_TOOLBAR, minWidth: '180px' }}>
                <option value="">Colegio *</option>
                {escuelas.map(escuela => <option key={escuela.id_escuela} value={escuela.id_escuela}>{escuela.nombre_escuela}</option>)}
              </select>
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
                {alumnos.length === 0 ? 'Todavía no cargaste alumnos. Agregá el primero.' : 'No hay alumnos que coincidan.'}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '1rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(180,83,9,0.3)', textAlign: 'left', color: '#b45309' }}>
                    <th style={{ padding: '8px 12px' }}>Nombre</th>
                    <th style={{ padding: '8px 12px' }}>Apellido</th>
                    <th style={{ padding: '8px 12px' }}>Email</th>
                    <th style={{ padding: '8px 12px' }}>Colegio</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {gruposPorEscuela.flatMap(grupo => [
                    <tr key={`${grupo.id}-heading`}>
                      <td colSpan={5} style={{ padding: '8px 12px', background: '#dcfce7', color: '#166534', fontWeight: 'bold' }}>
                         {grupo.nombre} ({grupo.alumnos.length})
                      </td>
                    </tr>,
                    ...grupo.alumnos.map((a, i) => {
                    const enEdicion = editandoId === a.id_alumno;
                    return (
                      <tr key={a.id_alumno} style={{ borderBottom: '1px solid rgba(180,83,9,0.15)', background: enEdicion ? 'rgba(167,139,250,0.12)' : i % 2 === 0 ? 'rgba(255,255,255,0.35)' : 'transparent' }}>
                        {enEdicion ? (
                          <>
                            <td style={{ padding: '8px 10px' }}><input type="text"  value={editData.nombre}   onChange={e => setEditData({ ...editData, nombre:   e.target.value })} style={INPUT_BASE} autoFocus /></td>
                            <td style={{ padding: '8px 10px' }}><input type="text"  value={editData.apellido} onChange={e => setEditData({ ...editData, apellido: e.target.value })} style={INPUT_BASE} /></td>
                            <td style={{ padding: '8px 10px' }}><input type="email" value={editData.email}    onChange={e => setEditData({ ...editData, email:    e.target.value })} style={INPUT_BASE} /></td>
                            <td style={{ padding: '8px 10px' }}>
                              <select value={editData.id_escuela} onChange={e => setEditData({ ...editData, id_escuela: e.target.value })} style={INPUT_BASE}>
                                <option value="">Sin colegio</option>
                                {escuelas.map(escuela => <option key={escuela.id_escuela} value={escuela.id_escuela}>{escuela.nombre_escuela}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <button onClick={() => guardarEdicion(a.id_alumno)} disabled={guardando} style={{ ...BTN.guardar, marginRight: '6px', opacity: guardando ? 0.6 : 1 }}>
                                 {guardando ? 'Guardando…' : 'Guardar'}
                              </button>
                              <button onClick={cancelarEdicion} style={BTN.cancelarEdit}>Cancelar</button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ padding: '8px 12px' }}>{a.nombre}</td>
                            <td style={{ padding: '8px 12px' }}>{a.apellido || '-'}</td>
                            <td style={{ padding: '8px 12px' }}>{a.email}</td>
                            <td style={{ padding: '8px 12px' }}>{escuelas.find(escuela => escuela.id_escuela === a.id_escuela)?.nombre_escuela || 'Sin colegio'}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                               <button onClick={() => iniciarEdicion(a)} style={BTN.editar} title="Editar alumno" aria-label={`Editar a ${a.nombre}`}>Editar</button>
                               <button onClick={() => handleEliminar(a.id_alumno, a.nombre)} style={BTN.eliminar} title="Eliminar alumno" aria-label={`Eliminar a ${a.nombre}`}>Eliminar</button>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  }),
                  ])}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ══════════════ TAB: CALIFICACIONES ══════════════ */}
      {tabActiva === 'calificaciones' && (
        gruposPorEscuela.map(grupo => (
          <div key={grupo.id}>
             <h3 style={{ color: '#166534', margin: '8px 0' }}>{grupo.nombre}</h3>
            <TablaCalificaciones alumnos={grupo.alumnos} idDocente={userId} />
          </div>
        ))
      )}

      {/* ══════════════ TAB: ASISTENCIA ══════════════ */}
      {tabActiva === 'asistencia' && (
        gruposPorEscuela.map(grupo => (
          <div key={grupo.id}>
             <h3 style={{ color: '#166534', margin: '8px 0' }}>{grupo.nombre}</h3>
            <TablaAsistencia alumnos={grupo.alumnos} idDocente={userId} />
          </div>
        ))
      )}

    </div>
  );
};

export default AlumnosView;