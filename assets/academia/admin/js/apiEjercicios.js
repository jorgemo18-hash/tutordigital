import { callJson } from "./apiCore.js";
import { apiFetch } from "../../../shared/js/auth.js";

// El generador de hojas de ejercicios (ver academia.hojas-ejercicios.routes.js).
const BASE = "/api/v1/academia/hojas-ejercicios";

export function fetchCatalogoEjercicios() {
  return callJson(`${BASE}/catalogo`);
}

// `semilla` opcional: sin ella el servidor inventa una y la devuelve, y con
// la misma semilla sale exactamente la misma hoja. `actividades` opcional:
// sin ella, "automático" (las que quepan en los folios de la intensidad).
export function generarHojaEjercicios({ temaId, objetivo, intensidad, semilla, actividades, baterias }) {
  const cuerpo = { temaId, objetivo, intensidad };
  if (semilla) cuerpo.semilla = semilla;
  if (baterias?.length) cuerpo.baterias = baterias;
  else if (actividades) cuerpo.actividades = actividades;
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

// El pedido en palabras (fase 2): la conversación entera y lo que hay en
// pantalla. Devuelve una de: hoja (con `plan`), ejercicio (con `clave`),
// pregunta, o fuera_de_catalogo. Ver interpretePedido.js en el servidor.
export function interpretarPedidoEjercicios({ conversacion, contexto }) {
  return callJson(`${BASE}/interpretar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversacion, contexto }),
  });
}

// La hoja en PDF (función de Vercel /api/hoja-pdf, en el MISMO dominio que el
// panel, no en la API de Render: ver api/hoja-pdf.js). Se manda el contenido
// tal como está en pantalla, con los cambios sueltos que se hayan hecho.
// Devuelve el PDF como Blob.
export async function pedirPdfDeLaHoja(hoja, { apiFetchFn = apiFetch, origen = globalThis.location?.origin } = {}) {
  const res = await apiFetchFn(`${origen}/api/hoja-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hoja }),
  });
  if (!res.ok) {
    const cuerpo = await res.json().catch(() => ({}));
    throw new Error(cuerpo?.error?.message || "No se pudo generar el PDF.");
  }
  return res.blob();
}
