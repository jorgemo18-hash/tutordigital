import { apiFetch, clearSession, getTenantSlug } from "../../../shared/js/auth.js";

async function parseJson(res) {
  return res.json().catch(() => ({}));
}

// Una sesión caducada/inválida no debe mostrarse como "error al cargar" —
// se corta el flujo y se manda al login, igual en cualquier llamada.
function redirectIfUnauthorized(res) {
  if (res.status !== 401) return false;
  clearSession();
  window.location.href = "/login";
  return true;
}

async function callJson(path, options) {
  const res = await apiFetch(path, options);
  if (redirectIfUnauthorized(res)) throw new Error("Sesión caducada.");
  const body = await parseJson(res);
  if (!res.ok) throw new Error(body?.error?.message || "No se pudo completar la operación.");
  return body?.data || {};
}

export async function fetchMe() {
  const res = await apiFetch("/api/v1/me");
  if (redirectIfUnauthorized(res)) throw new Error("Sesión caducada.");
  const body = await parseJson(res);
  if (!res.ok) throw new Error(body?.error?.message || "No se pudo cargar el usuario.");
  const tenantSlug = getTenantSlug();
  const memberships = body?.data?.memberships || [];
  const membership = memberships.find((m) => m?.tenant?.slug === tenantSlug) || null;
  return {
    displayName: body?.data?.user?.display_name || "",
    role: membership?.role || "",
    tenantName: membership?.tenant?.name || tenantSlug || "",
  };
}

export async function fetchConfig() {
  const data = await callJson("/api/v1/academia/config");
  return data.config || null;
}

export async function fetchAlumnos({ activo } = {}) {
  const params = new URLSearchParams();
  if (activo !== undefined) params.set("activo", String(activo));
  const qs = params.toString();
  const data = await callJson(`/api/v1/academia/alumnos${qs ? `?${qs}` : ""}`);
  return data.alumnos || [];
}

export async function fetchAlumno(id) {
  const data = await callJson(`/api/v1/academia/alumnos/${id}`);
  return data.alumno;
}

export async function createAlumno(payload) {
  const data = await callJson("/api/v1/academia/alumnos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return data.alumno;
}

export async function updateAlumno(id, payload) {
  const data = await callJson(`/api/v1/academia/alumnos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return data.alumno;
}

export async function updateHorarioAlumno(id, horario) {
  const data = await callJson(`/api/v1/academia/alumnos/${id}/horario`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ horario }),
  });
  return data.horario || [];
}

export async function archivarAlumno(id) {
  return callJson(`/api/v1/academia/alumnos/${id}/archivar`, { method: "DELETE" });
}

export async function restaurarAlumno(id) {
  return callJson(`/api/v1/academia/alumnos/${id}/restaurar`, { method: "PUT" });
}

export async function fetchFamilias() {
  const data = await callJson("/api/v1/academia/familias");
  return data.familias || [];
}

export async function createFamilia(payload) {
  const data = await callJson("/api/v1/academia/familias", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return data.familia;
}

export async function fetchPendientes() {
  const data = await callJson("/api/v1/academia/inscripciones/pendientes");
  return data.alumnos || [];
}

export async function extraerInscripcion({ base64, mediaType }) {
  return callJson("/api/v1/academia/inscripciones/extraer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64, mediaType }),
  });
}

export async function uploadLogo({ base64, mime }) {
  const data = await callJson("/api/v1/academia/config/upload-logo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64, mime }),
  });
  return data.url;
}

export async function uploadBg({ base64, mime }) {
  const data = await callJson("/api/v1/academia/config/upload-bg", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64, mime }),
  });
  return data.url;
}

export async function updateConfig(payload) {
  const data = await callJson("/api/v1/academia/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return data.config;
}

export async function fetchRecibos({ mes, anio }) {
  const data = await callJson(`/api/v1/academia/recibos?mes=${mes}&anio=${anio}`);
  return data.recibos || [];
}

export async function generarRecibos({ mes, anio }) {
  const data = await callJson("/api/v1/academia/recibos/generar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mes, anio }),
  });
  return data.generados || 0;
}

export async function fetchRecibo(id) {
  const data = await callJson(`/api/v1/academia/recibos/${id}`);
  return data.recibo;
}

export async function updateRecibo(id, payload) {
  const data = await callJson(`/api/v1/academia/recibos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return data.recibo;
}

export async function enviarRecibo(id) {
  return callJson(`/api/v1/academia/recibos/${id}/enviar`, { method: "POST" });
}

export async function enviarTodosRecibos({ mes, anio }) {
  return callJson(`/api/v1/academia/recibos/enviar-todos?mes=${mes}&anio=${anio}`, { method: "POST" });
}

export async function fetchMesesEnviados(anio) {
  const data = await callJson(`/api/v1/academia/recibos/meses-enviados?anio=${anio}`);
  return data.meses || [];
}

export async function regenerarRecibos({ mes, anio }) {
  const data = await callJson("/api/v1/academia/recibos/regenerar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mes, anio }),
  });
  return data.regenerados || 0;
}

export async function regenerarRecibo(id) {
  return callJson(`/api/v1/academia/recibos/${id}/regenerar`, { method: "POST" });
}

export async function fetchHistorialRecibos(alumnoId) {
  const data = await callJson(`/api/v1/academia/alumnos/${alumnoId}/recibos-historial`);
  return data.historial || [];
}

export async function fetchDescuentosTipo() {
  const data = await callJson("/api/v1/academia/descuentos-tipo");
  return data.descuentos || [];
}

export async function createDescuentoTipo(payload) {
  const data = await callJson("/api/v1/academia/descuentos-tipo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return data.descuento;
}

export async function updateDescuentoTipo(id, payload) {
  const data = await callJson(`/api/v1/academia/descuentos-tipo/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return data.descuento;
}

export async function deleteDescuentoTipo(id) {
  return callJson(`/api/v1/academia/descuentos-tipo/${id}`, { method: "DELETE" });
}

export async function fetchDescuentosAlumno(alumnoId) {
  const data = await callJson(`/api/v1/academia/alumnos/${alumnoId}/descuentos`);
  return data.descuentos || [];
}

export async function updateDescuentosAlumno(alumnoId, asignaciones) {
  return callJson(`/api/v1/academia/alumnos/${alumnoId}/descuentos`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(asignaciones),
  });
}
