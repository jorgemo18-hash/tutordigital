import { callJson } from "./apiCore.js";

// El diario visto por el ADMIN con el sombrero de profesor.
//
// `ambito=profesor` es la diferencia con la llamada del panel de profesor:
// pide el conjunto de alumnos de un profesor aunque quien pregunta sea
// admin. Sin él, el servidor le devolvería al admin TODOS los alumnos del
// centro — correcto gestionando, inútil dando clase en una academia con
// varios profesores, donde lo que necesita ver son los suyos.
//
// Nunca puede ampliar lo que se ve: solo convierte "sin filtro" en
// "filtrado por mis asignaciones" (ver resolverAlumnoIdsVisibles).
export async function fetchDiarioComoProfesor(fecha) {
  const data = await callJson(
    `/api/v1/academia/sesiones?fecha=${encodeURIComponent(fecha)}&ambito=profesor`
  );
  return { ...data, sinAlumnosAsignados: Boolean(data.sin_alumnos_asignados) };
}
