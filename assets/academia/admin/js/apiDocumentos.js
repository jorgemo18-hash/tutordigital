// Llamadas de la sección Documentos (hoja de inscripción, normas, texto de
// protección de datos) — separadas de api.js cuando ese archivo estaba a
// punto de superar las 400 líneas.
import { apiFetch } from "../../../shared/js/auth.js";
import { parseJson, redirectIfUnauthorized, callJson } from "./apiCore.js";

// A diferencia del resto de llamadas de este archivo, la respuesta no es
// JSON — es el PDF en sí (ver hojaInscripcion.routes.js), así que no puede
// pasar por callJson. El llamador crea un object URL con el blob resultante
// y lo abre en una pestaña nueva (ver documentos/hojaInscripcionCard.js).
export async function descargarHojaInscripcion() {
  const res = await apiFetch("/api/v1/academia/documentos/hoja-inscripcion");
  if (redirectIfUnauthorized(res)) throw new Error("Sesión caducada.");
  if (!res.ok) {
    const body = await parseJson(res);
    throw new Error(body?.error?.message || "No se pudo generar la hoja de inscripción.");
  }
  return res.blob();
}

// null (no callJson) cuando aún no hay documento subido — un 404 aquí es un
// estado normal ("Subir normas" en vez de "Ver normas"), no un error a
// mostrar en pantalla (ver documentos/normasCard.js). Solo metadata (mime,
// updatedAt) — el documento en sí se pide aparte con descargarNormas().
export async function fetchNormas() {
  const res = await apiFetch("/api/v1/academia/documentos/normas");
  if (redirectIfUnauthorized(res)) throw new Error("Sesión caducada.");
  if (res.status === 404) return null;
  const body = await parseJson(res);
  if (!res.ok) throw new Error(body?.error?.message || "No se pudo comprobar el documento de normas.");
  return body?.data || null;
}

export async function uploadNormas({ base64, mime }) {
  return callJson("/api/v1/academia/documentos/normas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64, mime }),
  });
}

// Igual que descargarHojaInscripcion: la respuesta es el documento en sí
// (proxied desde Storage, ver normas.routes.js), no JSON — el llamador
// crea un object URL con el blob resultante (ver documentos/preview/).
export async function descargarNormas() {
  const res = await apiFetch("/api/v1/academia/documentos/normas/archivo");
  if (redirectIfUnauthorized(res)) throw new Error("Sesión caducada.");
  if (!res.ok) {
    const body = await parseJson(res);
    throw new Error(body?.error?.message || "No se pudo descargar el documento de normas.");
  }
  return res.blob();
}

export async function fetchTextoInscripcion() {
  const data = await callJson("/api/v1/academia/documentos/inscripcion-texto");
  return data.contenido || "";
}

export async function guardarTextoInscripcion(contenido) {
  const data = await callJson("/api/v1/academia/documentos/inscripcion-texto", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contenido }),
  });
  return data.contenido || "";
}

export async function extraerTextoInscripcion({ base64, mime }) {
  const data = await callJson("/api/v1/academia/documentos/inscripcion-texto/extraer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64, mime }),
  });
  return data.contenido || "";
}
