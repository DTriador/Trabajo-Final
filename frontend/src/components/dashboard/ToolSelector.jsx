// src/components/dashboard/ToolSelector.jsx
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import proyectosService from '../../services/proyectosService';
import ToolForm from './ToolForm';
import '../../views/Dashboard.css';
import PlanificacionWizard from './PlanificacionWizard';

// Herramientas que necesitan el desplegable de escuela/materia
const TOOLS_CON_ESCUELA = [
  'planificacion', 'presentacion',
  'apunte', 'preguntas', 'examen', 'podcast',
  'sopa_letras', 'crucigrama', 'unir_flechas',
];
const INITIAL_FORM = {
  tema: '', id_escuela: '', id_curso: '',
  nombre_clase: '', nombre_presentacion: '', nombre_guia: '',
  numero_preguntas: 10, fecha: '', duracion: '', pdf: null,
  materia_examen: '', fecha_examen: '',
  examen_tipos: {
    desarrollo:      { activo: false, cantidad: 0 },
    multiple:        { activo: false, cantidad: 0 },
    completar:       { activo: false, cantidad: 0 },
    verdadero_falso: { activo: false, cantidad: 0 },
  },
  numero_palabras: 10,
  mostrar_lista_palabras: true,
  palabras_horizontales: 5,
  palabras_verticales: 5,
  numero_pares: 8,
  // ── nuevos campos para TOOLS_CON_ESCUELA ──────────────────────────────────
  fuente_contenido: 'bibliografia',   // 'bibliografia' | 'pdf'
};

const tools = [
  { id: 'planificacion', title: 'Planificación',   icon: '📋', color: '#b39ddb', rotate: '-2deg' },
  { id: 'presentacion',  title: 'Presentación',    icon: '📊', color: '#ffeb3b', rotate: '1deg'  },
  { id: 'apunte',        title: 'Apunte / Doc',    icon: '📄', color: '#98ff98', rotate: '-1deg' },
  { id: 'preguntas',     title: 'Preguntas Guía',  icon: '❓', color: '#7afcff', rotate: '2deg'  },
  { id: 'examen',        title: 'Armar Examen',    icon: '📝', color: '#ff7eb9', rotate: '-3deg' },
  { id: 'podcast',       title: 'Podcast',         icon: '🎙️', color: '#e6ee9c', rotate: '1deg'  },
  { id: 'sopa_letras',   title: 'Sopa de Letras',  icon: '🔠', color: '#ffcc80', rotate: '-2deg' },
  { id: 'crucigrama',    title: 'Crucigrama',      icon: '➕', color: '#ce93d8', rotate: '3deg'  },
  { id: 'unir_flechas',  title: 'Unir Flechas',    icon: '↔️', color: '#81d4fa', rotate: '-1deg' },
];

const MODAL_TITLES = {
  planificacion: '🗓️ Planificar Clase Nueva',
  presentacion:  '📊 Generar Presentación',
  apunte:        '📄 Generar Apunte / Doc',
  preguntas:     '❓ Generar Preguntas Guía',
  examen:        '📝 Armar Examen',
  podcast:       '🎙️ Generar Podcast',
  sopa_letras:   '🔠 Generar Sopa de Letras',
  crucigrama:    '➕ Generar Crucigrama',
  unir_flechas:  '↔️ Generar Unir con flechas',
};

