// src/components/dashboard/StorageSticker.jsx
import React from 'react';
import { Database } from 'lucide-react';

const StorageSticker = ({ usoStorage, visible }) => {
  if (!visible) return null;

  return (
    <div
      className="handwritten"
      style={{
        background: 'rgba(255,255,255,0.62)',
        padding: '10px 14px',
        borderRadius: '4px',
        borderBottomRightRadius: '12px 36px',
        boxShadow: '4px 4px 10px var(--shadow)',
        width: '100%',
        boxSizing: 'border-box',
        position: 'relative',
        transform: 'rotate(1.5deg)',
        color: 'var(--postit-text)',
        transition: 'background-color 0.3s, color 0.3s',
      }}
    >
      {/* Chinche */}
      <div style={{
        position: 'absolute', top: '6px', left: '50%',
        transform: 'translateX(-50%)',
        width: '8px', height: '8px', borderRadius: '50%',
        background: '#f44336',
        boxShadow: '1px 1px 2px rgba(0,0,0,0.4)',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', marginTop: '8px' }}>
        <Database size={13} color="var(--postit-text)" />
        <span style={{
          fontFamily: "'Inkfree', cursive",
          fontWeight: 'bold',
          fontSize: '0.65rem',
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
          color: 'var(--postit-text)',
          transition: 'color 0.3s',
        }}>
          Almacenamiento
        </span>
      </div>

      <p style={{
        fontFamily: "'Inkfree', cursive",
        fontSize: '0.72rem',
        color: 'var(--postit-text)',
        margin: 0,
        lineHeight: 1.3,
      }}>
        Espacio al <strong>{usoStorage}%</strong>
      </p>

      <div style={{
        width: '100%', background: 'rgba(0,0,0,0.1)',
        height: '6px', marginTop: '6px', borderRadius: '9999px',
        overflow: 'hidden',
      }}>
        <div style={{
          background: '#2563eb',
          height: '100%',
          width: `${usoStorage}%`,
          borderRadius: '9999px',
        }} />
      </div>
    </div>
  );
};

export default StorageSticker;