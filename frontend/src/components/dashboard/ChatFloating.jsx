import React, { useState, useEffect, useRef } from 'react';
import "./ChatFloating.css";
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

const COMANDOS_RAPIDOS = [
    { cmd: '/ppt',       label: '📊 PPT',       hint: 'sobre…' },
    { cmd: '/resumen',   label: '📄 Resumen',   hint: 'de…' },
    { cmd: '/preguntas', label: '❓ Preguntas', hint: 'sobre…' },
    { cmd: '/examen',    label: '📝 Examen',    hint: 'de…' },
];

const ChatFloating = () => {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [generando, setGenerando] = useState(false);
    const fileInputRef = useRef(null);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (user && isOpen && messages.length === 0) {
            const nombre = user?.username || user?.nombre || user?.email || "Profe";
            setMessages([{
                sender: 'bot',
                text: `¡Hola, profe ${nombre}! Soy Kōkua. Podés preguntarme sobre tus documentos o usar comandos rápidos como \`/ppt fotosíntesis\`. Escribí \`/ayuda\` para ver todo lo que puedo hacer.`
            }]);
        }
    }, [user, isOpen]);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, generando]);

    const toggleChat = () => setIsOpen(!isOpen);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('id_docente', user?.id || user?.uid);
        try {
            await api.post('/documentos/subir', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setMessages(prev => [...prev, {
                sender: 'bot',
                text: `📎 Archivo "${file.name}" indexado. Ya podés preguntarme sobre este material.`
            }]);
        } catch (err) {
            console.error("Error al subir archivo:", err);
            setMessages(prev => [...prev, { sender: 'bot', text: '❌ Error al procesar el documento.' }]);
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    // Ejecuta una acción de generación que vino desde el backend
    const ejecutarAccion = async (accion, tema) => {
        setGenerando(true);
        try {
            const userId = user?.id || user?.uid;
            const payload = new FormData();
            payload.append('tema', tema);
            payload.append('id_docente', userId);

            const res = await api.post(accion.endpoint, payload, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.status === "success") {
                setMessages(prev => [...prev, {
                    sender: 'bot',
                    text: `✅ ¡Listo! Tu archivo está en la biblioteca.`,
                    fileUrl: res.data.download_url,
                    fileName: res.data.nombre_archivo || `Material_${tema}`
                }]);
            }
        } catch (err) {
            console.error("Error generando:", err);
            setMessages(prev => [...prev, {
                sender: 'bot',
                text: `❌ No pude generar el material. ${err.response?.data?.detail || ''}`
            }]);
        } finally {
            setGenerando(false);
        }
    };

    const handleSend = async (textoForzado = null) => {
        const texto = (textoForzado ?? input).trim();
        if (!texto || isUploading || generando) return;

        setMessages(prev => [...prev, { sender: 'user', text: texto }]);
        setInput('');

        try {
            const res = await api.post('/asistente/chat', {
                mensaje: texto,
                id_docente: user?.id || user?.uid
            });

            // Mostramos siempre el mensaje del bot
            setMessages(prev => [...prev, { sender: 'bot', text: res.data.respuesta }]);

            // Si vino una acción, la ejecutamos
            if (res.data.tipo === 'accion' && res.data.endpoint) {
                await ejecutarAccion(
                    { endpoint: res.data.endpoint },
                    res.data.tema
                );
            }
        } catch (err) {
            console.error("Error en el chat de Kōkua:", err);
            setMessages(prev => [...prev, {
                sender: 'bot',
                text: 'Hubo un problema técnico al conectar con Kōkua.'
            }]);
        }
    };

    const usarComando = (cmd, hint) => {
        setInput(`${cmd} `);
    };

    return (
        <div className="chat-container-main">
            {isOpen && (
                <div className="chat-window-kokua">
                    <div className="chat-header-kokua">
                        <span className="header-title-kokua">Asistente Kōkua</span>
                        <button className="close-btn-kokua" onClick={toggleChat}>✕</button>
                    </div>

                    <div className="chat-messages-kokua" ref={scrollRef}>
                        {messages.map((msg, index) => (
                            <div key={index} className={`chat-bubble-kokua ${msg.sender === 'user' ? 'user' : 'bot'}`}>
                                <div>{msg.text}</div>
                                {msg.fileUrl && (
                                    <a
                                        href={msg.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="chat-file-link"
                                        style={{
                                            display: 'inline-block', marginTop: 8, padding: '6px 12px',
                                            background: '#fef08a', borderRadius: 8, color: '#1e3a8a',
                                            textDecoration: 'none', fontWeight: 'bold'
                                        }}
                                    >
                                        ⬇ Descargar {msg.fileName}
                                    </a>
                                )}
                            </div>
                        ))}
                        {(isUploading || generando) && (
                            <div className="chat-bubble-kokua bot" style={{ fontStyle: 'italic', opacity: 0.7 }}>
                                {isUploading ? 'Procesando documento…' : 'Generando material…'}
                            </div>
                        )}
                    </div>

                    {/* Comandos rápidos */}
                    <div style={{ display: 'flex', gap: 6, padding: '6px 10px', flexWrap: 'wrap', borderTop: '1px solid #eee' }}>
                        {COMANDOS_RAPIDOS.map(c => (
                            <button
                                key={c.cmd}
                                onClick={() => usarComando(c.cmd, c.hint)}
                                style={{
                                    fontSize: '0.8rem', padding: '4px 8px', border: '1px solid #ddd',
                                    borderRadius: 12, background: '#f9fafb', cursor: 'pointer'
                                }}
                                type="button"
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>

                    <div className="chat-input-area-kokua">
                        <button
                            className="attach-btn-kokua"
                            onClick={() => fileInputRef.current.click()}
                            disabled={isUploading || generando}
                            type="button"
                        >📎</button>
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf" style={{ display: 'none' }} />

                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Preguntá o escribí /ayuda…"
                            disabled={isUploading || generando}
                        />
                        <button
                            className="send-btn-kokua"
                            onClick={() => handleSend()}
                            disabled={!input.trim() || isUploading || generando}
                        >➤</button>
                    </div>
                </div>
            )}

            <button className="floating-trigger-kokua" onClick={toggleChat}>
                <img src="/img/chat.png" alt="Abrir Chat Kōkua" />
            </button>
        </div>
    );
};

export default ChatFloating;