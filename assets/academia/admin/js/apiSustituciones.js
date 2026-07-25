// Aparte de api.js a propósito — mismo criterio que apiFichajes.js: api.js
// ya ronda las 400 líneas mezclando alumnos/familias/recibos/informes, no
// hace falta crecerlo más para una funcionalidad nueva y autocontenida.
import { callJson } from "./apiCore.js";

export async function fetchProfesoresParaSustitucion() {
  const data = await callJson("/api/v1/academia/sustituciones/profesores");
  return data.profesores || [];
}

export async function fetchSustituciones() {
  const data = await callJson("/api/v1/academia/sustituciones");
  return data.sustituciones || [];
}

export async function crearSustitucion({ profesor_sustituto_id, profesor_sustituido_id, fecha_inicio, fecha_fin }) {
  return callJson("/api/v1/academia/sustituciones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profesor_sustituto_id, profesor_sustituido_id, fecha_inicio, fecha_fin }),
  });
}

export async function revocarSustitucion(id) {
  return callJson(`/api/v1/academia/sustituciones/${id}/revocar`, { method: "POST" });
}
