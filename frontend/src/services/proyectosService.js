import api from "../api/axios";

const getEscuelas = async (id_docente) => {
  const res = await api.get(`/proyectos/escuelas/${id_docente}`);
  return res.data;
};

const getCursosPorEscuela = async (id_escuela) => {
  const res = await api.get(`/proyectos/cursos/${id_escuela}`);
  return res.data;
};

const crearEscuela = async (data) => {
  const res = await api.post(`/proyectos/escuelas`, data);
  return res.data;
};

const crearCurso = async (data) => {
  const res = await api.post(`/proyectos/cursos`, data);
  return res.data;
};

const eliminarEscuela = async (id_escuela) => {
  await api.delete(`/proyectos/escuelas/${id_escuela}`);
};

const eliminarCurso = async (id_curso) => {
  await api.delete(`/proyectos/cursos/${id_curso}`);
};

export default {
  getEscuelas,
  getCursosPorEscuela,
  crearEscuela,
  crearCurso,
  eliminarEscuela,
  eliminarCurso,
};