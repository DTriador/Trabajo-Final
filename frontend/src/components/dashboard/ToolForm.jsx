// src/components/dashboard/ToolForm.jsx
import React from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

// Herramientas que requieren selección de escuela/materia
const TOOLS_CON_ESCUELA = [
  'apunte', 'preguntas', 'examen', 'podcast',
  'sopa_letras', 'crucigrama', 'unir_flechas',
];
// Tools que muestran el selector de fuente (bibliografía / PDF)
const TOOLS_CON_FUENTE = [
  'apunte', 'preguntas', 'podcast',
  'sopa_letras', 'crucigrama', 'unir_flechas',
];

const ToolForm = ({ tool, formData, setFormData, escuelas, cursos, handleEscuelaChange, onClose }) => {
  const { useAuth: _u, ..._ } = { useAuth };
  const { user } = useAuth();

  // Cuando se selecciona una materia, auto-poblar materia_examen
  const handleCursoChange = (e) => {
    const cursoId = e.target.value;
    const cursoSel = cursos.find(c => c.id_curso === cursoId);
    setFormData(prev => ({
      ...prev,
      id_curso: cursoId,
      ...(tool.id === 'examen' && cursoSel
        ? { materia_examen: cursoSel.nombre_materia }
        : {}),
    }));
  };

  const handleGenerar = async () => {
    const userId = user?.id || user?.id_docente || user?.user?.id;
    alert(`Iniciando generación de ${tool.title}... Kōkua está trabajando.`);
    onClose();

    try {
      let res;

      // ── planificacion ──────────────────────────────────────────────────────
      if (tool.id === 'planificacion') {
        const payload = new FormData();
        payload.append('id_docente', userId);
        payload.append('id_escuela', formData.id_escuela);
        payload.append('id_curso', formData.id_curso);
        payload.append('nombre_clase', formData.nombre_clase);
        payload.append('fecha', formData.fecha);
        payload.append('duracion', formData.duracion);
        payload.append('tema', formData.tema);
        if (formData.pdf) payload.append('file', formData.pdf);
        res = await api.post(`/generar/planificacion`, payload, { headers: { 'Content-Type': 'multipart/form-data' } });
      }

      // ── presentacion ───────────────────────────────────────────────────────
      else if (tool.id === 'presentacion') {
        const payload = new FormData();
        payload.append('tema', formData.nombre_presentacion || formData.tema);
        payload.append('id_docente', userId);
        if (formData.pdf) payload.append('file', formData.pdf);
        res = await api.post(`/generar/presentacion`, payload, { headers: { 'Content-Type': 'multipart/form-data' } });
      }

      // ── apunte ─────────────────────────────────────────────────────────────
      else if (tool.id === 'apunte') {
        if (formData.fuente_contenido === 'pdf' && !formData.pdf) {
          alert('Seleccionaste "Subir PDF" pero no adjuntaste ningún archivo.'); return;
        }
        const payload = new FormData();
        payload.append('tema', formData.tema);
        payload.append('id_docente', userId);
        payload.append('id_escuela', formData.id_escuela || '');
        payload.append('id_curso', formData.id_curso || '');
        payload.append('fecha', formData.fecha || '');
        if (formData.fuente_contenido === 'pdf' && formData.pdf) payload.append('file', formData.pdf);
        res = await api.post(`/generar/apunte`, payload, { headers: { 'Content-Type': 'multipart/form-data' } });
      }

      // ── preguntas ──────────────────────────────────────────────────────────
      else if (tool.id === 'preguntas') {
        if (formData.fuente_contenido === 'pdf' && !formData.pdf) {
          alert('Seleccionaste "Subir PDF" pero no adjuntaste ningún archivo.'); return;
        }
        const payload = new FormData();
        payload.append('tema', formData.tema);
        payload.append('id_docente', userId);
        payload.append('nombre_guia', formData.nombre_guia);
        payload.append('numero_preguntas', formData.numero_preguntas);
        payload.append('id_escuela', formData.id_escuela || '');
        payload.append('id_curso', formData.id_curso || '');
        payload.append('fecha', formData.fecha || '');
        if (formData.fuente_contenido === 'pdf' && formData.pdf) payload.append('file', formData.pdf);
        res = await api.post(`/generar/preguntas`, payload, { headers: { 'Content-Type': 'multipart/form-data' } });
      }

      // ── examen ─────────────────────────────────────────────────────────────
      else if (tool.id === 'examen') {
        const tipos = formData.examen_tipos;
        const algunoActivo = Object.values(tipos).some(t => t.activo && t.cantidad > 0);
        if (!algunoActivo) { alert("Marcá al menos una actividad e indicá la cantidad de ítems."); return; }
        const payload = new FormData();
        payload.append('id_docente', userId);
        payload.append('id_escuela', formData.id_escuela || '');
        payload.append('id_curso',   formData.id_curso   || '');
        payload.append('materia',    formData.materia_examen || '');
        payload.append('fecha_examen', formData.fecha_examen);
        payload.append('tipos', JSON.stringify(tipos));
        if (formData.pdf) payload.append('file', formData.pdf);
        res = await api.post(`/generar/examen`, payload, { headers: { 'Content-Type': 'multipart/form-data' } });
      }

      // ── podcast ────────────────────────────────────────────────────────────
      else if (tool.id === 'podcast') {
        if (formData.fuente_contenido === 'pdf' && !formData.pdf) {
          alert('Seleccionaste "Subir PDF" pero no adjuntaste ningún archivo.'); return;
        }
        const payload = new FormData();
        payload.append('tema', formData.tema);
        payload.append('id_docente', userId);
        payload.append('id_escuela', formData.id_escuela || '');
        payload.append('id_curso',   formData.id_curso   || '');
        payload.append('fecha', '');
        if (formData.fuente_contenido === 'pdf' && formData.pdf) payload.append('file', formData.pdf);
        res = await api.post(`/generar/podcast`, payload, { headers: { 'Content-Type': 'multipart/form-data' } });
      }

      // ── sopa_letras ────────────────────────────────────────────────────────
      else if (tool.id === 'sopa_letras') {
        if (formData.fuente_contenido === 'pdf' && !formData.pdf) {
          alert('Seleccionaste "Subir PDF" pero no adjuntaste ningún archivo.'); return;
        }
        const payload = new FormData();
        payload.append('id_docente', userId);
        payload.append('tema', formData.tema || '');
        payload.append('numero_palabras', formData.numero_palabras || 10);
        payload.append('mostrar_lista', formData.mostrar_lista_palabras ? 'true' : 'false');
        payload.append('id_escuela', formData.id_escuela || '');
        payload.append('id_curso', formData.id_curso || '');
        payload.append('fecha', '');
        if (formData.fuente_contenido === 'pdf' && formData.pdf) payload.append('file', formData.pdf);
        res = await api.post(`/generar/sopa_letras`, payload, { headers: { 'Content-Type': 'multipart/form-data' } });
      }

      // ── crucigrama ─────────────────────────────────────────────────────────
      else if (tool.id === 'crucigrama') {
        if (formData.fuente_contenido === 'pdf' && !formData.pdf) {
          alert('Seleccionaste "Subir PDF" pero no adjuntaste ningún archivo.');
          return;
        }
        const payload = new FormData();
        payload.append('id_docente', userId);
        payload.append('tema', formData.tema || '');
        payload.append('palabras_horizontales', formData.palabras_horizontales || 5);
        payload.append('palabras_verticales', formData.palabras_verticales || 5);
        payload.append('id_escuela', formData.id_escuela || '');
        payload.append('id_curso', formData.id_curso || '');
        payload.append('fecha', '');
        if (formData.fuente_contenido === 'pdf' && formData.pdf) payload.append('file', formData.pdf);
        res = await api.post(`/generar/crucigrama`, payload, { headers: { 'Content-Type': 'multipart/form-data' } });
      }

      // ── unir_flechas ───────────────────────────────────────────────────────
      else if (tool.id === 'unir_flechas') {
        if (formData.fuente_contenido === 'pdf' && !formData.pdf) {
          alert('Seleccionaste "Subir PDF" pero no adjuntaste ningún archivo.');
          return;
        }
        const payload = new FormData();
        payload.append('id_docente', userId);
        payload.append('tema', formData.tema || '');
        payload.append('numero_pares', formData.numero_pares || 8);
        payload.append('id_escuela', formData.id_escuela || '');
        payload.append('id_curso', formData.id_curso || '');
        payload.append('fecha', '');
        if (formData.fuente_contenido === 'pdf' && formData.pdf) payload.append('file', formData.pdf);
        res = await api.post(`/generar/unir_flechas`, payload, { headers: { 'Content-Type': 'multipart/form-data' } });
      }

      else {
        res = await api.post(`/generar/${tool.id}?tema=${formData.tema}&id_docente=${userId}`);
      }

      if (res?.data?.status === "success") {
        alert(`¡Listo! El archivo se ha guardado en tu biblioteca.`);
        if (res.data.download_url) window.open(res.data.download_url, '_blank');
      }
    } catch (err) {
      console.error("Error en el pipeline de generación:", err);
      const detail = err.response?.data?.detail;
      alert(`Error ${err.response?.status}: ${typeof detail === 'object' ? JSON.stringify(detail) : detail}`);
    }
  };

  const inputClass  = "w-full bg-white/10 border-2 border-white/20 p-3 rounded-xl text-xl outline-none focus:border-[#7afcff] text-white placeholder-white/50";
  const selectClass = "bg-white/10 border-2 border-white/20 p-3 rounded-xl text-xl text-white outline-none focus:border-[#7afcff]";

  // ── Bloque reutilizable: selección Institución + Materia ──────────────────
  const SelectEscuelaCurso = () => (
    <div className="grid grid-cols-2 gap-4">
      <select className={selectClass} value={formData.id_escuela} onChange={handleEscuelaChange} required>
        <option value="" className="text-black">🏫 Seleccionar Institución...</option>
        {escuelas.map(e => (
          <option key={e.id_escuela} value={e.id_escuela} className="text-black">{e.nombre_escuela}</option>
        ))}
      </select>
      <select className={selectClass} value={formData.id_curso} onChange={handleCursoChange}
            required disabled={!formData.id_escuela}>
        <option value="" className="text-black">📖 Seleccionar Materia...</option>
        {cursos.map(c => (
          <option key={c.id_curso} value={c.id_curso} className="text-black">
                {c.nombre_materia} - {c.division}
          </option>
        ))}
      </select>
    </div>
  );

  // ── Bloque reutilizable: fuente de contenido (bibliografía vs PDF) ─────────
  const FuenteContenido = () => (
    <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: '14px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <p style={{ color: 'white', fontWeight: 'bold', fontSize: '1.15rem', margin: 0 }}>
        📚 Fuente de contenido
      </p>
      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'white', fontSize: '1.1rem', cursor: 'pointer' }}>
        <input type="radio" name={`fuente_${tool.id}`} value="bibliografia"
          checked={formData.fuente_contenido === 'bibliografia'}
          onChange={() => setFormData({ ...formData, fuente_contenido: 'bibliografia', pdf: null })}
          style={{ accentColor: '#7afcff', width: '18px', height: '18px' }} />
        Usar bibliografía adjunta de la materia seleccionada
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'white', fontSize: '1.1rem', cursor: 'pointer' }}>
        <input type="radio" name={`fuente_${tool.id}`} value="pdf"
          checked={formData.fuente_contenido === 'pdf'}
          onChange={() => setFormData({ ...formData, fuente_contenido: 'pdf' })}
          style={{ accentColor: '#7afcff', width: '18px', height: '18px' }} />
        Subir un PDF como base
      </label>
      {formData.fuente_contenido === 'pdf' && (
        <label className="cursor-pointer bg-white/10 border-2 border-white/20 px-6 py-3 rounded-xl text-lg text-white text-center" style={{ marginTop: '4px' }}>
          {formData.pdf ? `📎 ${formData.pdf.name}` : '📤 Seleccionar PDF...'}
          <input type="file" style={{ display: 'none' }} accept=".pdf"
            onChange={e => setFormData({ ...formData, pdf: e.target.files[0] })} />
        </label>
      )}
    </div>
  );

  // ── Bloque reutilizable: solo fecha ───────────────────────────────────────
  // El nombre del alumno NO se ingresa acá; queda en blanco en el documento
  // para que el alumno lo complete a mano.
  const SoloFecha = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={{ color: 'white', fontSize: '1.2rem', marginLeft: '8px' }}>Fecha</label>
      <input type="date" className={inputClass}
        value={formData.fecha || ''}
        onChange={e => setFormData({ ...formData, fecha: e.target.value })} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Institución + Curso (planificacion y presentacion) ────────────── */}
      {(tool.id === 'planificacion' || tool.id === 'presentacion') && (
        <div className="grid grid-cols-2 gap-4">
          <select className={selectClass} value={formData.id_escuela} onChange={handleEscuelaChange} required>
            <option value="" className="text-black">🏫 Seleccionar Institución...</option>
            {escuelas.map(e => (
              <option key={e.id_escuela} value={e.id_escuela} className="text-black">{e.nombre_escuela}</option>
            ))}
          </select>
          <select className={selectClass} value={formData.id_curso}
            onChange={e => setFormData({ ...formData, id_curso: e.target.value })}
            required disabled={!formData.id_escuela}>
            <option value="" className="text-black">📖 Seleccionar Materia...</option>
            {cursos.map(c => (
              <option key={c.id_curso} value={c.id_curso} className="text-black">
                {c.nombre_materia} — {c.division}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ── Institución + Curso (TOOLS_CON_ESCUELA) ───────────────────────── */}
      {TOOLS_CON_ESCUELA.includes(tool.id) && <SelectEscuelaCurso />}

      {/* ════════════════════════════════════════════════════════════════════
          EXAMEN
         ════════════════════════════════════════════════════════════════════ */}
      {tool.id === 'examen' && (
        <>
          {/* Fecha del examen */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ color: 'white', fontSize: '1.2rem', marginLeft: '8px' }}>Fecha del examen</label>
            <input type="date" required className={inputClass}
              value={formData.fecha_examen}
              onChange={e => setFormData({ ...formData, fecha_examen: e.target.value })} />
          </div>

          {/* Campo materia libre */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ color: 'white', fontSize: '1.2rem', marginLeft: '8px' }}>
              Materia{' '}
              <span style={{ fontWeight: 'normal', fontSize: '0.95rem', opacity: 0.6 }}>(nombre para el encabezado del examen)</span>
            </label>
            <input type="text" placeholder="Ej: Historia Contemporánea" className={inputClass}
              value={formData.materia_examen}
              onChange={e => setFormData({ ...formData, materia_examen: e.target.value })} />
          </div>

          {/* PDF base (opcional) */}
          <label className="cursor-pointer bg-white/10 border-2 border-white/20 px-6 py-3 rounded-xl text-lg text-white text-center">
            {formData.pdf ? `📎 ${formData.pdf.name}` : '📤 Subir PDF base del examen (opcional)'}
            <input type="file" style={{ display: 'none' }} accept=".pdf"
              onChange={e => setFormData({ ...formData, pdf: e.target.files[0] })} />
          </label>

          {/* Tabla de tipos de actividades */}
          <div style={{ border: '2px solid rgba(255,255,255,0.2)', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '120px 1fr 160px',
              backgroundColor: 'rgba(255,255,255,0.08)',
              padding: '12px',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              color: 'white',         // ← blanco
            }}>
              <div>Seleccionar</div><div>Actividad</div><div style={{ textAlign: 'center' }}>Cantidad de ítems</div>
            </div>
            {[
              { key: 'desarrollo',      label: 'Enunciados de desarrollo' },
              { key: 'multiple',        label: 'Multiple choice' },
              { key: 'completar',       label: 'Completar la frase' },
              { key: 'verdadero_falso', label: 'Verdadero y falso' },
            ].map(row => {
              const item = formData.examen_tipos[row.key];
              return (
                <div key={row.key} style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr 160px',
                  alignItems: 'center',
                  padding: '12px',
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                  color: 'white',     // ← blanco
                }}>
                  <input type="checkbox"
                    style={{ width: '24px', height: '24px', accentColor: '#ff7eb9', justifySelf: 'center' }}
                    checked={item.activo}
                    onChange={e => setFormData({
                      ...formData,
                      examen_tipos: {
                        ...formData.examen_tipos,
                        [row.key]: { activo: e.target.checked, cantidad: e.target.checked && item.cantidad === 0 ? 1 : item.cantidad },
                      },
                    })} />
                  <div style={{ fontSize: '1.15rem' }}>{row.label}</div>
                  <input type="number" min={0} max={50} disabled={!item.activo}
                    className="bg-white/10 border-2 border-white/20 p-2 rounded-lg text-lg text-white outline-none focus:border-[#7afcff] text-center disabled:opacity-40"
                    value={item.cantidad}
                    onChange={e => {
                      const v = Math.max(0, Math.min(50, Number(e.target.value) || 0));
                      setFormData({ ...formData, examen_tipos: { ...formData.examen_tipos, [row.key]: { ...item, cantidad: v } } });
                    }} />
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          PODCAST
         ════════════════════════════════════════════════════════════════════ */}
      {tool.id === 'podcast' && (
        <>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.1rem', margin: 0 }}>
            Kōkua va a generar un guión de podcast educativo listo para grabar.
            Podés usar la bibliografía de la materia o subir un PDF propio.
          </p>
          <FuenteContenido />
        </>
      )}

      {/* ── Campos específicos de planificacion ───────────────────────────── */}
      {tool.id === 'planificacion' && (
        <>
          <input type="text" required placeholder="Nombre de la clase" className={inputClass}
            value={formData.nombre_clase}
            onChange={e => setFormData({ ...formData, nombre_clase: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ color: 'white', fontSize: '1.2rem', marginLeft: '8px' }}>Fecha de la clase</label>
              <input type="date" required className={inputClass}
                value={formData.fecha}
                onChange={e => setFormData({ ...formData, fecha: e.target.value })} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ color: 'white', fontSize: '1.2rem', marginLeft: '8px' }}>Duración</label>
              <input type="text" required placeholder="Ej: 80 min" className={inputClass}
                value={formData.duracion}
                onChange={e => setFormData({ ...formData, duracion: e.target.value })} />
            </div>
          </div>
        </>
      )}

      {/* ── Campo específico de presentacion ──────────────────────────────── */}
      {tool.id === 'presentacion' && (
        <input type="text" required placeholder="Nombre de la presentación" className={inputClass}
          value={formData.nombre_presentacion}
          onChange={e => setFormData({ ...formData, nombre_presentacion: e.target.value })} />
      )}

      {/* ── Campos específicos de preguntas ───────────────────────────────── */}
      {tool.id === 'preguntas' && (
        <>
          <input type="text" required placeholder="Nombre de la guía" className={inputClass}
            value={formData.nombre_guia}
            onChange={e => setFormData({ ...formData, nombre_guia: e.target.value })} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ color: 'white', fontSize: '1.2rem', marginLeft: '8px' }}>Cantidad de preguntas (1 a 25)</label>
            <input type="number" required min={1} max={25} className={inputClass}
              value={formData.numero_preguntas}
              onChange={e => {
                const v = Math.max(1, Math.min(25, Number(e.target.value) || 1));
                setFormData({ ...formData, numero_preguntas: v });
              }} />
          </div>
        </>
      )}

      {/* ── Campos específicos de sopa_letras ─────────────────────────────── */}
      {tool.id === 'sopa_letras' && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ color: 'white', fontSize: '1.2rem', marginLeft: '8px' }}>Cantidad de palabras a esconder (5 a 25)</label>
            <input type="number" min={5} max={25} className={inputClass}
              value={formData.numero_palabras}
              onChange={e => {
                const v = Math.max(5, Math.min(25, Number(e.target.value) || 10));
                setFormData({ ...formData, numero_palabras: v });
              }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'black', fontSize: '1.1rem', marginLeft: '8px' }}>
            <input type="checkbox"
              checked={formData.mostrar_lista_palabras}
              onChange={e => setFormData({ ...formData, mostrar_lista_palabras: e.target.checked })} />
            Mostrar la lista de palabras debajo de la sopa
          </label>
        </>
      )}

      {/* ── Campos específicos de crucigrama ──────────────────────────────── */}
      {tool.id === 'crucigrama' && (
        <div className="grid grid-cols-2 gap-4">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ color: 'white', fontSize: '1.2rem', marginLeft: '8px' }}>Palabras horizontales (2 a 12)</label>
            <input type="number" min={2} max={12} className={inputClass}
              value={formData.palabras_horizontales}
              onChange={e => {
                const v = Math.max(2, Math.min(12, Number(e.target.value) || 5));
                setFormData({ ...formData, palabras_horizontales: v });
              }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ color: 'white', fontSize: '1.2rem', marginLeft: '8px' }}>Palabras verticales (2 a 12)</label>
            <input type="number" min={2} max={12} className={inputClass}
              value={formData.palabras_verticales}
              onChange={e => {
                const v = Math.max(2, Math.min(12, Number(e.target.value) || 5));
                setFormData({ ...formData, palabras_verticales: v });
              }} />
          </div>
        </div>
      )}

      {/* ── Campos específicos de unir_flechas ────────────────────────────── */}
      {tool.id === 'unir_flechas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ color: 'white', fontSize: '1.2rem', marginLeft: '8px' }}>Cantidad de pares (4 a 12)</label>
          <input type="number" min={4} max={12} className={inputClass}
            value={formData.numero_pares}
            onChange={e => {
              const v = Math.max(4, Math.min(12, Number(e.target.value) || 8));
              setFormData({ ...formData, numero_pares: v });
            }} />
        </div>
      )}

      {/* ── Campo TEMA (todos excepto examen) ─────────────────────────────── */}
      {tool.id !== 'examen' && (
        <div className="flex items-center gap-4">
          <input type="text" required
            placeholder={
              tool.id === 'apunte'       ? "Tema del apunte..." :
              tool.id === 'podcast'      ? "Tema del podcast educativo..." :
              tool.id === 'sopa_letras'  ? "Tema de la sopa de letras..." :
              tool.id === 'crucigrama'   ? "Tema del crucigrama..." :
              tool.id === 'unir_flechas' ? "Tema de la actividad..." :
              "Tema principal..."
            }
            className="flex-1 bg-black/10 border-2 border-black/20 p-3 rounded-xl text-xl outline-none focus:border-[#7afcff] placeholder-black/50"
            style={{ color: 'black' }}
            value={formData.tema}
            onChange={e => setFormData({ ...formData, tema: e.target.value })}
          />
          {/* PDF inline solo para planificacion y presentacion */}
          {['planificacion', 'presentacion'].includes(tool.id) && (
            <label className="cursor-pointer bg-black text-black border-2 border-black px-6 py-3 rounded-xl text-lg font-bold whitespace-nowrap">
              📎 PDF
              <input type="file" style={{ display: 'none' }} accept=".pdf"
                onChange={e => setFormData({ ...formData, pdf: e.target.files[0] })} />
            </label>
          )}
        </div>
      )}

      {/* ── Fuente de contenido (apunte, preguntas, sopa, crucigrama, flechas) */}
      {TOOLS_CON_ESCUELA.includes(tool.id) && tool.id !== 'examen' && tool.id !== 'podcast' && (
        <FuenteContenido />
      )}

      {/* ── Solo fecha (apunte, preguntas, sopa, crucigrama, flechas, podcast) */}
      {/* El nombre del alumno queda en blanco en el doc para que lo complete el alumno */}
      {['apunte', 'preguntas'].includes(tool.id) && (
        <SoloFecha />
      )}

      {/* ── Botones ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '10px' }}>
        <button type="button" onClick={onClose}
          style={{ borderRadius: '50px', padding: '12px 35px', border: '2px solid #9ca3af', backgroundColor: 'transparent', color: '#d1d5db', fontSize: '1.2rem', cursor: 'pointer', fontWeight: 'bold' }}>
          Cancelar
        </button>
        <button type="button" onClick={handleGenerar}
          style={{ borderRadius: '50px', padding: '12px 35px', backgroundColor: '#ff7eb9', border: 'none', color: 'white', fontSize: '1.2rem', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(255,126,185,0.4)' }}>
          Empezar Magia ✨
        </button>
      </div>
    </div>
  );
};

export default ToolForm;