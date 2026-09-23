import { callJson } from "./apiCore.js";

// El generador de hojas de ejercicios (ver academia.hojas-ejercicios.routes.js).
const BASE = "/api/v1/academia/hojas-ejercicios";

export function fetchCatalogoEjercicios() {
  return callJson(`${BASE}/catalogo`);
}

// `semilla` opcional: sin ella el servidor inventa una y la devuelve, y con
// la misma semilla sale exactamente la misma hoja. `actividades` opcional:
// sin ella, "automático" (las que quepan en los folios de la intensidad).
export function generarHojaEjercicios({ temaId, objetivo, intensidad, semilla, actividades }) {
  const cuerpo = { temaId, objetivo, intensidad };
  if (semilla) cuerpo.semilla = semilla;
  if (actividades) cuerpo.actividades = actividades;
  return callJson(`${BASE}/generar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}

// Un ejercicio suelto (una batería concreta) para cambiar uno de la hoja sin
// rehacer los demás. Sin `semilla`, otros números cada vez.
export function generarActividadEjercicios({ temaId, objetivo, intensidad, clave }) {
  return callJson(`${BASE}/actividad`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ temaId, objetivo, intensidad, clave }),
  });
}
