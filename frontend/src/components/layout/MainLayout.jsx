// src/components/layout/MainLayout.jsx
import React, { useState, useEffect } from 'react';
import SidebarRight from '../dashboard/SidebarRight';

const MainLayout = ({ children }) => {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Botón de Tema */}
      <button
        onClick={toggleTheme}
        className="theme-toggle fixed top-4 right-4 z-50 bg-gray-800 text-white p-2 rounded-full shadow-lg hover:bg-gray-700 transition-colors"
        title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </button>

      {/* Contenido Principal (Chat + Herramientas) */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {children}
      </main>

      {/* Sidebar Derecha Persistente */}
      <aside className="w-80 border-l bg-white hidden lg:block">
        <SidebarRight />
      </aside>
    </div>
  );
};

export default MainLayout;