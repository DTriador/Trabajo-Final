// src/views/MisMaterialesView.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import './MisMaterialesView.css';
import { useFileUpload } from '../hooks/useFileUpload';

const ICONOS = {
  pptx: '📊', ppt: '📊',
  docx: '📄', doc: '📄',
  pdf: '📕',
  xlsx: '📈', xls: '📈',
  default: '📎'
};

const MisMaterialesView = ({ onVolver }) => {
  const { user } = useAuth();
  const [materiales, setMateriales]         = useState([]);
  const [cargando, setCargando]             = useState(true);
  const [error, setError]                   = useState(null);
  const [busqueda, setBusqueda]             = useState('');
  const [filtroTipo, setFiltroTipo]         = useState('todos');
  const [activeTab, setActiveTab]           = useState('materiales');
  const [uploading, setUploading]           = useState(false);
  const [planificaciones, setPlanificaciones] = useState([]);
  const [cargandoPlans, setCargandoPlans]   = useState(false);
  const [descargando, setDescargando]       = useState(null); // id de la plan que se está descargando

  const { isDraggingOver, error: uploadError, handleDragEnter, handleDragOver,
          handleDragLeave, handleDrop, setError: setUploadError } = useFileUpload(async (file) => {
    await subirArchivo(file);
  });

  const userId = user?.id || user?.id_docente || user?.user?.id;

  // Cargar materiales al montar
  useEffect(() => {
    const cargar = async () => {
      if (!userId) { setError("No se encontró el ID del docente"); setCargando(false); return; }
      try {
        const res = await api.get(`/proyectos/archivos/${userId}`);
        setMateriales(res.data || []);
      } catch (e) {
        setError(e.response?.data?.detail || e.message);
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, [userId]);

  // Cargar planificaciones cuando se activa esa pestaña
  useEffect(() => {
    if (activeTab !== 'planificaciones') return;
    const cargar = async () => {
      if (!userId) return;
      setCargandoPlans(true);
      try {
        const res = await api.get(`/generar/planificacion/lista/${userId}`);
        setPlanificaciones(res.data || []);
      } catch (e) {
        console.error('Error cargando planificaciones:', e);
      } finally {
        setCargandoPlans(false);
      }
    };
    cargar();
  }, [activeTab, userId]);

  const tipos = useMemo(() => {
    const set = new Set(materiales.map(m => (m.tipo_formato || '').toLowerCase()));
    return ['todos', ...Array.from(set).filter(Boolean)];
  }, [materiales]);

  const materialesFiltrados = useMemo(() => {
    return materiales.filter(m => {
      const matchTipo = filtroTipo === 'todos' || (m.tipo_formato || '').toLowerCase() === filtroTipo;
      const texto = `${m.nombre_archivo || ''} ${m.tema_especifico || ''} ${m.descripcion || ''}`.toLowerCase();
      const matchBusqueda = !busqueda || texto.includes(busqueda.toLowerCase());
      return matchTipo && matchBusqueda;
    });
  }, [materiales, filtroTipo, busqueda]);

  const descargar = async (url, nombre) => {
    try {
      const r = await fetch(url);
      const blob = await r.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl; a.download = nombre;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    }
  };

  const descargarPlan = async (idPlan, nombre, formato) => {
    const key = `${idPlan}-${formato}`;
    setDescargando(key);
    try {
      const res = await api.get(
        `/generar/planificacion/${idPlan}/exportar-${formato}`,
        { responseType: 'blob' }
      );
      const ext = formato === 'word' ? 'docx' : 'pdf';
      const blobUrl = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${nombre.replace(/\s+/g, '_')}.${ext}`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      alert(`No se pudo descargar el ${formato.toUpperCase()}: ${e.response?.data?.detail || e.message}`);
    } finally {
      setDescargando(null);
    }
  };

  const eliminar = async (idArchivo, nombre) => {
    if (!window.confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/proyectos/archivo/${idArchivo}`);
      setMateriales(prev => prev.filter(m => m.id_archivo !== idArchivo));
    } catch (e) {
      alert(`No se pudo eliminar: ${e.response?.data?.detail || e.message}`);
    }
  };

  const compartirWhatsApp = (material) => {
    const texto = `📚 *${material.nombre_archivo}*\n` +
                  (material.tema_especifico ? `📌 Tema: ${material.tema_especifico}\n` : '') +
                  `\n📥 Descargar: ${material.url_descarga}\n\n_Enviado desde Kōkua_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  const subirArchivo = async (file) => {
    setUploading(true);
    setUploadError(null);
    try {
      if (!userId) { alert('No se encontró el ID del docente.'); return; }
      const formData = new FormData();
      formData.append('file', file);
      formData.append('id_docente', userId);
      await api.post('/documentos/subir', formData, { headers: { 'Content-Type': undefined } });
      const res = await api.get(`/proyectos/archivos/${userId}`);
      setMateriales(res.data || []);
      setActiveTab('materiales');
      alert('¡Bibliografía subida! Ya aparece en Mis Materiales.');
    } catch (e) {
      alert(`Error al subir: ${e.response?.data?.detail || e.message}`);
    } finally {
      setUploading(false);
    }
  };

  if (cargando) return <p style={{ padding: 40, color: '#fff', fontSize: '1.5rem' }}>Cargando materiales...</p>;
  if (error)    return <p style={{ padding: 40, color: '#fbbf24' }}>Error: {error}</p>;

  return (
    <div className="materiales-wrapper">
      <div
        className="materiales-container"
        style={{ maxHeight: '76vh', overflowY: 'hidden', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}
      >
        {/* HEADER */}
        <div className="materiales-header">
          <h1 className="materiales-title">📚 Mis Materiales</h1>
          <button onClick={onVolver} className="materiales-btn-volver">⬅ Volver</button>
        </div>

        {/* TABS */}
        <div className="materiales-tabs">
          <button onClick={() => setActiveTab('materiales')}
            className={`tab-btn ${activeTab === 'materiales' ? 'active' : ''}`}>
            📁 Mis Materiales
          </button>
          <button onClick={() => setActiveTab('planificaciones')}
            className={`tab-btn ${activeTab === 'planificaciones' ? 'active' : ''}`}>
            📋 Planificaciones
          </button>
          <button onClick={() => setActiveTab('bibliografia')}
            className={`tab-btn ${activeTab === 'bibliografia' ? 'active' : ''}`}>
            📖 Bibliografía
          </button>
        </div>

        {/* ── TAB: MIS MATERIALES ── */}
        {activeTab === 'materiales' && (
          <>
            <div className="materiales-toolbar">
              <input type="text" placeholder="🔎 Buscar por nombre, tema o descripción..."
                className="materiales-busqueda" value={busqueda}
                onChange={e => setBusqueda(e.target.value)} />
              <div className="materiales-filtros">
                {tipos.map(t => (
                  <button key={t} onClick={() => setFiltroTipo(t)}
                    className={`materiales-chip ${filtroTipo === t ? 'activo' : ''}`}>
                    {t === 'todos' ? '📁 Todos' : `${ICONOS[t] || ICONOS.default} ${t.toUpperCase()}`}
                  </button>
                ))}
              </div>
            </div>
            <div className="materiales-info">
              Mostrando <b>{materialesFiltrados.length}</b> de <b>{materiales.length}</b> materiales
            </div>
            <div className="materiales-scroll"
              style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'thin', scrollbarColor: '#b45309 #fff9c4' }}>
              {materialesFiltrados.length === 0 ? (
                <div className="materiales-vacio">
                  {materiales.length === 0
                    ? 'Todavía no generaste ningún material. ¡Andá a "Herramientas" para crear el primero!'
                    : 'No hay materiales que coincidan con tu búsqueda.'}
                </div>
              ) : (
                <div className="materiales-grid">
                  {materialesFiltrados.map(m => {
                    const tipo  = (m.tipo_formato || 'default').toLowerCase();
                    const icono = ICONOS[tipo] || ICONOS.default;
                    const fecha = m.fecha_creacion ? new Date(m.fecha_creacion).toLocaleDateString('es-AR') : '';
                    return (
                      <div key={m.id_archivo} className="material-card">
                        <div className="material-icono">{icono}</div>
                        <div className="material-tipo-badge">{tipo.toUpperCase()}</div>
                        <h3 className="material-nombre" title={m.nombre_archivo}>{m.nombre_archivo}</h3>
                        {m.tema_especifico && <p className="material-tema">📌 {m.tema_especifico}</p>}
                        {m.descripcion && <p className="material-desc">{m.descripcion}</p>}
                        <div className="material-meta">
                          <span>📅 {fecha}</span>
                          {m.uso_mb && <span>💾 {m.uso_mb} MB</span>}
                        </div>
                        <div className="material-acciones">
                          <button onClick={() => descargar(m.url_descarga, m.nombre_archivo)} className="btn-descargar">⬇ Descargar</button>
                          <button onClick={() => compartirWhatsApp(m)} className="btn-whatsapp" title="Compartir por WhatsApp">💬</button>
                          <button onClick={() => eliminar(m.id_archivo, m.nombre_archivo)} className="btn-eliminar">🗑</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── TAB: PLANIFICACIONES ── */}
        {activeTab === 'planificaciones' && (
          <div className="materiales-scroll"
            style={{ flex: 1, overflowY: 'auto', padding: '16px 4px', scrollbarWidth: 'thin', scrollbarColor: '#b45309 #fff9c4' }}>
            {cargandoPlans ? (
              <p style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>Cargando planificaciones...</p>
            ) : planificaciones.length === 0 ? (
              <div className="materiales-vacio">
                Todavía no guardaste ninguna planificación. ¡Creá una desde el Asistente de Planificación!
              </div>
            ) : (
              <div className="materiales-grid">
                {planificaciones.map(p => {
                  const fecha = p.created_at ? new Date(p.created_at).toLocaleDateString('es-AR') : '';
                  const keyW  = `${p.id}-word`;
                  const keyP  = `${p.id}-pdf`;
                  return (
                    <div key={p.id} className="material-card">
                      <div className="material-icono">📋</div>
                      <div className="material-tipo-badge" style={{ background: '#818cf8' }}>PLAN</div>
                      <h3 className="material-nombre" title={p.nombre_clase}>{p.nombre_clase}</h3>
                      {p.duracion && <p className="material-tema">⏱ {p.duracion}</p>}
                      {p.contenido_minimo && (
                        <p className="material-desc" style={{ fontSize: '0.78rem' }}>
                          {p.contenido_minimo.slice(0, 80)}{p.contenido_minimo.length > 80 ? '…' : ''}
                        </p>
                      )}
                      <div className="material-meta">
                        <span>📅 {fecha}</span>
                        {p.total_clases && <span>🏫 {p.total_clases} clases</span>}
                      </div>
                      <div className="material-acciones" style={{ flexWrap: 'wrap', gap: 6 }}>
                        <button
                          onClick={() => descargarPlan(p.id, p.nombre_clase, 'word')}
                          disabled={descargando === keyW}
                          className="btn-descargar"
                          style={{ background: '#2563eb', fontSize: '0.8rem', opacity: descargando === keyW ? 0.6 : 1 }}
                        >
                          {descargando === keyW ? '⏳ Word...' : '📄 Word'}
                        </button>
                        <button
                          onClick={() => descargarPlan(p.id, p.nombre_clase, 'pdf')}
                          disabled={descargando === keyP}
                          className="btn-descargar"
                          style={{ background: '#dc2626', fontSize: '0.8rem', opacity: descargando === keyP ? 0.6 : 1 }}
                        >
                          {descargando === keyP ? '⏳ PDF...' : '📕 PDF'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: BIBLIOGRAFÍA ── */}
        {activeTab === 'bibliografia' && (
          <div className="bibliografia-section">
            <h2>📖 Bibliografía</h2>
            <p>Carga PDFs para usar como base para generar clases.</p>
            <div
              className={`file-upload-zone ${isDraggingOver ? 'dragging' : ''}`}
              onDragEnter={handleDragEnter} onDragOver={handleDragOver}
              onDragLeave={handleDragLeave} onDrop={handleDrop}
            >
              <div className="upload-content">
                <div className="upload-icon">📄</div>
                <p className="upload-text">{uploading ? 'Subiendo...' : 'Arrastra un PDF aquí o haz clic para seleccionar'}</p>
                <input type="file" accept=".pdf" style={{ display: 'none' }} id="file-input"
                  onChange={e => { const f = e.target.files[0]; if (f) subirArchivo(f); }} />
                <label htmlFor="file-input" className="upload-btn">Seleccionar Archivo</label>
              </div>
            </div>
            {uploadError && <p className="error-text">{uploadError}</p>}
          </div>
        )}

      </div>
    </div>
  );
};

export default MisMaterialesView;