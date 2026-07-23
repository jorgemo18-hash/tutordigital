// Aparte de apiProfesores.js a propósito: estas llamadas van contra
// /api/v1/academia/profesores/* (rutas propias de academia, ver
// server/routes/v1/academia-profesores/asignaciones.routes.js), no contra
// /api/v1/admin/teachers/* como el resto de ese archivo.
import { callJson } from "./apiCore.js";

export async function fetchAlumnosDisponibles() {
  const data = await callJson("/api/v1/academia/profesores/alumnos-disponibles");
  return data.alumnos || [];
}

export async function fetchAlumnosDeProfesor(profesorId) {
  const data = await callJson(`/api/v1/academia/profesores/${profesorId}/alumnos`);
  return data.alumnos || [];
}

export async function asignarAlumnoAProfesor(profesorId, alumnoId) {
  return callJson(`/api/v1/academia/profesores/${profesorId}/alumnos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alumno_id: alumnoId }),
  });
}

export async function quitarAlumnoDeProfesor(profesorId, alumnoId) {
  return callJson(`/api/v1/academia/profesores/${profesorId}/alumnos/${alumnoId}`, { method: "DELETE" });
}
