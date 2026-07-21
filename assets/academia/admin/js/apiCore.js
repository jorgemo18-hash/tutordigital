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
  if (!res.ok) {
    // `code`/`details` (todo el objeto `error`, código y payload extra
    // incluidos) se adjuntan al Error para que llamadores concretos puedan
    // reaccionar a un código específico (ver requiere_confirmacion en
    // regenerarBoton.js) sin romper a quien solo lee `.message`.
    const err = new Error(body?.error?.message || "No se pudo completar la operación.");
    err.code = body?.error?.code || null;
    err.details = body?.error || {};
    throw err;
  }
  return body?.data || {};
}
