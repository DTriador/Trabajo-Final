// src/components/dashboard/ChatPanel.jsx
import React, { useState } from 'react';
import api from '../../api/axios';
import FileUploadZone from './FileUploadZone';

const ChatPanel = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    
    // Agregamos el mensaje del docente
    const newUserMessage = { sender: 'user', text: input, type: 'text' };
    setMessages(prev => [...prev, newUserMessage]);
    setInput('');

    try {
      // Aquí conectarías con tu endpoint de FastAPI para la IA
      // const res = await api.post('/chat', { query: input });
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileAccepted = async (file) => {
    setMessages(prev => [...prev, { sender: 'user', type: 'file', name: file.name }]);
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post('/documentos/subir', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setMessages(prev => [...prev, { 
        sender: 'ai', 
        text: ` Procesado con éxito: "${file.name}". Ya podés hacerme preguntas.` 
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { sender: 'ai', text: `❌ Error al procesar ${file.name}` }]);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Cabecera del Chat */}
      <div className="p-4 border-b-2 border-blue-100 flex justify-between items-center">
        <h2 className="font-bold text-xl text-blue-800" style={{ fontFamily: 'Verdana' }}>
          Apuntes con Kōkua
        </h2>
        {uploading && <span className="text-xs text-blue-500 animate-pulse font-bold">Procesando...</span>}
      </div>

      {/* Zona de mensajes (El interior del cuaderno) */}
      <FileUploadZone onFileReady={handleFileAccepted}>
        <div className="flex-1 p-4 overflow-y-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center mt-10 text-black">
              <p className="text-2xl mb-2">📓</p>
              <p style={{ fontFamily: 'Inkfree', fontSize: '1.5rem' }}>Escribí algo en tu cuaderno...</p>
            </div>
          )}

          {messages.map((msg, index) => (
            <div key={index} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
               {/* ETIQUETA DE QUIÉN HABLA */}
               <span className="text-[10px] font-black text-black uppercase tracking-widest mb-1">
                {msg.sender === 'user' ? 'Tú' : 'IA'}
              </span>

              {/* EL MENSAJE CON LA MODIFICACIÓN QUE PEDISTE */}
              <div 
                className={`max-w-[90%] p-2 ${msg.sender === 'user' ? 'text-blue-800' : 'text-black bg-gray-50/50 rounded-lg'}`}
                style={{ 
                  fontFamily: msg.sender === 'user' ? 'Inkfree, cursive' : 'inherit',
                  fontSize: msg.sender === 'user' ? '1.8rem' : '1.1rem', // Un poco más grande Inkfree para que se note
                  transform: msg.sender === 'user' ? 'rotate(-1deg)' : 'none',
                  lineHeight: '1.4'
                }}
              >
                {msg.type === 'file' ? ` [Archivo subido: ${msg.name}]` : msg.text}
              </div>
            </div>
          ))}
        </div>
      </FileUploadZone>

      {/* Entrada de texto (El renglón) */}
      <div className="p-4 border-t bg-white/30">
        <div className="flex items-center gap-2">
          <label className="cursor-pointer p-2 hover:bg-gray-100 rounded-full transition-colors">
            <span className="text-xl">📎</span>
            <input 
              type="file" 
              accept=".pdf" 
              className="hidden" 
              onChange={(e) => e.target.files[0] && handleFileAccepted(e.target.files[0])}
              disabled={uploading}
            />
          </label>
          
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Escribir consulta..." 
            className="flex-1 bg-transparent border-none focus:ring-0 text-2xl"
            style={{ fontFamily: 'Inkfree', outline: 'none' }}
            disabled={uploading}
          />
          
          <button 
            onClick={handleSendMessage}
            className="bg-blue-600 text-white p-2 rounded-full hover:scale-110 transition-transform disabled:bg-gray-300"
            disabled={uploading || !input.trim()}
          >
            
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;