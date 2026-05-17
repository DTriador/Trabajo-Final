// src/components/dashboard/FileUploadZone.jsx
import React from 'react';
import { useFileUpload } from '../../hooks/useFileUpload';

const FileUploadZone = ({ children, onFileReady }) => {
  const {
    isDraggingOver,
    error,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    setError
  } = useFileUpload(onFileReady);

  return (
    <div
      className="relative flex-1 flex flex-col h-full"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Superposición visual (Overlay) cuando se arrastra un archivo */}
      {isDraggingOver && (
        <div className="absolute inset-0 bg-blue-600 bg-opacity-90 z-50 flex flex-col items-center justify-center rounded-xl border-4 border-dashed border-white m-2 transition-all duration-300">
          <span className="text-6xl mb-4">📄</span>
          <p className="text-xl font-bold text-white">Soltá el PDF para entrenar a la IA</p>
          <p className="text-sm text-blue-100 mt-2">Máximo 10MB</p>
        </div>
      )}

      {/* Contenido real del chat (mensajes, input, etc.) */}
      <div className={`flex-1 flex flex-col ${isDraggingOver ? 'blur-sm' : ''} transition-all`}>
        {children}
      </div>

      {/* Feedback de error */}
      {error && (
        <div className="absolute bottom-16 left-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded text-sm z-40 flex justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="font-bold">&times;</button>
        </div>
      )}
    </div>
  );
};

export default FileUploadZone;