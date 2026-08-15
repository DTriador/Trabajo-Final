// src/components/dashboard/calendario/Overlay.jsx
import React from 'react';

export default function Overlay({ children, onClose }) {
  return (
    <div
      style={{
        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, borderRadius: 'inherit',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff9c4', borderRadius: 20, padding: '28px 32px',
          width: '90%', maxWidth: 520, maxHeight: '88%', overflowY: 'auto',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)', fontFamily: "'Inkfree', cursive",
        }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
