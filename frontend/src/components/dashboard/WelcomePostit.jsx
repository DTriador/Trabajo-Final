// src/components/dashboard/WelcomePostit.jsx
import React from 'react';

const WelcomePostit = ({ username }) => {
  return (
    <div className="welcome-postit handwritten">
      <div className="thumbtack-big"></div>
      <h2 style={{ lineHeight: 1, marginBottom: '0.8rem', color: 'var(--postit-text)', fontFamily: "'KG Midnight Memories', cursive", transition: 'color 0.3s', fontSize: 'clamp(2rem, 8vw, 3.2rem)' }}>
        Hola profe {username || "Profe"}
      </h2>
      <p style={{ lineHeight: 1.4, color: 'var(--postit-text)', fontStyle: 'italic', textAlign: 'center', marginBottom: '0.4rem', fontFamily: "'Inkfree', cursive", transition: 'color 0.3s', opacity: 0.7, fontSize: 'clamp(1.2rem, 6vw, 2rem)' }}>
        ¿En qué trabajamos hoy?
      </p>
      <p style={{ lineHeight: 1.4, color: 'var(--postit-text)', textAlign: 'center', fontFamily: "'Inkfree', cursive", transition: 'color 0.3s', fontSize: 'clamp(1rem, 5vw, 1.5rem)' }}>
        ¡Listos para comenzar!
      </p>
    </div>
  );
};

export default WelcomePostit;