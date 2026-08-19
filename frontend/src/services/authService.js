// src/services/authService.js
import api from '../api/axios';

// Función para iniciar sesión
export const loginUser = async (username, password) => {
  try {
    const response = await api.post('/auth/login', { username, password });
    
    if (response.data && response.data.access_token) {
      // Ajustado a 'token' y 'user' para coincidir con AuthContext
      localStorage.setItem('token', response.data.access_token);
      
      if (response.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      return { 
        success: true, 
        user: response.data.user, 
        token: response.data.access_token 
      };
    }
    
    return { success: false, message: 'No se recibió un token válido.' };

  } catch (error) {
    const detail = error.response?.data?.detail || error.response?.data?.message;
    const message = typeof detail === 'string'
      ? detail
      : detail?.message || error.message || 'Error al iniciar sesión.';
    return { success: false, message, error: detail };
  }
};

// Función para cerrar sesión
export const logoutUser = () => {
  // Ajustado a las claves unificadas
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
};

// Verificar si el usuario está logueado
export const isAuthenticated = () => {
  return !!localStorage.getItem('token');
};

/**
 * FUNCIÓN DE REGISTRO ACTUALIZADA
 * Ahora envía el objeto completo que viene de la hoja de cuaderno
 */
export const registerUser = async (userData) => {
  try {
    // IMPORTANTE: Enviamos 'userData' directamente para que incluya los 11 campos
    console.log("Enviando legajo completo al backend...", userData);
    
    const response = await api.post('/auth/register', userData);
    
    return { success: true, data: response.data };
  } catch (error) {
    console.error("Error en el registro (Backend):", error.response?.data);
    
    // Si el backend devuelve un error de validación (422), extraemos el detalle
    const errorDetail = error.response?.data?.detail || {
      type: error.name || 'Error',
      message: error.message || 'Error al crear la cuenta',
      code: error.code,
      status: error.response?.status || null,
      details: null,
      hint: null,
    };
    
    return { 
      success: false, 
      message: errorDetail 
    };
  }
};