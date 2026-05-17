// src/hooks/useFileUpload.js
import { useState, useCallback } from 'react';

export const useFileUpload = (onFileAccepted) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [error, setError] = useState(null);

  // Previene el comportamiento por defecto del navegador (abrir el PDF)
  const preventDefaults = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = useCallback((e) => {
    preventDefaults(e);
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    preventDefaults(e);
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    preventDefaults(e);
    setIsDraggingOver(false);
    setError(null);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];

      // Validación de Ingeniería: Verificar tipo MIME (solo PDF)
      if (file.type !== 'application/pdf') {
        setError('Solo se permiten archivos PDF.');
        return;
      }

      // Validación opcional de tamaño (ej: < 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('El archivo es demasiado grande (máx 10MB).');
        return;
      }

      // Callback al componente padre con el archivo validado
      onFileAccepted(file);
    }
  }, [onFileAccepted]);

  return {
    isDraggingOver,
    error,
    handleDragEnter,
    handleDragOver: preventDefaults, // Necesario para que funcione el drop
    handleDragLeave,
    handleDrop,
    setError
  };
};