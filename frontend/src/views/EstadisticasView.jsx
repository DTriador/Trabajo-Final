// src/views/EstadisticasView.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './EstadisticasView.css';

const COLORS = ['#f472b6', '#a78bfa', '#fbbf24', '#34d399', '#60a5fa', '#fb7185'];

const EstadisticasView = ({ onVolver }) => {
  const { user } = useAuth();
  const [stats, setStats]       = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    const cargar = async () => {
      const userId = user?.id || user?.id_docente || user?.user?.id;
      if (!userId) {
        setError("No se encontró el ID del docente. Cerrá sesión y volvé a entrar.");
        setCargando(false);
        return;
      }
      try {
        const res = await api.get(`/stats/dashboard/${userId}`);
        setStats(res.data);
      } catch (e) {
        setError(e.response?.data?.detail || e.message || "Error desconocido");
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, [user]);

  const generarPDF = () => {
    if (!stats) return;
    const doc = new jsPDF();
    const fecha = new Date().toLocaleDateString('es-AR');

    doc.setFontSize(18);
    doc.text("Reporte de Actividad - Kokua", 14, 20);
    doc.setFontSize(11);
    doc.text(`Docente: ${user?.nombre || user?.username || ''}`, 14, 30);
    doc.text(`Fecha: ${fecha}`, 14, 36);

    doc.setFontSize(13);
    doc.text("Resumen General", 14, 50);
    autoTable(doc, {
      startY: 54,
      head: [['Métrica', 'Valor']],
      body: [
        ['Total de materiales generados', stats.total_generados],
        ['Horas estimadas ahorradas', `${stats.horas_ahorradas} hs`],
      ],
    });

    let y = doc.lastAutoTable.finalY + 10;
    doc.text("Top 5 Temas", 14, y);
    autoTable(doc, {
      startY: y + 4,
      head: [['Tema', 'Cantidad']],
      body: (stats.ranking_temas || []).map(t => [t.tema, t.cantidad]),
    });

    y = doc.lastAutoTable.finalY + 10;
    doc.text("Distribución por formato", 14, y);
    autoTable(doc, {
      startY: y + 4,
      head: [['Formato', 'Cantidad']],
      body: (stats.pie_formatos || []).map(f => [f.name, f.value]),
    });

    doc.save(`Reporte_Kokua_${fecha}.pdf`);
  };

  if (cargando) return <p style={{ padding: 40, color: '#fff', fontSize: '1.5rem' }}>Cargando estadísticas...</p>;
  if (error) return (
    <div style={{ padding: 40, color: '#fff' }}>
      <h2 style={{ color: '#fbbf24', marginBottom: 12 }}>No pude cargar las estadísticas</h2>
      <pre style={{ background: 'rgba(0,0,0,0.4)', padding: 16, borderRadius: 8, fontSize: '0.9rem' }}>{error}</pre>
      <button onClick={onVolver} style={{ marginTop: 16, padding: '10px 20px', borderRadius: 8, border: 'none', background: '#e0f2fe', cursor: 'pointer' }}>⬅ Volver</button>
    </div>
  );
  if (!stats) return <p style={{ padding: 40, color: '#fff' }}>No hay datos todavía.</p>;

  const pieFormatos   = stats.pie_formatos   || [];
  const piePedagogico = stats.pie_pedagogico || [];
  const rankingTemas  = stats.ranking_temas  || [];

  return (
    <div style={{
      background: '#fff9c4',
      padding: '30px 35px',
      width: '100%',
      maxWidth: '1100px',
      maxHeight: '76vh',
      overflowY: 'auto',
      overflowX: 'hidden',
      boxShadow: '10px 10px 30px rgba(0,0,0,0.35)',
      borderBottomRightRadius: '40px 200px',
      transform: 'rotate(-0.5deg)',
      fontFamily: "'Indie Flower', cursive",
      color: '#1f2937',
      margin: '0',
      position: 'relative',
      boxSizing: 'border-box',
      scrollbarWidth: 'thin',
      scrollbarColor: '#b45309 #fff9c4',
    }}>
      {/* Chinche */}
      <div style={{
        position: 'absolute', top: '12px', left: '50%',
        transform: 'translateX(-50%)', width: '20px', height: '20px',
        background: '#dc2626', borderRadius: '50%',
        boxShadow: '2px 2px 5px rgba(0,0,0,0.4)'
      }} />

      <div className="stats-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '2px dashed #b45309', paddingBottom: 12 }}>
        <h1 style={{ fontFamily: "'KG Midnight Memories', cursive", fontSize: '2.5rem', color: '#1e3a8a', margin: 0 }}>📊 Mis Estadísticas</h1>
          <button onClick={generarPDF} className="stats-btn" style={{ background: '#fef08a', border: '2px solid #ca8a04', borderRadius: 50, padding: '8px 20px', cursor: 'pointer', fontWeight: 'bold', fontFamily: "'Indie Flower', cursive", fontSize: '1rem' }}>📄 Generar PDF</button>
          <button onClick={onVolver} style={{ backgroundColor: '#e0f2fe', color: '#0c4a6e', border: '2px solid #38bdf8', borderRadius: '50px', padding: '8px 18px', cursor: 'pointer', fontFamily: "'Indie Flower', cursive", fontWeight: 'bold', fontSize: '1rem' }}>⬅ Volver</button>
      </div>

      {stats.total_generados === 0 && (
        <div style={{ padding: 16, background: 'rgba(255,255,255,0.7)', borderRadius: 12, textAlign: 'center', marginBottom: 20, color: '#444', fontSize: '1.05rem' }}>
          Todavía no generaste ningún material. ¡Probá crear una presentación, examen o apunte para ver tus estadísticas!
        </div>
      )}

      <div className="stats-cards">
        <div className="stat-card">
          <span className="stat-num">{stats.total_generados}</span>
          <span className="stat-label">Materiales generados</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{stats.horas_ahorradas} hs</span>
          <span className="stat-label">Tiempo ahorrado</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{pieFormatos.length}</span>
          <span className="stat-label">Tipos de archivo</span>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stats-panel">
          <h3>Distribución por tipo de archivo</h3>
          {pieFormatos.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieFormatos} dataKey="value" nameKey="name" outerRadius={90} label>
                  {pieFormatos.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <p style={{ textAlign: 'center', color: '#999', padding: 40 }}>Sin datos</p>}
        </div>

        <div className="stats-panel">
          <h3>Tipos de materiales</h3>
          {piePedagogico.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={piePedagogico} dataKey="value" nameKey="name" outerRadius={90} label>
                  {piePedagogico.map((_, i) => <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <p style={{ textAlign: 'center', color: '#999', padding: 40 }}>Sin datos</p>}
        </div>

        <div className="stats-panel" style={{ gridColumn: '1 / -1' }}>
          <h3>Top 5 temas más trabajados</h3>
          {rankingTemas.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={rankingTemas}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tema" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="cantidad" fill="#a78bfa" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p style={{ textAlign: 'center', color: '#999', padding: 40 }}>Sin datos</p>}
        </div>
      </div>
    </div>
  );
};

export default EstadisticasView;