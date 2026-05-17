// src/context/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext } from "react";
import { loginUser, logoutUser } from "../services/authService";
import api from "../api/axios"; 

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Recuperamos la sesión si existe
    const savedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  // --- LOGIN NORMAL ---
  const login = async (email, password) => {
    // Usamos el servicio externo
    const result = await loginUser(email, password);

    if (result.success) {
      setUser(result.user);
      return { success: true };
    } else {
      return { success: false, message: result.message };
    }
  };


// --- LOGIN CON GOOGLE ---
const loginConGoogle = async (credential) => {
    try {
        const res = await api.post('/auth/google', { credential });
        const { access_token, user: userData } = res.data;
        localStorage.setItem('token', access_token);
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        return { success: true };
    } catch (error) {
        console.error('Error en Google Auth:', error.response?.data || error);
        return {
            success: false,
            message: error.response?.data?.detail || 'No se pudo ingresar con Google',
        };
    }
};

  // --- LOGOUT ---
  const logout = () => {
    logoutUser(); // El servicio se encarga de limpiar el localStorage y redirigir
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, loginConGoogle, logout, loading }}>
        {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);