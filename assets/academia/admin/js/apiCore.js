// Primitivas compartidas por api.js y apiDocumentos.js — separadas de
// api.js cuando ese archivo estaba a punto de superar las 400 líneas
// (ver documentosSection.js/inscripcionTab.js, que añadieron varias
// llamadas nuevas), para no duplicar parseJson/callJson en dos sitios.
import { apiFetch, clearSession } from "../../../shared/js/auth.js";

export async function parseJson(res) {
  return res.json().catch(() => ({}));
}

// Una sesión caducada/inválida no debe mostrarse como "error al cargar" —
// se corta el flujo y se manda al login, igual en cualquier llamada.
export function redirectIfUnauthorized(res) {
  if (res.status !== 401) return false;
  clearSession();
  window.location.href = "/login";
  return true;
}

export async function callJson(path, options) {
  const res = await apiFetch(path, options);
  if (redirectIfUnauthorized(res)) throw new Error("Sesión caducada.");
  const body = await parseJson(res);
  if (!res.ok) throw new Error(body?.error?.message || "No se pudo completar la operación.");
  return body?.data || {};
}
