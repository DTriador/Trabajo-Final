// src/components/dashboard/PlanificacionWizard.jsx
import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import proyectosService from '../../services/proyectosService';
import {
  S,
  PasoMateria,
  PasoCalendario,
  PasoExamenes,
  PasoPreview,
} from './PlanificacionWizard.steps';
import { COLORES } from './calendario/calendarioHelpers';

const PASOS = ['📚 Materia', '📅 Calendario', '📝 Exámenes', '✅ Revisión'];

export default function PlanificacionWizard({ onClose, onPlanificacionGuardada }) {
  const { user } = useAuth();

  const [paso,      setPaso]      = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [coloresOcupados, setColoresOcupados] = useState(new Set());

  // Escuelas y cursos
  const [escuelas, setEscuelas] = useState([]);
  const [cursos,   setCursos]   = useState([]);

  // ── Paso 1: datos de materia + unidades ──────────────────────────────────
  const [datosMateria, setDatosMateria] = useState({
    id_escuela:           '',
    id_curso:             '',
    nombre_clase:         '',
    color:                COLORES[0],
    cant_clases:          '',
    duracion:             '',
    contenido_minimo:     '',
    bibliografia_general: '',
    unidades:             [],   // ← NUEVO: array de unidades con contenido
    archivos:             [],
  });

  // ── Paso 2: fechas calculadas automáticamente ─────────────────────────────
  const [fechasCalculadas, setFechasCalculadas] = useState([]);  // string[]
  const [horariosDias, setHorariosDias] = useState({});

  // ── Paso 3: exámenes ──────────────────────────────────────────────────────
  const [examenes, setExamenes] = useState([]);

  // ── Paso 4: clases generadas ──────────────────────────────────────────────
  const [clases, setClases] = useState([]);

  // Carga escuelas al montar
  useEffect(() => {
    const userId = user?.id || user?.id_docente || user?.user?.id;
    proyectosService.getEscuelas(userId).then(setEscuelas).catch(console.error);
    if (!userId) return;
    api.get(`/generar/planificacion/agenda/${userId}`)
      .then(res => {
        const agenda = res.data?.agenda || [];
        setColoresOcupados(new Set(
          agenda
            .filter(plan => plan.estado === 'activa' && plan.color)
            .map(plan => plan.color.toLowerCase())
        ));
      })
      .catch(console.error);
  }, [user]);

  useEffect(() => {
    if (coloresOcupados.has(datosMateria.color?.toLowerCase())) {
      const primerColorLibre = COLORES.find(color => !coloresOcupados.has(color));
      if (primerColorLibre) changeMateria('color', primerColorLibre);
    }
  }, [coloresOcupados]);

  const handleEscuelaChange = async (e) => {
    const escId = e.target.value;
    setDatosMateria(prev => ({ ...prev, id_escuela: escId, id_curso: '' }));
    if (escId) {
      try { setCursos(await proyectosService.getCursosPorEscuela(escId)); }
      catch (_) {}
    } else { setCursos([]); }
  };

  const changeMateria = (field, value) => {
    setDatosMateria(prev => ({ ...prev, [field]: value }));
  };

  // ── Validaciones ──────────────────────────────────────────────────────────
  const validarPaso = () => {
    if (paso === 0) {
      if (!datosMateria.id_curso)     { alert('Seleccioná una materia.');                  return false; }
      if (!datosMateria.nombre_clase) { alert('Completá el nombre de la planificación.'); return false; }
      if (coloresOcupados.has(datosMateria.color?.toLowerCase())) {
        alert('Seleccioná un color disponible para esta planificación.'); return false;
      }
      if (!datosMateria.contenido_minimo) { alert('Completá el contenido mínimo general.'); return false; }
      if (!datosMateria.cant_clases || parseInt(datosMateria.cant_clases) < 1) {
        alert('Indicá la cantidad total de clases.'); return false;
      }
      if (datosMateria.unidades.length === 0) {
        alert('Agregá al menos una unidad con su contenido mínimo.'); return false;
      }
      for (const u of datosMateria.unidades) {
        if (!u.nombre.trim())    { alert(`La Unidad ${u.numero} necesita un nombre.`);     return false; }
        if (!u.contenido.trim()) { alert(`La Unidad ${u.numero} necesita contenido mínimo.`); return false; }
      }
    }
    if (paso === 1) {
      const total = parseInt(datosMateria.cant_clases);
      if (fechasCalculadas.length < total) {
        alert(`Necesitás al menos ${total} fechas disponibles. Ampliá el rango o agregá más días de clase.`);
        return false;
      }
    }
    return true;
  };

  // ── Navegación ────────────────────────────────────────────────────────────
  const siguiente = () => {
    if (!validarPaso()) return;
    if (paso === 2) {
      generarConIA();          // paso 2 → 3: genera con Groq
    } else {
      setPaso(p => p + 1);
    }
  };

  // ── Llamada a Groq ────────────────────────────────────────────────────────
  const generarConIA = async () => {
    setGenerando(true);
    setPaso(3);

    const total = parseInt(datosMateria.cant_clases);

    // ── Agrupar eventos por posición sin descartar coincidencias ─────────────
    const examenPorPosicion = new Map();
    examenes.forEach((ex, i) => {
      const n = parseInt(ex.posicionExamen);
      if (!isNaN(n) && n > 0) {
        examenPorPosicion.set(n, [...(examenPorPosicion.get(n) || []), i + 1]);
      }
    });

    const recupPorPosicion = new Map();
    examenes.forEach((ex, i) => {
      if (ex.tieneRecup && ex.posicionRecuperatorio) {
        const posicion = parseInt(ex.posicionRecuperatorio);
        if (!isNaN(posicion) && posicion > 0) {
          recupPorPosicion.set(posicion, [...(recupPorPosicion.get(posicion) || []), i + 1]);
        }
      }
    });

    // ── Calcular cuántas fechas necesitamos en total ──────────────────────────
    // Necesitamos cubrir hasta la posición más alta (sea clase, examen o recup)
    const posicionesOcupadas = new Set([
      ...Array.from({ length: total }, (_, i) => i + 1),
      ...Array.from(examenPorPosicion.keys()),
      ...Array.from(recupPorPosicion.keys()),
    ]);
    const maxPosicion = Math.max(...posicionesOcupadas, total);
    const fechasClases = fechasCalculadas.slice(0, maxPosicion + 5);

    const obtenerHorarioPorFecha = (fecha) => {
      const dow = new Date(`${fecha}T12:00:00`).getDay();
      return horariosDias[dow] || { hora_inicio: '08:00', hora_fin: '09:00' };
    };

    // ── Marcar recuperatorios por POSICIÓN (más robusto que por fecha) ─────
    const getRecupForPos = (pos) => recupPorPosicion.get(pos) || [];

    const totalRecupPositions = Array.from(recupPorPosicion.values())
      .reduce((totalRecuperatorios, recuperatorios) => totalRecuperatorios + recuperatorios.length, 0);

    // ── Fechas solo para clases normales (IA) ─────────────────────────────────
    const fechasSoloClases = [];
    for (let pos = 1; pos <= maxPosicion; pos++) {
      const fecha = fechasClases[pos - 1];
      if (!fecha) continue;
      if (!examenPorPosicion.has(pos) && getRecupForPos(pos).length === 0) {
        fechasSoloClases.push(fecha);
      }
      if (fechasSoloClases.length >= total - Array.from(examenPorPosicion.values()).flat().length - totalRecupPositions) break;
    }

    try {
      const userId = user?.id || user?.id_docente || user?.user?.id;
      const res = await api.post('/generar/planificacion/distribuir', {
        id_docente:               userId,
        nombre_asignatura:        datosMateria.nombre_clase,
        contenido_minimo_general: datosMateria.contenido_minimo,
        bibliografia_general:     datosMateria.bibliografia_general || '',
        unidades:                 datosMateria.unidades.map(u => ({
          numero:                  u.numero,
          nombre:                  u.nombre,
          contenido:               u.contenido,
          bibliografia_especifica: u.bibliografia_especifica || '',
        })),
        total_clases: fechasSoloClases.length,
        fechas:       fechasSoloClases,
      });
      const clasesIA = res.data?.clases || [];

      // ── Reconstruir cronograma completo ─────────────────────────────────────
      const resultado = [];
      let iaIdx = 0;
      let numClaseReal = 0; // contador de clases normales
      let numExamenReal = 0;
      let numRecuperatorioReal = 0;

      for (let pos = 1; pos <= maxPosicion; pos++) {
        const fecha = fechasClases[pos - 1];
        if (!fecha) continue; // skip si no hay fecha disponible

        const examenesEnPosicion = examenPorPosicion.get(pos) || [];
        const recuperatoriosEnPosicion = getRecupForPos(pos);
        const esExamen = examenesEnPosicion.length > 0;
        const esRecup = recuperatoriosEnPosicion.length > 0;

        if (esExamen) {
          examenesEnPosicion.forEach(numEx => {
            numExamenReal++;
            const horario = obtenerHorarioPorFecha(fecha);
            const ex = examenes[numEx - 1];
            resultado.push({
              numero: pos, numeroTipo: numExamenReal, fecha, tipo: 'examen', numExamen: numEx, unidad: null,
              hora_inicio: horario.hora_inicio || '08:00',
              hora_fin: horario.hora_fin || '09:00',
              tema: `Examen ${numEx}${ex?.temasExamen?.length ? ` — ${ex.temasExamen.join(', ')}` : ''}`,
            });
          });
        }
        if (esRecup) {
          recuperatoriosEnPosicion.forEach(numExRecup => {
            numRecuperatorioReal++;
            const horario = obtenerHorarioPorFecha(fecha);
            resultado.push({
              numero: pos, numeroTipo: numRecuperatorioReal, fecha, tipo: 'recuperatorio', numExamen: numExRecup, unidad: null,
              hora_inicio: horario.hora_inicio || '08:00',
              hora_fin: horario.hora_fin || '09:00',
              tema: `Recuperatorio Examen ${numExRecup}`,
            });
          });
        }
        if (!esExamen && !esRecup) {
          const horario = obtenerHorarioPorFecha(fecha);
          numClaseReal++;
          const claseIA = clasesIA[iaIdx] || {};
          resultado.push({
            numero: pos, numeroTipo: numClaseReal, fecha, tipo: 'clase',
            unidad: claseIA.unidad || null,
            numExamen: null,
            hora_inicio: horario.hora_inicio || '08:00',
            hora_fin: horario.hora_fin || '09:00',
            tema: claseIA.tema || `Clase ${numClaseReal}`,
          });
          iaIdx++;
        }
      }

      setClases(resultado);

    } catch (error) {
      console.error('Error generando con IA:', error);
      // Fallback sin IA
      const resultado = [];
      let iaIdx = 0;
      const totalUnidades = datosMateria.unidades.length || 1;
      let numClaseReal = 0;
      let numExamenReal = 0;
      let numRecuperatorioReal = 0;

      for (let pos = 1; pos <= maxPosicion; pos++) {
        const fecha = fechasClases[pos - 1];
        if (!fecha) continue;

        const examenesEnPosicion = examenPorPosicion.get(pos) || [];
        const recuperatoriosEnPosicion = getRecupForPos(pos);
        const esExamen = examenesEnPosicion.length > 0;
        const esRecup = recuperatoriosEnPosicion.length > 0;

        if (esExamen) {
          examenesEnPosicion.forEach(numEx => {
            numExamenReal++;
            const horario = obtenerHorarioPorFecha(fecha);
            resultado.push({ numero: pos, numeroTipo: numExamenReal, fecha, tipo: 'examen', numExamen: numEx, unidad: null,
              hora_inicio: horario.hora_inicio || '08:00',
              hora_fin: horario.hora_fin || '09:00',
              tema: `Examen ${numEx}` });
          });
        }
        if (esRecup) {
          recuperatoriosEnPosicion.forEach(numExRecup => {
            numRecuperatorioReal++;
            const horario = obtenerHorarioPorFecha(fecha);
            resultado.push({ numero: pos, numeroTipo: numRecuperatorioReal, fecha, tipo: 'recuperatorio', numExamen: numExRecup, unidad: null,
              hora_inicio: horario.hora_inicio || '08:00',
              hora_fin: horario.hora_fin || '09:00',
              tema: `Recuperatorio Examen ${numExRecup}` });
          });
        }
        if (!esExamen && !esRecup) {
          const horario = obtenerHorarioPorFecha(fecha);
          const idxU = Math.floor((iaIdx / Math.max(fechasSoloClases.length, 1)) * totalUnidades);
          const u    = datosMateria.unidades[Math.min(idxU, totalUnidades - 1)];
          numClaseReal++;
          resultado.push({ numero: pos, numeroTipo: numClaseReal, fecha, tipo: 'clase', unidad: u?.numero || 1, numExamen: null,
            hora_inicio: horario.hora_inicio || '08:00',
            hora_fin: horario.hora_fin || '09:00',
            tema: u?.nombre ? `${u.nombre}` : `Clase ${pos}` });
          iaIdx++;
        }
      }
      setClases(resultado);
      alert('⚠️ La IA no pudo generar la distribución. Se usó una distribución básica. Podés editar los temas en la revisión.');
    } finally {
      setGenerando(false);
    }
  };

  // ── Guardar planificación ─────────────────────────────────────────────────
  const handleGuardar = async () => {
    setGuardando(true);
    try {
      const userId = user?.id || user?.id_docente || user?.user?.id;

      // Filtrar clases sin fecha válida antes de enviar
      const clasesValidas = clases.filter(c => c.fecha);
      if (clasesValidas.length === 0) {
        alert('❌ Ninguna clase tiene fecha asignada. Revisá el paso de calendario.');
        setGuardando(false);
        return;
      }

      const combinarFechaHora = (fecha, hora) => {
        const horaNormalizada = hora && hora.length === 5 ? `${hora}:00` : (hora || '08:00:00');
        return `${fecha}T${horaNormalizada}`;
      };

      const payload = {
        id_docente:       userId,
        id_curso:         datosMateria.id_curso,
        nombre_clase:     datosMateria.nombre_clase,
        color:            datosMateria.color || COLORES[0],
        tema:             datosMateria.unidades.map(u => u.nombre).join(' | ') || datosMateria.nombre_clase,
        duracion:         datosMateria.duracion || '',
        contenido_minimo: datosMateria.contenido_minimo || '',
        clases: clasesValidas.map(c => ({
          numero:           c.numero,
          numero_tipo:      c.numeroTipo,
          fecha_programada: combinarFechaHora(c.fecha, c.hora_inicio),
          tema_clase:       c.tema,
          tipo:             c.tipo,
          estado_clase:     'programada',
        })),
        examenes: examenes.map((ex, i) => ({
          numero:              i + 1,
          temas_examen:        ex.temasExamen || [],
          posicion_examen:     ex.posicionExamen ? parseInt(ex.posicionExamen) : null,
          tiene_recuperatorio: ex.tieneRecup || false,
          temas_recuperatorio: ex.temasRecuperatorio || [],
          posicion_recuperatorio: ex.posicionRecuperatorio ? parseInt(ex.posicionRecuperatorio) : null,
        })),
        feriados_excluidos: [],
      };

        const res = await api.post('/generar/planificacion/wizard', payload);
        const idPlan = res.data?.id_planificacion;
        const nombreArchivoBase = (datosMateria.nombre_clase || datosMateria.tema || 'Planificacion').replace(/\s+/g, '_');
        const advertencias = [];

        // Subir archivos adjuntos primero, sin bloquear el guardado si algo falla
        if (datosMateria.archivos?.length > 0) {
          try {
            const fd = new FormData();
            datosMateria.archivos.forEach(f => fd.append('files', f));
            fd.append('id_docente', userId);
            await api.post('/documentos/subir', fd, {
              headers: { 'Content-Type': undefined },
            });
          } catch (uploadErr) {
            console.warn('Archivos no subidos:', uploadErr);
            advertencias.push('los archivos adjuntos no se pudieron subir');
          }
        }

        if (advertencias.length > 0) {
          alert(`✅ ¡Planificación guardada! Ya podés verla en el Calendario.\n⚠️ ${advertencias.join(' y ')}.`);
        } else {
          alert('✅ ¡Planificación guardada! Ya podés verla en el Calendario y descargarla desde Mis Materiales.');
        }
        onPlanificacionGuardada?.(res.data);
        onClose();
    } catch (error) {
      console.error('Error al guardar planificación:', error);
      const detail = error.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map(d => `${d.loc?.join('→')}: ${d.msg}`).join('\n')
        : (typeof detail === 'string' ? detail : 'Error desconocido');
      alert(`❌ No se pudo guardar:\n${msg}`);
    } finally {
      setGuardando(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Inkfree', cursive", color: '#1f2937' }}>

      {/* Step bar */}
      <div style={{ display: 'flex', marginBottom: 20, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)' }}>
        {PASOS.map((label, i) => (
          <div key={i} style={{
            flex: 1, padding: '8px 4px', textAlign: 'center', fontSize: '0.82rem',
            fontWeight: i === paso ? 'bold' : 'normal',
            background: i < paso  ? 'rgba(134,239,172,0.4)'
                      : i === paso ? 'rgba(255,255,255,0.9)'
                      : 'rgba(0,0,0,0.04)',
            color: i < paso  ? '#166534'
                 : i === paso ? '#1e3a8a'
                 : '#94a3b8',
            borderRight: i < PASOS.length - 1 ? '1px solid rgba(0,0,0,0.08)' : 'none',
          }}>
            {i < paso ? '✓ ' : ''}{label}
          </div>
        ))}
      </div>

      {/* Contenido del paso */}
      <div style={{ maxHeight: '52vh', overflowY: 'auto', paddingRight: 4 }}>
        {paso === 0 && (
          <PasoMateria
            data={datosMateria}
            onChange={changeMateria}
            escuelas={escuelas}
            cursos={cursos}
            coloresOcupados={coloresOcupados}
            onEscuelaChange={handleEscuelaChange}
          />
        )}
        {paso === 1 && (
          <PasoCalendario
            totalClases={parseInt(datosMateria.cant_clases) || 0}
            fechasCalculadas={fechasCalculadas}
            setFechasCalculadas={setFechasCalculadas}
            horariosDias={horariosDias}
            setHorariosDias={setHorariosDias}
          />
        )}
        {paso === 2 && (
          <PasoExamenes examenes={examenes} setExamenes={setExamenes} temas={datosMateria.unidades.map(u => u.nombre)} />
        )}
        {paso === 3 && (
          <PasoPreview
            clases={clases}
            setClases={setClases}
            onGuardar={handleGuardar}
            guardando={guardando}
            generando={generando}
          />
        )}
      </div>

      {/* Botones de navegación */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, paddingTop: 14, borderTop: '1px dashed rgba(0,0,0,0.15)' }}>
        <button type="button"
          onClick={paso === 0 ? onClose : () => setPaso(p => p - 1)}
          disabled={generando}
          style={{ ...S.btnPrimary, opacity: generando ? 0.4 : 1 }}>
          {paso === 0 ? '✕ Cancelar' : '‹ Anterior'}
        </button>

        {paso < 3 && (
          <button type="button" onClick={siguiente} disabled={generando}
            style={{ ...S.btnAccent('#f472b6'), opacity: generando ? 0.4 : 1 }}>
            {paso === 2 ? '✨ Generar con IA' : 'Siguiente ›'}
          </button>
        )}
      </div>
    </div>
  );
}