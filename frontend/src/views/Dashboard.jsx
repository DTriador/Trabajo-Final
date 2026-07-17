// src/views/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { LogOut } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import MisMaterialesView from './MisMaterialesView';
import fondoHojaAssets from '../assets/img/fondo-hoja.png';

import WelcomePostit    from '../components/dashboard/WelcomePostit';
import StorageSticker   from '../components/dashboard/StorageSticker';
import ChatFloating     from '../components/dashboard/ChatFloating';
import ToolSelector     from '../components/dashboard/ToolSelector';

import PerfilView       from './PerfilView';
import EstadisticasView from './EstadisticasView';
import ProximasClases   from '../components/dashboard/ProximasClases';
import AlumnosView      from './AlumnosView';
import CalendarioView   from './CalendarioView';
import './Dashboard.css';

const VIEWS_SIN_OVERLAY = ['profile', 'tools', 'stats', 'materiales', 'calendario', 'alumnos'];

const menuItems = [
  { id: 'profile',    label: 'Mi Perfil',      color: '#f8bbd0', thumbtack: '#2196f3' },
  { id: 'tools',      label: 'Herramientas',   color: '#c8e6c9', thumbtack: '#4caf50' },
  { id: 'stats',      label: 'Estadísticas',   color: '#e1f5fe', thumbtack: '#ff9800' },
  { id: 'materiales', label: 'Mis Materiales', color: '#fbbf24', thumbtack: '#dc2626' },
  { id: 'alumnos',    label: 'Mis Alumnos',    color: '#fde68a', thumbtack: '#7c3aed' },
  { id: 'calendario', label: 'Calendario',     color: '#bfdbfe', thumbtack: '#2563eb' },
];

