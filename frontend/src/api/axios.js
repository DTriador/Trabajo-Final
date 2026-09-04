import axios from 'axios';

/**
 * Configuración centralizada de Axios para Kōkua.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  }
});

/**
 * Interceptor para adjuntar el Token JWT.
 * Sincronizado con AuthContext y authService (usa la clave 'token').
 */
api.interceptors.request.use((config) => {
  // CORRECCIÓN: Usamos 'token' para ser consistentes con el resto de la app
  const token = localStorage.getItem('token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

/**
 * Métodos específicos para el Calendario
 * Ajustados a las rutas definidas en router_planificacion.py, montado en
 * main.py bajo el prefijo /api/v1/generar (mismo prefijo que usa
 * PlanificacionWizard.jsx para /wizard y /distribuir).
 */
export const calendarAPI = {
  // Ajustado a: /api/v1/generar/planificacion/cronograma/{id}
  getEventos: (idPlanificacion) => api.get(`/generar/planificacion/cronograma/${idPlanificacion}`),

  // Estos se usarán cuando implementemos la edición en el service
  actualizarEvento: (idEvento, data) => api.put(`/generar/planificacion/evento/${idEvento}`, data),
  sincronizarGoogle: () => api.post('/externo/google-calendar/sync'),
};

export default api;