import { callJson } from "./apiCore.js";

// El generador de hojas de ejercicios (ver academia.hojas-ejercicios.routes.js).
const BASE = "/api/v1/academia/hojas-ejercicios";

export function fetchCatalogoEjercicios() {
  return callJson(`${BASE}/catalogo`);
}

// `semilla` opcional: sin ella el servidor inventa una y la devuelve, y con
// la misma semilla sale exactamente la misma hoja.
export function generarHojaEjercicios({ objetivo, intensidad, semilla }) {
  return callJson(`${BASE}/generar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(semilla ? { objetivo, intensidad, semilla } : { objetivo, intensidad }),
  });
}
