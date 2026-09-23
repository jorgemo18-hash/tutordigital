import { callJson } from "./apiCore.js";

// El generador de hojas de ejercicios (ver academia.hojas-ejercicios.routes.js).
const BASE = "/api/v1/academia/hojas-ejercicios";

export function fetchCatalogoEjercicios() {
  return callJson(`${BASE}/catalogo`);
}

// `semilla` opcional: sin ella el servidor inventa una y la devuelve, y con
// la misma semilla sale exactamente la misma hoja. `actividades` opcional:
// sin ella, "automático" (las que quepan en los folios de la intensidad).
export function generarHojaEjercicios({ objetivo, intensidad, semilla, actividades }) {
  const cuerpo = { objetivo, intensidad };
  if (semilla) cuerpo.semilla = semilla;
  if (actividades) cuerpo.actividades = actividades;
  return callJson(`${BASE}/generar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}