const Dashboard = () => {
  const { user, logout } = useAuth();

  const [documentos,  setDocumentos]  = useState([]);
  const [showLoading, setShowLoading] = useState(true);
  const [displayText, setDisplayText] = useState('');
  const [isFading,    setIsFading]    = useState(false);
  const [activeView,  setActiveView]  = useState('welcome');
  const [usoStorage,  setUsoStorage]  = useState(0);
  const [stats,       setStats]       = useState({ total_escuelas: 0, mensajes_ia: 0 });
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const fullText   = 'Kōkua';
  const sinOverlay = VIEWS_SIN_OVERLAY.includes(activeView);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const fetchDocumentos = async () => {
    if (!user?.id) return;
    try {
      const res     = await api.get(`/proyectos/archivos/${user.id}`);
      setDocumentos(res.data);
      const totalMB = res.data.reduce((acc, doc) => acc + (parseFloat(doc.uso_mb) || 0), 0);
      setUsoStorage(((totalMB / 50) * 100).toFixed(1));
    } catch (err) {
      console.error('Error al cargar documentos:', err);
    }
  };

  useEffect(() => {
    if (!showLoading) return;
    if (displayText.length < fullText.length) {
      const t = setTimeout(() => setDisplayText(fullText.slice(0, displayText.length + 1)), 250);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setIsFading(true);
      setTimeout(() => setShowLoading(false), 600);
    }, 1500);
    return () => clearTimeout(t);
  }, [displayText, showLoading]);

  useEffect(() => {
    if (!showLoading && user?.id) {
      fetchDocumentos();
      setStats({ total_escuelas: 0, mensajes_ia: 0 });
    }
  }, [showLoading, user, activeView]);

  const handleLogout = async () => {
    if (window.confirm('¿Segura que desea cerrar sesión?')) {
      await logout();
      window.location.href = '/login';
    }
  };

  const handleDownload = async (url, filename) => {
    try {
      const response = await fetch(url);
      const blob     = await response.blob();
      const blobUrl  = window.URL.createObjectURL(blob);
      const a        = document.createElement('a');
      a.href         = blobUrl;
      a.download     = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, '_blank');
    }
  };

  const handleDelete = async (idArchivo, nombreArchivo) => {
    if (!window.confirm(`¿Eliminar "${nombreArchivo}"?\n\nSi lo elimina no lo podrá recuperar.`)) return;
    try {
      await api.delete(`/proyectos/archivo/${idArchivo}`);
      await fetchDocumentos();
    } catch (err) {
      alert(`No se pudo eliminar: ${err.response?.data?.detail || err.message}`);
    }
  };

  const renderContent = () => {
    switch (activeView) {
      case 'profile':    return <PerfilView    onVolver={() => setActiveView('welcome')} />;
      case 'tools':      return <ToolSelector  onVolver={() => setActiveView('welcome')} />;
      case 'stats':      return <EstadisticasView onVolver={() => setActiveView('welcome')} />;
      case 'materiales': return <MisMaterialesView onVolver={() => setActiveView('welcome')} />;
      case 'alumnos':    return <AlumnosView   onVolver={() => setActiveView('welcome')} />;
      case 'calendario': return <CalendarioView onVolver={() => setActiveView('welcome')} />;
      default:           return <div className="p-8 text-center font-handwritten text-2xl text-gray-800">Vista no encontrada.</div>;
    }
  };

  if (showLoading) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundImage: theme === 'light' ? "url('/img/chalkboard.jpg')" : "linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)",
        backgroundSize: 'cover', backgroundPosition: 'center',
        opacity: isFading ? 0 : 1, transition: 'opacity 0.7s',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: "url('https://www.transparenttextures.com/patterns/chalkboard.png')",
          opacity: 0.15, pointerEvents: 'none'
        }} />
        <h1 style={{
          fontFamily: "'KG Midnight Memories', cursive",
          color: theme === 'light' ? 'white' : '#e5e5e5',
          fontSize: 'min(10rem, 15vw)',
          textShadow: '3px 3px 15px rgba(0,0,0,0.4)',
          textAlign: 'center', margin: 0, letterSpacing: '5px',
          position: 'relative', zIndex: 1,
        }}>
          {displayText}
        </h1>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      overflow: 'hidden', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 50,
      backgroundImage: theme === 'light' ? "url('/img/chalkboard.jpg')" : "linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 100%)",
      backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat'
    }}>
      {/* Botón de Tema */}
      <button
        onClick={toggleTheme}
        className="theme-toggle fixed top-4 right-4 z-50 bg-gray-800 text-white p-2 rounded-full shadow-lg hover:bg-gray-700 transition-colors"
        title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </button>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Indie+Flower&family=Permanent+Marker&display=swap');
        html, body, #root { height: 100%; width: 100%; }
        .handwritten { font-family: 'Indie Flower', cursive; }

        .corkboard-layer {
          background-image: var(--cork-bg);
          background-size: cover; background-repeat: no-repeat; background-position: center;
          width: 82vw; height: 86vh;
          display: flex; align-items: center; justify-content: center;
          box-shadow: inset 0 0 100px var(--shadow-dark), 0 20px 60px var(--shadow-dark);
          position: relative; z-index: 10;
          border: 10px solid var(--wood-border); border-radius: 12px;
        }

        .welcome-layout {
          display: flex;
          align-items: flex-start;
          justify-content: center;
          gap: 32px;
          width: 100%;
          height: 100%;
          padding: 16px 130px 16px 16px;
          box-sizing: border-box;
        }

        .welcome-left {
          display: flex;
          flex-direction: column;
          gap: 16px;
          align-items: flex-start;
          flex-shrink: 0;
          width: 200px;
          padding-top: 8px;
        }

        .welcome-left-title {
          font-family: 'KG Midnight Memories', cursive;
          color: white;
          font-size: clamp(6rem, 11vw, 9rem);
          text-shadow: 3px 3px 15px rgba(0,0,0,0.4);
          margin: 0;
          letter-spacing: 5px;
          line-height: 1;
        }

        /* Sin scroll, más ancho, letras más chicas */
        .postit-proximas {
          width: min(220px, 100%);
          max-width: 220px;
          max-height: min(44vh, 320px);
          overflow-y: auto;
          overflow-x: hidden;
          background: #bbf7d0;
          padding: 15px 12px 12px;
          box-shadow: 8px 8px 25px rgba(0,0,0,0.35);
          border-bottom-right-radius: 30px 90px;
          transform: rotate(-2deg);
          position: relative;
          font-size: 0.72rem;
          box-sizing: border-box;
        }
        .postit-proximas * {
          font-size: inherit;
        }

        .welcome-postit {
          background: var(--postit-bg);
          color: var(--postit-text);
          padding: 1.8rem 2rem;
          box-shadow: 10px 10px 30px var(--shadow);
          text-align: center;
          max-width: 420px;
          width: 90%;
          z-index: 20;
          transform: rotate(-1deg);
          position: relative;
          border-bottom-right-radius: 40px 200px;
          display: flex; flex-direction: column;
          justify-content: center; align-items: center;
          margin-top: auto;
          margin-bottom: auto;
          transition: background-color 0.3s, color 0.3s;
          flex-shrink: 1;
        }

        .thumbtack-big {
          position: absolute; top: 15px; left: 50%;
          transform: translateX(-50%);
          width: 24px; height: 24px;
          background: #f44336; border-radius: 50%;
          box-shadow: 2px 2px 5px rgba(0,0,0,0.4);
        }
        .thumbtack-small {
          position: absolute; top: 8px; left: 50%;
          transform: translateX(-50%);
          width: 12px; height: 12px;
          background: #f44336; border-radius: 50%;
          box-shadow: 1px 1px 3px rgba(0,0,0,0.4); z-index: 60;
        }

        .postit-nav {
          position: absolute; right: 12px; top: 50%;
          transform: translateY(-50%);
          width: 145px;
          display: flex; flex-direction: column;
          justify-content: center; align-items: center;
          gap: 6px; z-index: 150; max-height: 96%;
        }

        .sticky-postit-css {
          width: 129px; height: 78px;
          display: flex; align-items: center; justify-content: center;
          text-align: center; padding: 5px;
          box-shadow: 3px 3px 7px rgba(0,0,0,0.3);
          position: relative; cursor: pointer;
          transition: transform 0.2s ease, opacity 0.2s ease;
          border-radius: 2px; border-bottom-right-radius: 10px 36px;
        }
        .sticky-postit-css:hover { transform: scale(1.07) rotate(-1.5deg); z-index: 160; }

        .sticky-label-css {
          font-family: 'Indie Flower', cursive; font-weight: bold;
          font-size: 0.82rem; color: #333;
          line-height: 1.05; word-wrap: break-word;
        }
        .thumbtack-dot {
          position: absolute; top: 6px; left: 50%;
          transform: translateX(-50%);
          width: 8px; height: 8px; border-radius: 50%;
          box-shadow: 1px 1px 2px rgba(0,0,0,0.4); z-index: 5;
        }

        .storage-inline {
          position: relative;
          width: 190px;
          transform: translate(0, 0);
          overflow: visible;
        }
      `}</style>

      <div className="corkboard-layer">

        {activeView === 'welcome' ? (
          <div className="welcome-layout">

            <div className="welcome-left">

              <h1 className="welcome-left-title">Kōkua</h1>

              <div className="postit-proximas">
                <div style={{
                  position: 'absolute', top: '8px', left: '50%',
                  transform: 'translateX(-50%)',
                  width: '14px', height: '14px',
                  background: '#dc2626', borderRadius: '50%',
                  boxShadow: '1px 1px 3px rgba(0,0,0,0.4)'
                }} />
                <ProximasClases />
              </div>

              <div className="storage-inline">
                <StorageSticker usoStorage={usoStorage} visible={true} />
              </div>

            </div>

            <div style={{ display: 'flex', alignItems: 'center', flex: 1, justifyContent: 'center', height: '100%' }}>
              <WelcomePostit username={user?.username || user?.nombre} />
            </div>

          </div>
        ) : (
          <div
            className="notebook-view relative z-[100] transition-all duration-300 flex justify-center items-center"
            style={{
              width:        ['calendar','alumnos'].includes(activeView) ? '70vw'    : '100%',
              maxWidth:     ['calendar','alumnos'].includes(activeView) ? '1000px'  : '1152px',
              height:    ['calendar','stats','alumnos'].includes(activeView) ? 'auto' : '88vh',
              maxHeight: ['calendar','stats','alumnos'].includes(activeView) ? '80vh' : 'none',
              alignItems:   activeView === 'calendar' ? 'flex-start'    : 'center',
              marginTop:    activeView === 'calendar' ? '40px'          : '0',
              marginBottom: activeView === 'calendar' ? '40px'          : '0',
              marginRight:  ['calendar','alumnos'].includes(activeView) ? '0' : '120px',
              overflowY:    activeView === 'calendar' ? 'auto'          : 'visible',
              backgroundColor: sinOverlay ? 'transparent' : 'var(--card-bg)',
              backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat',
              borderRadius: sinOverlay ? '0' : '0.75rem',
              padding:      activeView === 'calendar' ? '20px 0' : sinOverlay ? '0' : '2rem',
              boxShadow:    sinOverlay ? 'none' : '0 25px 50px -12px var(--shadow)',
              color: 'var(--card-text)',
              transition: 'background-color 0.3s, color 0.3s'
            }}
          >
            {!['calendario','profile','alumnos','tools','materiales','stats'].includes(activeView) && (
              <button
                onClick={() => setActiveView('welcome')}
                style={{
                  position: 'absolute', top: '20px', right: '24px',
                  backgroundColor: 'var(--postit-bg)', color: 'var(--postit-text)',
                  border: '2px solid var(--postit-border)', borderRadius: '50px',
                  padding: '8px 18px', cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px var(--shadow)',
                  zIndex: 200, fontWeight: 'bold',
                  fontFamily: "'Indie Flower', cursive", fontSize: '1.1rem',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  transition: 'all 0.3s'
                }}
              >
                ⬅ Volver
              </button>
            )}
            {renderContent()}
          </div>
        )}

        {activeView !== 'calendar' && (
          <nav className="postit-nav">
            {menuItems.map((item, index) => (
              <div
                key={item.id}
                className="sticky-postit-css"
                style={{
                  backgroundColor: item.color,
                  transform: `rotate(${index % 2 === 0 ? '1.5deg' : '-2deg'})`,
                  opacity: activeView === 'welcome' ? 1
                    : ['tools','calendario','materiales','alumnos','stats','profile'].includes(activeView) ? 0.15 : 1,
                  pointerEvents: activeView === 'welcome' ? 'auto'
                    : ['tools','calendario','materiales','alumnos','stats','profile'].includes(activeView) ? 'none' : 'auto',
                  transition: 'opacity 0.3s ease'
                }}
                onClick={() => setActiveView(item.id)}
              >
                <div className="thumbtack-dot" style={{ backgroundColor: item.thumbtack }} />
                <span className="sticky-label-css">{item.label}</span>
              </div>
            ))}

            <button
              onClick={handleLogout}
              style={{
                marginTop: '8px', background: 'var(--button-logout)', color: 'var(--button-logout-text)',
                padding: '6px 16px', borderRadius: '4px',
                border: '2px dashed var(--button-logout-border)',
                fontFamily: "'Indie Flower', cursive", fontWeight: 'bold',
                fontSize: '1rem', cursor: 'pointer',
                boxShadow: '2px 3px 6px var(--shadow)',
                transform: 'rotate(-2deg)', transition: 'all 0.2s ease',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'rotate(0deg) scale(1.05)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'rotate(-2deg)'; }}
            >
              <LogOut size={16} />
              Salir
            </button>
          </nav>
        )}

        <div style={{
          opacity: ['stats','materiales','alumnos','profile'].includes(activeView) ? 0.15 : 1,
          pointerEvents: ['stats','materiales','alumnos','profile'].includes(activeView) ? 'none' : 'auto',
          transition: 'opacity 0.3s ease'
        }}>
          <ChatFloating />
        </div>

      </div>
    </div>
  );
};

export default Dashboard;