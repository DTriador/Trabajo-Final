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

const PASOS = ['📚 Materia', '📅 Calendario', '📝 Exámenes', '✅ Revisión'];

export default function PlanificacionWizard({ onClose, onPlanificacionGuardada }) {
  const { user } = useAuth();

  const [paso,      setPaso]      = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [generando, setGenerando] = useState(false);

  // Escuelas y cursos
  const [escuelas, setEscuelas] = useState([]);
  const [cursos,   setCursos]   = useState([]);

  // ── Paso 1: datos de materia + unidades ──────────────────────────────────
  const [datosMateria, setDatosMateria] = useState({
    id_escuela:           '',
    id_curso:             '',
    nombre_clase:         '',
    cant_clases:          '',
    duracion:             '',
    contenido_minimo:     '',
    bibliografia_general: '',
    unidades:             [],   // ← NUEVO: array de unidades con contenido
    archivos:             [],
  });

  // ── Paso 2: fechas calculadas automáticamente ─────────────────────────────
  const [fechasCalculadas, setFechasCalculadas] = useState([]);  // string[]

  // ── Paso 3: exámenes ──────────────────────────────────────────────────────
  const [examenes, setExamenes] = useState([]);

  // ── Paso 4: clases generadas ──────────────────────────────────────────────
  const [clases, setClases] = useState([]);

  // Carga escuelas al montar
  useEffect(() => {
    const userId = user?.id || user?.id_docente || user?.user?.id;
    proyectosService.getEscuelas(userId).then(setEscuelas).catch(console.error);
  }, [user]);

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

    // ── Construir mapas de exámenes con UNA sola posición por examen ──────────
    const examenPorClase = new Map();
    examenes.forEach((ex, i) => {
      const n = parseInt(ex.numeroClaseExamen);
      if (!isNaN(n) && n > 0) examenPorClase.set(n, i + 1);
    });

    const recupPorExamen = new Map();
    examenes.forEach((ex, i) => {
      if (ex.tieneRecup && ex.clasesRecupDesde && ex.clasesRecupHasta) {
        recupPorExamen.set(i + 1, {
          desde: parseInt(ex.clasesRecupDesde),
          hasta: parseInt(ex.clasesRecupHasta),
        });
      }
    });

    // ── Calcular cuántas fechas necesitamos en total ──────────────────────────
    // Necesitamos cubrir hasta la posición más alta (sea clase, examen o recup)
    const posicionesOcupadas = new Set([
      ...Array.from({ length: total }, (_, i) => i + 1),
      ...Array.from(examenPorClase.keys()),
      ...Array.from(recupPorExamen.values()).flatMap(r =>
        Array.from({ length: r.hasta - r.desde + 1 }, (_, i) => r.desde + i)
      ),
    ]);
    const maxPosicion = Math.max(...posicionesOcupadas, total);
    const fechasClases = fechasCalculadas.slice(0, maxPosicion + 5);

    // ── Marcar fechas de recuperatorios ───────────────────────────────────────
    const fechasRecup = new Map(); // fecha → numExamen
    recupPorExamen.forEach((rango, numEx) => {
      for (let pos = rango.desde; pos <= rango.hasta; pos++) {
        const fecha = fechasClases[pos - 1];
        if (fecha) fechasRecup.set(fecha, numEx);
      }
    });

    // ── Fechas solo para clases normales (IA) ─────────────────────────────────
    const fechasSoloClases = [];
    for (let pos = 1; pos <= maxPosicion; pos++) {
      const fecha = fechasClases[pos - 1];
      if (!fecha) continue;
      if (!examenPorClase.has(pos) && !fechasRecup.has(fecha)) {
        fechasSoloClases.push(fecha);
      }
      if (fechasSoloClases.length >= total - examenPorClase.size - fechasRecup.size) break;
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

      for (let pos = 1; pos <= maxPosicion && resultado.length < maxPosicion; pos++) {
        const fecha = fechasClases[pos - 1];
        if (!fecha) continue; // skip si no hay fecha disponible

        const esExamen = examenPorClase.has(pos);
        const numEx    = esExamen ? examenPorClase.get(pos) : null;
        const esRecup  = fechasRecup.has(fecha) && !esExamen;
        const numExRecup = esRecup ? fechasRecup.get(fecha) : null;

        if (esExamen) {
          const ex = examenes[numEx - 1];
          resultado.push({
            numero: pos, fecha, tipo: 'examen', numExamen: numEx, unidad: null,
            tema: `Examen ${numEx}${ex?.clasesExamen ? ` — ${ex.clasesExamen}` : ''}`,
          });
        } else if (esRecup) {
          resultado.push({
            numero: pos, fecha, tipo: 'recuperatorio', numExamen: numExRecup, unidad: null,
            tema: `Recuperatorio Examen ${numExRecup}`,
          });
        } else {
          numClaseReal++;
          const claseIA = clasesIA[iaIdx] || {};
          resultado.push({
            numero: pos, fecha, tipo: 'clase',
            unidad: claseIA.unidad || null,
            numExamen: null,
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

      for (let pos = 1; pos <= maxPosicion; pos++) {
        const fecha = fechasClases[pos - 1];
        if (!fecha) continue;

        const esExamen = examenPorClase.has(pos);
        const numEx    = esExamen ? examenPorClase.get(pos) : null;
        const esRecup  = fechasRecup.has(fecha) && !esExamen;
        const numExRecup = esRecup ? fechasRecup.get(fecha) : null;

        if (esExamen) {
          resultado.push({ numero: pos, fecha, tipo: 'examen', numExamen: numEx, unidad: null,
            tema: `Examen ${numEx}` });
        } else if (esRecup) {
          resultado.push({ numero: pos, fecha, tipo: 'recuperatorio', numExamen: numExRecup, unidad: null,
            tema: `Recuperatorio Examen ${numExRecup}` });
        } else {
          const idxU = Math.floor((iaIdx / Math.max(fechasSoloClases.length, 1)) * totalUnidades);
          const u    = datosMateria.unidades[Math.min(idxU, totalUnidades - 1)];
          resultado.push({ numero: pos, fecha, tipo: 'clase', unidad: u?.numero || 1, numExamen: null,
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
      const clasesValidas = clases.filter(c => c.fecha && c.fecha.length === 10);
      if (clasesValidas.length === 0) {
        alert('❌ Ninguna clase tiene fecha asignada. Revisá el paso de calendario.');
        setGuardando(false);
        return;
      }

      const payload = {
        id_docente:       userId,
        id_curso:         datosMateria.id_curso,
        nombre_clase:     datosMateria.nombre_clase,
        tema:             datosMateria.unidades.map(u => u.nombre).join(' | ') || datosMateria.nombre_clase,
        duracion:         datosMateria.duracion || '',
        contenido_minimo: datosMateria.contenido_minimo || '',
        clases: clasesValidas.map(c => ({
          numero:           c.numero,
          fecha_programada: c.fecha,
          tema_clase:       c.tema,
          tipo:             c.tipo,
          estado_clase:     'programada',
        })),
        examenes: examenes.map((ex, i) => ({
          numero:              i + 1,
          clases_examen:       ex.clasesExamen || '',
          tiene_recuperatorio: ex.tieneRecup || false,
          clases_recup_desde:  ex.clasesRecupDesde ? parseInt(ex.clasesRecupDesde) : null,
          clases_recup_hasta:  ex.clasesRecupHasta ? parseInt(ex.clasesRecupHasta) : null,
        })),
        feriados_excluidos: [],
      };

        const res = await api.post('/generar/planificacion/wizard', payload);

        // Subir archivos — en bloque separado para no cancelar el guardado si falla
        if (datosMateria.archivos?.length > 0) {
          try {
            const fd = new FormData();
            datosMateria.archivos.forEach(f => fd.append('files', f));
            await api.post(`/documentos/subir`, fd, {
              headers: { 'Content-Type': undefined },
              params: { id_docente: userId },
            });
          } catch (uploadErr) {
            console.warn('Archivos no subidos:', uploadErr);
            // Avisamos pero no bloqueamos — la planificación ya está guardada
            alert('✅ ¡Planificación guardada!\n⚠️ Los archivos adjuntos no se pudieron subir. Podés subirlos desde "Mis Materiales".');
            onPlanificacionGuardada?.(res.data);
            onClose();
            return;
          }
        }

        alert('✅ ¡Planificación guardada! Ya podés verla en el Calendario.');
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
            onEscuelaChange={handleEscuelaChange}
          />
        )}
        {paso === 1 && (
          <PasoCalendario
            totalClases={parseInt(datosMateria.cant_clases) || 0}
            fechasCalculadas={fechasCalculadas}
            setFechasCalculadas={setFechasCalculadas}
          />
        )}
        {paso === 2 && (
          <PasoExamenes examenes={examenes} setExamenes={setExamenes} />
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