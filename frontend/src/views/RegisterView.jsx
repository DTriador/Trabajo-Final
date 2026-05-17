import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerUser } from '../services/authService';
import proyectosService from "../services/proyectosService"; 
import './Login.css'; 

import fondoHoja from '../assets/img/fondo-hoja.png';

const RegisterView = () => {
  const [formData, setFormData] = useState({
    nombre: '',
    username: '',
    fecha_nacimiento: '',
    ciudad: '',
    colegio: '',
    materia: '',
    division: '',
    email: '',
    telefono: '',
    password: '',
    confirm_password: ''
  });
  
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const payload = {
    nombre: formData.nombre,
    username: formData.username,
    fecha_nacimiento: formData.fecha_nacimiento,
    ciudad: formData.ciudad,
    telefono: formData.telefono,
    email: formData.email,
    password: formData.password,
    confirm_password: formData.confirm_password,

    escuelas: [
      {
        nombre: formData.colegio,
        materias: [
          {
            nombre: formData.materia,
            division: formData.division
          }
        ]
      }
    ]
  };

    console.log("Payload final:", payload);

    if (formData.password !== formData.confirm_password) {
      alert("Las contraseñas no coinciden.");
      return;
    }
    
    const result = await registerUser(payload);
    
    if (result.success) {

      alert("¡Cuenta creada exitosamente! Bienvenida a Kōkua.");
      navigate('/login');

    } else {
      const errorMsg = typeof result.message === 'object' 
        ? JSON.stringify(result.message, null, 2) 
        : result.message;
      
      console.error("ERROR BACKEND COMPLETO:", JSON.stringify(result.message, null, 2));

      alert(
        "Error de registro:\n" +
        JSON.stringify(result.message, null, 2)
      );
    }
  };

  return (
    <div id="register-screen" className="screen">
      <div className="login-layout-wrapper">
        
        <div className="login-side-left">
          <h1 className="logo-chalk-header">Kōkua</h1>
          <p className="chalk-subtitle">Completá tu legajo docente</p>
        </div>

        <div className="login-side-right">
          <div 
            className="notebook-paper register-paper" 
            style={{ backgroundImage: `url(${fondoHoja})` }}
          >
            <form className="register-form-notebook" onSubmit={handleSubmit}>
              
              <div className="notebook-grid">
                <input 
                  name="nombre" 
                  type="text" 
                  placeholder="Nombre y Apellido" 
                  className="input-handwritten-full" 
                  value={formData.nombre}
                  required 
                  onChange={handleChange} 
                />

                <input 
                  name="username" 
                  type="text" 
                  placeholder="Usuario" 
                  className="input-handwritten-full" 
                  value={formData.username}
                  required 
                  onChange={handleChange} 
                />
                
                <div className="flex flex-col">
                  <label className="label-date">Fecha Nacimiento</label>
                  <input 
                    name="fecha_nacimiento" 
                    type="date" 
                    className="input-handwritten-full" 
                    value={formData.fecha_nacimiento}
                    required 
                    onChange={handleChange} 
                  />
                </div>

                <input name="ciudad" type="text" placeholder="Ciudad" className="input-handwritten-full" value={formData.ciudad} required onChange={handleChange} />
                <input name="colegio" type="text" placeholder="Colegio" className="input-handwritten-full" value={formData.colegio} required onChange={handleChange} />
                <input name="materia" type="text" placeholder="Materia" className="input-handwritten-full" value={formData.materia} required onChange={handleChange} />
                <input name="division" type="text" placeholder="División" className="input-handwritten-full" value={formData.division} required onChange={handleChange} />
                <input name="telefono" type="tel" placeholder="Teléfono" className="input-handwritten-full" value={formData.telefono} required onChange={handleChange} />
                
                <input 
                  name="email" 
                  type="email" 
                  placeholder="Email Institucional" 
                  className="input-handwritten-full col-span-full" 
                  value={formData.email}
                  required 
                  onChange={handleChange} 
                />
                
                <input 
                  name="password" 
                  type="password" 
                  placeholder="Contraseña" 
                  className="input-handwritten-full" 
                  value={formData.password}
                  required 
                  onChange={handleChange} 
                />

                <input 
                  name="confirm_password" 
                  type="password" 
                  placeholder="Repetir" 
                  className="input-handwritten-full" 
                  value={formData.confirm_password}
                  required 
                  onChange={handleChange} 
                />
              </div>

              <div className="notebook-actions-register">
                <button type="submit" className="sticker-btn sticker-pink">Finalizar</button>
                <button type="button" className="sticker-btn sticker-green" onClick={() => navigate('/login')}>
                  Volver
                </button>
              </div>

            </form>
          </div>
        </div>

      </div>
    </div>
  );
};

export default RegisterView;