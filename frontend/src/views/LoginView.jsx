import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import api from '../api/axios';
import './Login.css';
//import fondoHoja from '../assets/img/fondo-hoja.png';

const LoginView = () => {
    const [showLoading, setShowLoading] = useState(true);
    const [displayText, setDisplayText] = useState("");
    const [isFading, setIsFading] = useState(false);
    const [isSigning, setIsSigning] = useState(false);
    
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [mostrarOlvide, setMostrarOlvide] = useState(false);
    const [emailReset, setEmailReset] = useState('');
    const [enviandoReset, setEnviandoReset] = useState(false);
    // Detectar si vino por link de reseteo
    const [tokenReset, setTokenReset] = useState(null);
    const [nuevaPass, setNuevaPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    
    const { login, loginConGoogle } = useAuth();
    const navigate = useNavigate();
    const fullText = "Kōkua";

    useEffect(() => {
        if (showLoading && displayText.length < fullText.length) {
            const timeout = setTimeout(() => {
                setDisplayText(fullText.slice(0, displayText.length + 1));
            }, 250);
            return () => clearTimeout(timeout);
        } else if (showLoading && displayText.length === fullText.length) {
            const timer = setTimeout(() => {
                setIsFading(true);
                setTimeout(() => setShowLoading(false), 600);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [displayText, showLoading]);
   
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('reset_token');
        if (token) setTokenReset(token);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const result = await login(username, password);
        if (result.success) {
            setIsSigning(true);
            setTimeout(() => navigate('/dashboard'), 2200);
        } else {
            alert(result.message || "Credenciales incorrectas.");
        }
    };

    // Manejador para el login exitoso de Google
    const handleGoogleSuccess = async (credentialResponse) => {
        const result = await loginConGoogle(credentialResponse.credential);
        if (result.success) {
            setIsSigning(true);
            setTimeout(() => navigate('/dashboard'), 1500);
        } else {
            alert(result.message || "Error al ingresar con Google.");
        }
    };

    if (showLoading) {
        return (
            <div className={`screen ${isFading ? 'hidden' : ''}`} style={{ opacity: isFading ? 0 : 1 }}>
                <div className="chalkboard">
                    <h1 className="chalk-font">{displayText}</h1> 
                    <div className="chalk-dust"></div>
                </div>
            </div>
        );
    }
    const handleOlvide = async () => {
        if (!emailReset.trim()) { alert("Ingresá tu email"); return; }
        setEnviandoReset(true);
        try {
            const fd = new FormData();
            fd.append('email', emailReset);
            await api.post('/auth/forgot-password', fd);
            alert("✉️ Si el email existe, recibirás un correo con instrucciones para restablecer tu contraseña.");
            setMostrarOlvide(false);
            setEmailReset('');
        } catch (e) {
            alert(`Error: ${e.response?.data?.detail || e.message}`);
        } finally {
            setEnviandoReset(false);
        }
        };

    const handleResetPassword = async () => {
        if (nuevaPass.length < 8) { alert("Mínimo 8 caracteres"); return; }
        if (nuevaPass !== confirmPass) { alert("Las contraseñas no coinciden"); return; }
        try {
            const fd = new FormData();
            fd.append('token', tokenReset);
            fd.append('nueva_password', nuevaPass);
            await api.post('/auth/reset-password', fd);
            alert("✅ Contraseña actualizada. Iniciá sesión con la nueva.");
            setTokenReset(null);
            window.history.replaceState({}, '', window.location.pathname);
        } catch (e) {
            alert(`Error: ${e.response?.data?.detail || e.message}`);
        }
    };

    return (
        <div id="login-screen" className="screen">
            <div className={`login-layout-wrapper ${isSigning ? 'blur-sm' : ''}`}>
                <div className="login-side-left">
                    <h1 className="logo-chalk-header">Kōkua</h1>
                    <p className="chalk-subtitle">Asistente docente</p>
                </div>

                <div className="login-side-right">
                    {/* CORRECCIÓN CRÍTICA: Estilos inline para evitar que PerfilView.css lo pise */}
                    <div 
                        className="notebook-paper" 
                        style={{ 
                            backgroundImage: "url('/img/fondo-hoja.png')", // Ruta de la carpeta public
                            backgroundSize: '100% 100%', // Fuerza a que se vea la hoja completa
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'center',
                            width: '100%',
                            maxWidth: '500px', // Ajustamos el ancho
                            minHeight: '600px', // Ajustamos el alto para que no se corte
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            padding: '40px',
                            backgroundColor: 'transparent',
                            boxShadow: 'none' // Evita sombras dobles
                        }}
                    >
                        <form className="login-form-notebook" onSubmit={handleSubmit} style={{ width: '100%' }}>
                            <div className="notebook-field" style={{ marginBottom: '25px' }}>
                                <label style={{ fontWeight: 'bold', display: 'block' }}>Usuario:</label>
                                <input 
                                    type="text" 
                                    className="input-handwritten" 
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    style={{ width: '100%', background: 'transparent' }}
                                />
                            </div>
                            <div className="notebook-field" style={{ marginBottom: '25px' }}>
                                <label style={{ fontWeight: 'bold', display: 'block' }}>Contraseña:</label>
                                <input 
                                    type="password" 
                                    className="input-handwritten" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    style={{ width: '100%', background: 'transparent' }}
                                />
                            </div>
                            <div className="notebook-actions">
                                <button type="submit" className="sticker-btn sticker-pink">Ingresar</button>
                                <button type="button" className="sticker-btn sticker-green" onClick={() => navigate('/registro')}>Registrarme</button>
                                <button
                                    type="button"
                                    onClick={() => setMostrarOlvide(true)}
                                    style={{ background: 'none', border: 'none', color: '#7afcff', textDecoration: 'underline', cursor: 'pointer', marginTop: 10, fontSize: '0.95rem' }}
                                    >
                                    ¿Olvidaste tu contraseña?
                                </button>
                            </div>

                            <div className="google-auth-container" style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
                                <GoogleLogin
                                    onSuccess={handleGoogleSuccess}
                                    onError={() => alert("Error al conectar con Google")}
                                    useOneTap
                                    theme="filled_blue"
                                    shape="pill"
                                    text="continue_with"
                                />
                            </div>
                        </form>
                    </div>
                </div>
            </div>
            {/* Modal: Pedir email */}
            {mostrarOlvide && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ background: 'white', borderRadius: 16, padding: 30, width: '90%', maxWidth: 450 }}>
                <h2 style={{ margin: '0 0 16px', color: '#1f2937' }}>🔒 Restablecer contraseña</h2>
                <p style={{ color: '#64748b', marginBottom: 16 }}>
                    Ingresá tu email y te enviaremos un link para crear una nueva contraseña.
                </p>
                <input
                    type="email"
                    placeholder="tu@email.com"
                    value={emailReset}
                    onChange={e => setEmailReset(e.target.value)}
                    style={{ width: '100%', padding: 12, border: '2px solid #cbd5e1', borderRadius: 8, marginBottom: 16, fontSize: '1rem' }}
                />
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={() => setMostrarOlvide(false)} style={{ padding: '10px 20px', background: '#e5e7eb', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancelar</button>
                    <button onClick={handleOlvide} disabled={enviandoReset} style={{ padding: '10px 20px', background: '#f472b6', color: 'white', border: 'none', borderRadius: 8, cursor: enviandoReset ? 'wait' : 'pointer', fontWeight: 'bold' }}>
                    {enviandoReset ? 'Enviando...' : '✉️ Enviar link'}
                    </button>
                </div>
                </div>
            </div>
            )}

            {/* Modal: Nueva contraseña (al volver del email) */}
            {tokenReset && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ background: 'white', borderRadius: 16, padding: 30, width: '90%', maxWidth: 450 }}>
                <h2 style={{ margin: '0 0 16px', color: '#1f2937' }}>🔑 Crear nueva contraseña</h2>
                <input
                    type="password"
                    placeholder="Nueva contraseña (mín. 8)"
                    value={nuevaPass}
                    onChange={e => setNuevaPass(e.target.value)}
                    style={{ width: '100%', padding: 12, border: '2px solid #cbd5e1', borderRadius: 8, marginBottom: 12, fontSize: '1rem' }}
                />
                <input
                    type="password"
                    placeholder="Confirmar contraseña"
                    value={confirmPass}
                    onChange={e => setConfirmPass(e.target.value)}
                    style={{ width: '100%', padding: 12, border: '2px solid #cbd5e1', borderRadius: 8, marginBottom: 16, fontSize: '1rem' }}
                />
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={() => { setTokenReset(null); window.history.replaceState({}, '', window.location.pathname); }} style={{ padding: '10px 20px', background: '#e5e7eb', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancelar</button>
                    <button onClick={handleResetPassword} style={{ padding: '10px 20px', background: '#22c55e', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}>
                    ✅ Guardar
                    </button>
                </div>
                </div>
            </div>
            )}
        </div>
    );

};

export default LoginView;