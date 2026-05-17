import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import fondoHoja from '../assets/img/fondo-hoja.png';
import { useAuth } from '../context/AuthContext';
import proyectosService from '../services/proyectosService';
import CalendarioDocente from '../components/dashboard/CalendarioDocente';

const BibliotecaView = () => {
    const { user } = useAuth();
    const [escuelas, setEscuelas] = useState([]);
    const [cursos, setCursos] = useState([]); 
    const [escuelaSeleccionada, setEscuelaSeleccionada] = useState(null);
    const [cursoSeleccionado, setCursoSeleccionado] = useState(null); 
    const [idPlanificacionActiva, setIdPlanificacionActiva] = useState(null); 
    const [cargando, setCargando] = useState(true);
    // eslint-disable-next-line no-unused-vars
    const [limpiando, setLimpiando] = useState(false);
    
    const [mostrarForm, setMostrarForm] = useState(false);
    const [mostrarFormCurso, setMostrarFormCurso] = useState(false);
    const [nuevaEscuela, setNuevaEscuela] = useState({ nombre_escuela: '', ciudad: '' });
    const [nuevoCurso, setNuevoCurso] = useState({ nombre_materia: '', division: '', ciclo_lectivo: 2026 });

    const cargarEscuelas = async () => {
        if (user?.id) {
            try {
                const data = await proyectosService.getEscuelas(user.id);
                setEscuelas(data);
            } catch (error) { console.error("Error cargando escuelas"); }
            finally { setCargando(false); }
        }
    };

    const seleccionarEscuela = async (escuela) => {
        setEscuelaSeleccionada(escuela);
        setCursoSeleccionado(null);
        setCargando(true);
        try {
            const data = await proyectosService.getCursosPorEscuela(escuela.id_escuela);
            setCursos(data);
        } catch (error) { console.error("Error cargando cursos"); }
        finally { setCargando(false); }
    };

    const seleccionarCurso = async (curso) => {
        setCursoSeleccionado(curso);
        setCargando(true);
        try {
            const res = await api.get(`/api/v1/planificacion/curso/${curso.id_curso}`);
            if (res.data && res.data.id_planificacion) {
                setIdPlanificacionActiva(res.data.id_planificacion);
            } else {
                setIdPlanificacionActiva(null);
            }
        } catch (error) {
            console.error("Error al buscar planificación activa");
            setIdPlanificacionActiva(null);
        } finally {
            setCargando(false);
        }
    };

    const handleGenerarPlanificacionPrueba = async () => {
        if (!cursoSeleccionado) return;
        const confirmacion = window.confirm(`¿Generar planificación automática para ${cursoSeleccionado.nombre_materia}?`);
        if (confirmacion) {
            setCargando(true);
            try {
                const payload = {
                    id_curso: cursoSeleccionado.id_curso,
                    titulo_plan: `Planificación: ${cursoSeleccionado.nombre_materia}`,
                    objetivos_generales: "Completar el programa académico 2026.",
                    fecha_inicio: new Date().toISOString(),
                    dias_semana: [0, 2], 
                    temas: ["Unidad 1: Fundamentos", "Unidad 2: Procesos", "Examen Parcial"]
                };
                const res = await api.post('/api/v1/planificacion/crear', payload);
                if (res.data.status === "success") {
                    alert("✨ ¡Planificación creada!");
                    seleccionarCurso(cursoSeleccionado); 
                }
            } catch (error) { alert("Error al conectar con el motor de IA."); }
            finally { setCargando(false); }
        }
    };

    useEffect(() => { cargarEscuelas(); }, [user]);

    const handleCrearEscuela = async (e) => {
        e.preventDefault();
        try {
            await proyectosService.crearEscuela({ id_docente: user.id, ...nuevaEscuela });
            setNuevaEscuela({ nombre_escuela: '', ciudad: '' });
            setMostrarForm(false);
            cargarEscuelas();
        } catch (error) { alert("Error al guardar escuela."); }
    };

    const handleCrearCurso = async (e) => {
        e.preventDefault();
        try {
            await proyectosService.crearCurso({ id_escuela: escuelaSeleccionada.id_escuela, ...nuevoCurso });
            setNuevoCurso({ nombre_materia: '', division: '', ciclo_lectivo: 2026 });
            setMostrarFormCurso(false);
            seleccionarEscuela(escuelaSeleccionada); 
        } catch (error) { alert("Error al guardar materia."); }
    };

    return (
        <div className="screen bg-chalkboard p-8">
            <div className="notebook-paper p-10 min-h-[80vh] relative" style={{ backgroundImage: `url(${fondoHoja})`, backgroundSize: 'cover' }}>
                
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-bold text-blue-800 underline decoration-pink-300">
                        {cursoSeleccionado ? `📖 ${cursoSeleccionado.nombre_materia}` : escuelaSeleccionada ? `🏫 ${escuelaSeleccionada.nombre_escuela}` : "Mi Biblioteca"}
                    </h2>
                    
                    <div className="flex gap-2">
                        {escuelaSeleccionada && (
                            <button onClick={() => cursoSeleccionado ? setCursoSeleccionado(null) : setEscuelaSeleccionada(null)} className="sticker-btn bg-gray-200 border-2 border-gray-400 p-2 rounded">
                                ⬅ Volver
                            </button>
                        )}
                        {!escuelaSeleccionada && (
                            <button onClick={() => setMostrarForm(!mostrarForm)} className="sticker-btn bg-yellow-100 border-2 border-yellow-400 p-2 rounded">
                                {mostrarForm ? "❌ Cerrar" : "➕ Nueva Escuela"}
                            </button>
                        )}
                    </div>
                </div>

                <div className="content-handwritten">
                    {cursoSeleccionado ? (
                        <div className="space-y-4">
                            {idPlanificacionActiva ? (
                                <CalendarioDocente idPlanificacion={idPlanificacionActiva} />
                            ) : (
                                <div className="text-center py-10 border-2 border-dashed border-gray-300 rounded">
                                    <p className="mb-4 text-xl">No hay una planificación activa para este curso.</p>
                                    <button onClick={handleGenerarPlanificacionPrueba} className="bg-blue-600 text-white px-6 py-2 rounded-full font-bold shadow-lg">
                                        ✨ Generar Planificación con IA
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : escuelaSeleccionada ? (
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold italic">Materias dictadas:</h3>
                                <button onClick={() => setMostrarFormCurso(!mostrarFormCurso)} className="text-sm bg-green-100 border border-green-500 px-2 py-1 rounded">
                                    {mostrarFormCurso ? "Cancelar" : "+ Agregar Materia"}
                                </button>
                            </div>

                            {mostrarFormCurso && (
                                <form onSubmit={handleCrearCurso} className="mb-6 p-4 border-2 border-dashed border-green-300 bg-green-50 rounded-lg flex gap-2">
                                    <input type="text" placeholder="Materia" className="bg-transparent border-b border-green-500 outline-none flex-1" value={nuevoCurso.nombre_materia} onChange={(e) => setNuevoCurso({...nuevoCurso, nombre_materia: e.target.value})} required />
                                    <input type="text" placeholder="División" className="bg-transparent border-b border-green-500 outline-none w-24" value={nuevoCurso.division} onChange={(e) => setNuevoCurso({...nuevoCurso, division: e.target.value})} required />
                                    <button type="submit" className="bg-green-600 text-white px-4 py-1 rounded">Guardar</button>
                                </form>
                            )}

                            {cargando ? <p>Cargando materias...</p> : (
                                <div className="grid grid-cols-2 gap-3">
                                    {cursos.map(c => (
                                        <div key={c.id_curso} onClick={() => seleccionarCurso(c)} className="p-3 border-l-4 border-blue-500 bg-blue-50/50 shadow-sm cursor-pointer hover:bg-blue-100 transition-all">
                                            <p className="font-bold text-lg">{c.nombre_materia}</p>
                                            <p className="text-sm text-gray-600">División: {c.division} | <span className="text-blue-600 underline">Ver Cronograma</span></p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div>
                            {mostrarForm && (
                                <form onSubmit={handleCrearEscuela} className="mb-8 p-6 bg-yellow-50 border-2 border-dashed border-yellow-300 rounded-lg">
                                    <h3 className="text-xl font-bold mb-4">Nueva Institución</h3>
                                    <input type="text" placeholder="Nombre" className="w-full p-2 border-b-2 border-blue-300 bg-transparent mb-3" value={nuevaEscuela.nombre_escuela} onChange={(e) => setNuevaEscuela({...nuevaEscuela, nombre_escuela: e.target.value})} required />
                                    <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded">Guardar</button>
                                </form>
                            )}

                            {cargando ? <p className="italic">Cargando instituciones...</p> : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {escuelas.map((esc) => (
                                        <div key={esc.id_escuela} className="p-4 border-2 border-blue-200 rounded-lg bg-white/50 shadow-sm">
                                            <h3 className="text-2xl font-bold">🏫 {esc.nombre_escuela}</h3>
                                            <button onClick={() => seleccionarEscuela(esc)} className="mt-2 text-blue-600 font-bold hover:underline">
                                                Gestionar materias →
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BibliotecaView;