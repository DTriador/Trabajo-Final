// src/components/dashboard/EscuelasSection.jsx
import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import proyectosService from '../../services/proyectosService';
import ConfirmModal from './ConfirmModal';

export default function EscuelasSection({ userId, editando }) {
    const [escuelas, setEscuelas] = useState([]);

    // Agregar escuela
    const [mostrarInputEscuela, setMostrarInputEscuela] = useState(false);
    const [nuevaEscuelaNombre, setNuevaEscuelaNombre] = useState('');

    // Agregar materia
    const [escuelaIdMateria, setEscuelaIdMateria] = useState(null);
    const [nuevaMateria, setNuevaMateria] = useState({ nombre: '', division: '' });

    // Editar materia (contenido mínimo, bibliografía, fuentes)
    const [editandoMateria, setEditandoMateria] = useState(null);
    const [formMateria, setFormMateria] = useState({
        contenido_minimo: '',
        bibliografia: [],
        fuentes: '',
    });

    // Modal de confirmación
    const [confirmState, setConfirmState] = useState({
        open: false,
        title: '',
        message: '',
        confirmText: 'Sí, continuar',
        confirmColor: '#dc2626',
        onConfirm: null,
    });

    const cerrarConfirm = () => setConfirmState(s => ({ ...s, open: false }));

    const pedirConfirmacion = ({ title, message, confirmText, confirmColor, onConfirm }) => {
        setConfirmState({
            open: true,
            title: title || '¿Estás segura?',
            message,
            confirmText: confirmText || 'Sí, continuar',
            confirmColor: confirmColor || '#dc2626',
            onConfirm: async () => {
                cerrarConfirm();
                await onConfirm();
            },
        });
    };

    // Cargar escuelas al montar o cuando cambia el userId
    useEffect(() => {
        if (!userId) return;
        const cargar = async () => {
            try {
                const escuelasData = await proyectosService.getEscuelas(userId);
                const escuelasConMaterias = await Promise.all(
                    escuelasData.map(async (escuela) => {
                        try {
                            const cursosRes = await api.get(`/proyectos/cursos/${escuela.id_escuela}`);
                            return { ...escuela, materias: cursosRes.data || [] };
                        } catch (err) {
                            console.error(`Error trayendo materias para escuela ${escuela.id_escuela}`, err);
                            return { ...escuela, materias: [] };
                        }
                    })
                );
                setEscuelas(escuelasConMaterias);
            } catch (error) {
                console.error('❌ ERROR ESCUELAS:', error);
            }
        };
        cargar();
    }, [userId]);

    // Cerrar formularios abiertos cuando se sale del modo edición
    useEffect(() => {
        if (!editando) {
            setMostrarInputEscuela(false);
            setEscuelaIdMateria(null);
            setNuevaEscuelaNombre('');
            setNuevaMateria({ nombre: '', division: '' });
        }
    }, [editando]);

    // ─── Handlers escuelas ────────────────────────────────────────────────────

    const handleCrearEscuela = async () => {
        if (!nuevaEscuelaNombre.trim()) return;
        try {
            const res = await api.post('/proyectos/escuelas', {
                id_docente: userId,
                nombre_escuela: nuevaEscuelaNombre,
            });
            setEscuelas(prev => [...prev, { ...res.data, materias: [] }]);
            setNuevaEscuelaNombre('');
            setMostrarInputEscuela(false);
        } catch (error) {
            console.error('Error al crear escuela:', error);
            alert('Hubo un error al agregar la escuela.');
        }
    };

    const handleDeleteEscuela = (escuela) => {
        pedirConfirmacion({
            title: 'Eliminar escuela',
            message: `Si borrás "${escuela.nombre_escuela}", se eliminan todas sus materias. ¿Querés continuar?`,
            confirmText: 'Sí, eliminar',
            onConfirm: async () => {
                try {
                    await api.delete(`/proyectos/escuelas/${escuela.id_escuela}`);
                    setEscuelas(prev => prev.filter(e => e.id_escuela !== escuela.id_escuela));
                } catch (error) {
                    console.error('Error al eliminar escuela:', error.response?.data || error);
                    alert('Hubo un error al eliminar la escuela.');
                }
            },
        });
    };

    // ─── Handlers materias ────────────────────────────────────────────────────

    const handleCrearMateria = async (idEscuela) => {
        if (!nuevaMateria.nombre.trim() || !nuevaMateria.division.trim()) {
            alert('Por favor, completá la materia y la división.');
            return;
        }
        try {
            const res = await api.post('/proyectos/cursos', {
                id_escuela: idEscuela,
                nombre_materia: nuevaMateria.nombre,
                division: nuevaMateria.division,
                ciclo_lectivo: new Date().getFullYear(),
            });
            setEscuelas(prev => prev.map(esc => {
                if (esc.id_escuela !== idEscuela) return esc;
                return { ...esc, materias: [...esc.materias, res.data] };
            }));
            setNuevaMateria({ nombre: '', division: '' });
            setEscuelaIdMateria(null);
        } catch (error) {
            console.error('Error al crear materia:', error);
            alert('Hubo un error al agregar la materia.');
        }
    };

    const handleEditarMateria = (materia) => {
        setEditandoMateria(materia);
        setFormMateria({
            contenido_minimo: materia.contenido_minimo || '',
            bibliografia: materia.bibliografia || [],
            fuentes: materia.fuentes || '',
        });
    };

    const handleGuardarMateria = async () => {
        try {
            await api.put(`/proyectos/cursos/${editandoMateria.id_curso}`, formMateria);
            setEscuelas(prev => prev.map(esc => ({
                ...esc,
                materias: esc.materias.map(m =>
                    m.id_curso === editandoMateria.id_curso ? { ...m, ...formMateria } : m
                ),
            })));
            alert('✅ Materia actualizada correctamente');
            setEditandoMateria(null);
        } catch (error) {
            console.error('Error al guardar materia:', error);
            alert('Hubo un error al guardar los cambios.');
        }
    };

    const handleAgregarBibliografia = () => {
        const archivo = window.prompt('Ingresa el nombre del archivo de bibliografía:');
        if (archivo && archivo.trim()) {
            setFormMateria(prev => ({ ...prev, bibliografia: [...prev.bibliografia, archivo.trim()] }));
        }
    };

    const handleEliminarBibliografia = (index) => {
        setFormMateria(prev => ({
            ...prev,
            bibliografia: prev.bibliografia.filter((_, i) => i !== index),
        }));
    };

    const handleMoverCurso = async (materia, idEscuelaActual) => {
        const opciones = escuelas.filter(e => e.id_escuela !== idEscuelaActual);
        if (opciones.length === 0) {
            alert('No hay otras escuelas a las que mover esta materia.');
            return;
        }
        const lista = opciones.map((e, i) => `${i + 1}) ${e.nombre_escuela}`).join('\n');
        const eleccion = window.prompt(
            `¿A qué escuela querés mover "${materia.nombre_materia}"?\n\n${lista}\n\nEscribí el número:`
        );
        const idx = parseInt(eleccion, 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= opciones.length) return;
        const escuelaDestino = opciones[idx];
        try {
            await api.put(`/proyectos/cursos/${materia.id_curso}/mover`, {
                nuevo_id_escuela: escuelaDestino.id_escuela,
            });
            setEscuelas(prev => prev.map(esc => {
                if (esc.id_escuela === idEscuelaActual)
                    return { ...esc, materias: esc.materias.filter(m => m.id_curso !== materia.id_curso) };
                if (esc.id_escuela === escuelaDestino.id_escuela)
                    return { ...esc, materias: [...esc.materias, materia] };
                return esc;
            }));
        } catch (error) {
            console.error('Error al mover curso:', error.response?.data || error);
            alert('No se pudo mover la materia.');
        }
    };

    const handleDeleteCurso = (idCurso) => {
        pedirConfirmacion({
            title: 'Eliminar materia',
            message: '¿Seguro que querés eliminar esta materia? Esta acción no se puede deshacer.',
            confirmText: 'Sí, eliminar',
            onConfirm: async () => {
                try {
                    await api.delete(`/proyectos/cursos/${idCurso}`);
                    setEscuelas(prev => prev.map(esc => ({
                        ...esc,
                        materias: esc.materias.filter(m => m.id_curso !== idCurso),
                    })));
                } catch (error) {
                    console.error('Error al eliminar curso:', error.response?.data || error);
                    alert('Hubo un error al eliminar la materia.');
                }
            },
        });
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '2px solid #ccc', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '1.6rem', color: '#1e3a8a' }}>🏫 Mis Escuelas</h3>
                {editando && (
                    <button onClick={() => setMostrarInputEscuela(!mostrarInputEscuela)}
                        style={{ fontSize: '1rem', color: '#2563eb', cursor: 'pointer', background: 'none', border: 'none', fontWeight: 'bold' }}>
                        {mostrarInputEscuela ? 'Cancelar' : '+ Agregar escuela'}
                    </button>
                )}
            </div>

            {editando && mostrarInputEscuela && (
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', backgroundColor: 'rgba(219,234,254,0.4)', padding: '10px', borderRadius: '8px' }}>
                    <input type="text" placeholder="Nombre de la Institución..."
                        className="perfil-input" style={{ flex: 1, fontSize: '1.2rem' }}
                        value={nuevaEscuelaNombre} onChange={e => setNuevaEscuelaNombre(e.target.value)} />
                    <button onClick={handleCrearEscuela} className="perfil-edit-btn"
                        style={{ borderColor: '#22c55e', backgroundColor: '#dcfce7' }}>Guardar</button>
                </div>
            )}

            {escuelas.length === 0 ? (
                <p style={{ fontStyle: 'italic', color: '#666' }}>No tenés escuelas registradas todavía.</p>
            ) : (
                escuelas.map((escuela) => (
                    <div key={escuela.id_escuela} style={{ marginBottom: '25px', marginLeft: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '1.4rem', color: '#374151' }}>
                                🏫 {escuela.nombre_escuela}
                            </span>
                            {editando && (
                                <div>
                                    <button onClick={() => setEscuelaIdMateria(escuelaIdMateria === escuela.id_escuela ? null : escuela.id_escuela)}
                                        style={{ fontSize: '0.9rem', color: '#059669', cursor: 'pointer', background: 'none', border: 'none', marginRight: '15px', fontWeight: 'bold' }}>
                                        {escuelaIdMateria === escuela.id_escuela ? 'Cancelar' : '+ Agregar materia'}
                                    </button>
                                    <button onClick={() => handleDeleteEscuela(escuela)}
                                        style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer' }}>❌</button>
                                </div>
                            )}
                        </div>

                        {editando && escuelaIdMateria === escuela.id_escuela && (
                            <div style={{ display: 'flex', gap: '10px', padding: '10px 0 10px 30px', backgroundColor: 'rgba(209,250,229,0.3)', borderRadius: '5px', marginBottom: '10px' }}>
                                <input type="text" placeholder="Ej: Matemática" className="perfil-input"
                                    style={{ fontSize: '1.1rem', flex: 2 }} value={nuevaMateria.nombre}
                                    onChange={e => setNuevaMateria({ ...nuevaMateria, nombre: e.target.value })} />
                                <input type="text" placeholder="División (Ej: 3A)" className="perfil-input"
                                    style={{ fontSize: '1.1rem', flex: 1 }} value={nuevaMateria.division}
                                    onChange={e => setNuevaMateria({ ...nuevaMateria, division: e.target.value })} />
                                <button onClick={() => handleCrearMateria(escuela.id_escuela)} className="perfil-edit-btn"
                                    style={{ borderColor: '#059669', backgroundColor: '#d1fae5', padding: '2px 10px' }}>OK</button>
                            </div>
                        )}

                        <ul style={{ listStyleType: 'none', paddingLeft: '35px', margin: 0 }}>
                            {escuela.materias && escuela.materias.length > 0 ? (
                                escuela.materias.map(materia => (
                                    <li key={materia.id_curso} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #cbd5e1' }}>
                                        <span style={{ fontSize: '1.2rem', color: '#475569' }}>
                                            ↳ {materia.nombre_materia} <span style={{ color: '#94a3b8', fontSize: '1rem' }}>({materia.division})</span>
                                        </span>
                                        {editando && (
                                            <div>
                                                <button onClick={() => handleEditarMateria(materia)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#059669', marginRight: '10px' }}
                                                    title="Editar contenido mínimo">📝</button>
                                                <button onClick={() => handleMoverCurso(materia, escuela.id_escuela)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#2563eb', marginRight: '10px' }}
                                                    title="Mover a otra escuela">↔</button>
                                                <button onClick={() => handleDeleteCurso(materia.id_curso)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#dc2626' }}
                                                    title="Eliminar materia">❌</button>
                                            </div>
                                        )}
                                    </li>
                                ))
                            ) : (
                                <li style={{ fontSize: '1rem', color: '#94a3b8', padding: '6px 0' }}>↳ Sin materias cargadas.</li>
                            )}
                        </ul>
                    </div>
                ))
            )}

            {/* Modal editar materia */}
            {editandoMateria && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000,
                }}>
                    <div style={{
                        background: '#fff9c4', padding: '30px', borderRadius: '10px',
                        maxWidth: '600px', width: '90%', maxHeight: '80vh', overflowY: 'auto',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.3)', transform: 'rotate(1deg)',
                    }}>
                        <h2 style={{ marginBottom: '20px', color: '#1e3a8a' }}>
                            📝 Editar Materia: {editandoMateria.nombre_materia}
                        </h2>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                                Contenido Mínimo de la Asignatura:
                            </label>
                            <textarea
                                value={formMateria.contenido_minimo}
                                onChange={e => setFormMateria({ ...formMateria, contenido_minimo: e.target.value })}
                                placeholder="Describe los contenidos mínimos que se deben cubrir en esta asignatura..."
                                style={{
                                    width: '100%', minHeight: '100px', padding: '10px',
                                    border: '2px solid #d97706', borderRadius: '5px',
                                    fontFamily: 'inherit', fontSize: '1rem',
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                                Bibliografía:
                            </label>
                            <div style={{ marginBottom: '10px' }}>
                                <button onClick={handleAgregarBibliografia}
                                    style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer' }}>
                                    + Agregar Archivo
                                </button>
                            </div>
                            <ul style={{ listStyleType: 'none', padding: 0 }}>
                                {formMateria.bibliografia.map((archivo, index) => (
                                    <li key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #e5e7eb' }}>
                                        <span>{archivo}</span>
                                        <button onClick={() => handleEliminarBibliografia(index)}
                                            style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '1.2rem' }}>
                                            ×
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
                                Fuentes Citadas:
                            </label>
                            <textarea
                                value={formMateria.fuentes}
                                onChange={e => setFormMateria({ ...formMateria, fuentes: e.target.value })}
                                placeholder="Cita las fuentes bibliográficas, webs, documentos, etc..."
                                style={{
                                    width: '100%', minHeight: '80px', padding: '10px',
                                    border: '2px solid #d97706', borderRadius: '5px',
                                    fontFamily: 'inherit', fontSize: '1rem',
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setEditandoMateria(null)}
                                style={{ background: '#e5e7eb', color: '#374151', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' }}>
                                Cancelar
                            </button>
                            <button onClick={handleGuardarMateria}
                                style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '5px', cursor: 'pointer' }}>
                                💾 Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                open={confirmState.open}
                title={confirmState.title}
                message={confirmState.message}
                confirmText={confirmState.confirmText}
                confirmColor={confirmState.confirmColor}
                onConfirm={confirmState.onConfirm}
                onCancel={cerrarConfirm}
            />
        </div>
    );
}