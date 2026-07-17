// src/views/PerfilView.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import './PerfilView.css';
import EscuelasSection from '../components/dashboard/EscuelasSection';

const PerfilView = ({ onVolver }) => {
    const { user, setUser } = useAuth();
    const [editando, setEditando] = useState(false);
    const [cargando, setCargando] = useState(false);
    const [formData, setFormData] = useState({
        nombre: '',
        username: '',
        fecha_nacimiento: '',
        ciudad: '',
        telefono: '',
        email: '',
    });

    // Cargar datos personales al montar
    useEffect(() => {
        if (!user?.id) return;
        const obtenerDatos = async () => {
            try {
                const res = await api.get(`/auth/perfil/${user.id}`);
                setFormData({
                    nombre:           res.data.nombre           ?? '',
                    username:         res.data.username         ?? '',
                    email:            res.data.email            ?? '',
                    fecha_nacimiento: res.data.fecha_nacimiento ?? '',
                    ciudad:           res.data.ciudad           ?? '',
                    telefono:         res.data.telefono         ?? '',
                });
            } catch (error) {
                console.error('Error perfil:', error);
            }
        };
        obtenerDatos();
    }, [user]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleGuardar = async () => {
        setCargando(true);
        try {
            let datosParaEnviar = { ...formData };

            if (datosParaEnviar.fecha_nacimiento?.includes('/')) {
                const [dia, mes, anio] = datosParaEnviar.fecha_nacimiento.split('/');
                datosParaEnviar.fecha_nacimiento = `${anio}-${mes}-${dia}`;
            }

            await api.put(`/auth/perfil/${user.id}`, datosParaEnviar);

            const usuarioActualizado = { ...user, ...datosParaEnviar };
            localStorage.setItem('user', JSON.stringify(usuarioActualizado));
            setUser(usuarioActualizado);

            alert('✨ ¡Perfil actualizado!');
            setEditando(false);
        } catch (error) {
            console.error('Error real:', error);
            console.error('Status:', error.response?.status);
            console.error('Data:', error.response?.data);
            alert('Error al guardar los cambios.');
        } finally {
            setCargando(false);
        }
    };

    const handleCambiarPassword = async () => {
        const actual  = window.prompt('Contraseña actual:');
        if (!actual) return;
        const nueva   = window.prompt('Nueva contraseña (mín. 8, 1 mayúscula, 1 número):');
        if (!nueva) return;
        const confirm = window.prompt('Confirmar nueva contraseña:');
        if (!confirm) return;

        try {
            await api.put(`/auth/perfil/${user.id}/password`, {
                password_actual:  actual,
                password_nueva:   nueva,
                confirm_password: confirm,
            });
            alert('✅ Contraseña actualizada');
        } catch (error) {
            const detail = error.response?.data?.detail || 'Error al cambiar la contraseña';
            alert(`❌ ${detail}`);
        }
    };

    const userId = user?.id || user?.id_docente || user?.user?.id || user?.sub;

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div style={{
            background: '#fff9c4',
            width: '100%',
            maxWidth: '1100px',
            maxHeight: '82vh',
            margin: '0 auto',
            padding: '40px 35px 30px',
            overflowY: 'auto',
            boxShadow: '10px 10px 30px rgba(0,0,0,0.35)',
            borderBottomRightRadius: '40px 200px',
            transform: 'rotate(-0.5deg)',
            fontFamily: "'Inkfree', 'Indie Flower', cursive",
            color: '#1f2937',
            position: 'relative',
            boxSizing: 'border-box',
        }}>

            {/* CHINCHE */}
            <div style={{
                position: 'absolute', top: '12px', left: '50%',
                transform: 'translateX(-50%)', width: '20px', height: '20px',
                background: '#dc2626', borderRadius: '50%',
                boxShadow: '2px 2px 5px rgba(0,0,0,0.4)', zIndex: 5,
            }} />

            {/* FILA SUPERIOR: Título + Botones */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '2px dashed rgba(0,0,0,0.15)', paddingBottom: '16px' }}>
                <h1 style={{ fontFamily: "'KG Midnight Memories', cursive", fontSize: '2.8rem', color: '#1e3a8a', margin: 0 }}>
                    Mi Perfil
                </h1>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={onVolver} className="perfil-edit-btn"
                        style={{ backgroundColor: '#e0f2fe', borderColor: '#7dd3fc' }}>
                        ⬅ Volver
                    </button>
                    <button onClick={editando ? handleGuardar : () => setEditando(true)} className="perfil-edit-btn">
                        {cargando ? '...' : editando ? '💾 Guardar' : '✏️ Editar'}
                    </button>
                </div>
            </div>

            {/* CONTENIDO: dos columnas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '32px' }}>

                {/* COLUMNA IZQUIERDA: datos personales */}
                <div>
                    {[
                        { label: 'Nombre y Apellido:',    name: 'nombre' },
                        { label: 'Nombre de Usuario:',    name: 'username' },
                        { label: 'Fecha de Nacimiento:',  name: 'fecha_nacimiento', type: 'date' },
                        { label: 'Ciudad:',               name: 'ciudad' },
                        { label: 'Email Institucional:',  name: 'email', static: true },
                        { label: 'Teléfono / WhatsApp:',  name: 'telefono' },
                    ].map((campo) => (
                        <div key={campo.name} className="perfil-data-row">
                            <label className="perfil-label">{campo.label}</label>
                            {campo.static ? (
                                <span className="perfil-value-text italic text-black">{formData[campo.name]}</span>
                            ) : editando ? (
                                <input type={campo.type || 'text'} name={campo.name}
                                    value={formData[campo.name]} onChange={handleChange}
                                    className="perfil-input" />
                            ) : (
                                <span className="perfil-value-text">
                                    {campo.name === 'username' ? `@${formData[campo.name]}` : (formData[campo.name] || '---')}
                                </span>
                            )}
                        </div>
                    ))}
                </div>

                {/* COLUMNA DERECHA: Seguridad */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="perfil-privacy-box">
                        <p className="perfil-privacy-title">Seguridad</p>
                        <button onClick={handleCambiarPassword} className="text-sm underline">
                            🔒 Cambiar contraseña
                        </button>
                    </div>
                </div>
            </div>

            {/* SECCIÓN ESCUELAS — ancho completo, estado y lógica propios */}
            <EscuelasSection userId={userId} editando={editando} />
        </div>
    );
};

export default PerfilView;