const ToolSelector = ({ onVolver }) => {
  const { user } = useAuth();
  const [modal, setModal]       = useState({ isOpen: false, tool: null });
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [escuelas, setEscuelas] = useState([]);
  const [cursos, setCursos]     = useState([]);

  const handleOpenModal = async (tool) => {
    setModal({ isOpen: true, tool });
    setFormData(INITIAL_FORM);
    setCursos([]);

   
    if (TOOLS_CON_ESCUELA.includes(tool.id)) {
      try {
        const userId = user?.id || user?.id_docente || user?.user?.id;
        const data = await proyectosService.getEscuelas(userId);
        setEscuelas(data);
      } catch (e) {
        console.error("Error cargando escuelas:", e);
      }
    }
  };

  const handleEscuelaChange = async (e) => {
    const escId = e.target.value;
    setFormData(prev => ({ ...prev, id_escuela: escId, id_curso: '', materia_examen: '' }));
    if (escId) {
      try {
        const data = await proyectosService.getCursosPorEscuela(escId);
        setCursos(data);
      } catch (error) {
        console.error("Error cargando materias:", error);
      }
    } else {
      setCursos([]);
    }
  };

  const closeModal = () => {
    setModal({ isOpen: false, tool: null });
    setEscuelas([]);
    setCursos([]);
  };

  return (
    <div className="flex items-center justify-center w-full h-full p-4 mt-2 relative">
      {/* ----- PIZARRA ----- */}
      <div className="relative flex flex-col items-center justify-center transition-all duration-300"
        style={{
          backgroundColor: '#fff9c4', width: '100%', maxWidth: '950px', minHeight: '85vh',
          padding: '2rem', boxShadow: '10px 10px 30px rgba(0,0,0,0.3)',
          borderBottomRightRadius: '80px 220px', transform: 'rotate(1deg)',
        }}>
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-8 h-8 bg-red-500 rounded-full shadow-[2px_2px_5px_rgba(0,0,0,0.4)]">
          <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-white rounded-full opacity-60"></div>
        </div>

        <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 50 }}>
          <button onClick={onVolver} style={{
            backgroundColor: '#e0f2fe', color: '#0c4a6e',
            border: '2px solid #38bdf8', borderRadius: '50px',
            padding: '6px 16px', cursor: 'pointer',
            fontFamily: "'Indie Flower', cursive", fontWeight: 'bold', fontSize: '1rem',
          }}>
            ⬅ Volver
          </button>
        </div>

        <h2 className="text-5xl text-white-800 mb-12 text-center mt-6 tracking-wide"
          style={{ fontFamily: "'KG Midnight Memories', cursive" }}>
          ¡Elegí una herramienta para empezar la magia!
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2.5rem', width: '100%', justifyItems: 'center' }}>
          {tools.map((tool) => (
            <button key={tool.id} onClick={() => handleOpenModal(tool)}
              className="flex flex-col items-center justify-center gap-2 p-4 transition-all duration-200 cursor-pointer hover:z-10 hover:scale-110"
              style={{
                width: '160px', height: '110px', backgroundColor: tool.color,
                transform: `rotate(${tool.rotate})`,
                boxShadow: '4px 4px 10px rgba(0,0,0,0.2)',
                border: '1px solid rgba(0,0,0,0.05)', borderRadius: '4px',
              }}>
              <span className="text-3xl">{tool.icon}</span>
              <span className="text-lg text-white-900 text-center leading-tight"
                style={{ fontFamily: "'Indie Flower', cursive", fontWeight: 'bold' }}>
                {tool.title}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ----- MODAL ----- */}
      {modal.isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999,
        }}>
          <div style={{
            backgroundColor: '#262626', border: '3px solid #ff7eb9',
            borderRadius: '24px', padding: '40px', width: '90%', maxWidth: '850px',
            maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)', position: 'relative',
          }}>
            <h3 style={{
              fontSize: '3rem', color: 'white', textAlign: 'center',
              marginBottom: '30px', fontWeight: 'normal',
              fontFamily: "'KG Midnight Memories', cursive", letterSpacing: '2px',
            }}>
              {MODAL_TITLES[modal.tool.id] || `✨ Generar ${modal.tool.title}`}
            </h3>

            {modal.tool.id === 'planificacion' ? (
              <PlanificacionWizard
                onClose={closeModal}
                onPlanificacionGuardada={(data) => {
                  console.log('Planificación creada:', data);
                  closeModal();
                }}
              />
            ) : (
              <ToolForm
                tool={modal.tool}
                formData={formData}
                setFormData={setFormData}
                escuelas={escuelas}
                cursos={cursos}
                handleEscuelaChange={handleEscuelaChange}
                onClose={closeModal}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ToolSelector;
