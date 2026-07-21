import { apiFetch, getTenantSlug } from "../../../shared/js/auth.js";
import { parseJson, redirectIfUnauthorized, callJson } from "./apiCore.js";

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

// Variante paginada de fetchAlumnos, para la lista de Alumnos (ver
// alumnosList.js) — fetchAlumnos() se deja tal cual (array completo, sin
// paginar) porque otros llamadores (familiaSection.js) necesitan TODOS los
// alumnos activos para comprobar quién queda en la familia origen al
// cambiar de familia, no una página.
export async function fetchAlumnosPagina({ activo, q, page = 1, pageSize = 30 } = {}) {
  const params = new URLSearchParams();
  if (activo !== undefined) params.set("activo", String(activo));
  if (q) params.set("q", q);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  const data = await callJson(`/api/v1/academia/alumnos?${params.toString()}`);
  return {
    alumnos: data.alumnos || [],
    total: data.total ?? 0,
    page: data.page ?? page,
    pageSize: data.pageSize ?? pageSize,
  };
}

export async function fetchAlumno(id) {
  const data = await callJson(`/api/v1/academia/alumnos/${id}`);
  return data.alumno;
}

// Devuelve la respuesta completa (no solo data.alumno) porque también trae
// acceso_warning cuando la ficha se creó pero no se pudo dar de alta el
// acceso del alumno al tutor (ver guardarNuevo/guardarBorrador en
// alumnoDrawer.js, que sí necesitan distinguir ambos campos).
export async function createAlumno(payload) {
  return callJson("/api/v1/academia/alumnos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
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

export async function eliminarAlumnoDefinitivo(id) {
  return callJson(`/api/v1/academia/alumnos/${id}`, { method: "DELETE" });
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
  return callJson("/api/v1/academia/recibos/generar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mes, anio }),
  });
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

export async function enviarInforme({ alumno_id, mes, anio }) {
  return callJson("/api/v1/academia/enviar-informe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alumno_id, mes, anio }),
  });
}

export async function fetchInformePreview(alumnoId, { mes, anio }) {
  return callJson(`/api/v1/academia/informes/${alumnoId}?mes=${mes}&anio=${anio}`);
}

export async function generarInforme({ alumno_id, mes, anio, forzar = false, confirmar = false }) {
  return callJson("/api/v1/academia/informes/generar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alumno_id, mes, anio, forzar, confirmar }),
  });
}

export async function regenerarInformes({ mes, anio, confirmar = false }) {
  return callJson("/api/v1/academia/informes/regenerar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mes, anio, confirmar }),
  });
}

export async function editarComentarioInforme({ alumno_id, mes, anio, comentario }) {
  return callJson("/api/v1/academia/informes/comentario", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alumno_id, mes, anio, comentario }),
  });
}

export async function fetchMesesEnviados(anio) {
  const data = await callJson(`/api/v1/academia/recibos/meses-enviados?anio=${anio}`);
  return data.meses || [];
}

export async function regenerarRecibos({ mes, anio, confirmar = false }) {
  return callJson("/api/v1/academia/recibos/regenerar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mes, anio, confirmar }),
  });
}

export async function regenerarRecibo(id, confirmar = false) {
  return callJson(`/api/v1/academia/recibos/${id}/regenerar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmar }),
  });
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

// Sin `tipo`: lista completa (activos e inactivos) para el CRUD de
// Ajustes. Con `tipo` ("email"|"recibos"): solo el contenido de los
// activos de ese tipo (+ "ambos"), tal cual los usa buildReciboPreview.
export async function fetchTextosLegales({ tipo } = {}) {
  const qs = tipo ? `?tipo=${tipo}` : "";
  const data = await callJson(`/api/v1/academia/textos-legales${qs}`);
  return data.textos || [];
}

export async function createTextoLegal(payload) {
  const data = await callJson("/api/v1/academia/textos-legales", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return data.texto;
}

export async function updateTextoLegal(id, payload) {
  const data = await callJson(`/api/v1/academia/textos-legales/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return data.texto;
}

export async function deleteTextoLegal(id) {
  return callJson(`/api/v1/academia/textos-legales/${id}`, { method: "DELETE" });
}

export async function fetchDescuentosAlumno(alumnoId) {
  const data = await callJson(`/api/v1/academia/alumnos/${alumnoId}/descuentos`);
  return data.descuentos || [];
}

export async function fetchEconomicoFamilia(familiaId) {
  return callJson(`/api/v1/academia/familias/${familiaId}/economico`);
}

export async function updateDescuentosAlumno(alumnoId, asignaciones) {
  return callJson(`/api/v1/academia/alumnos/${alumnoId}/descuentos`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(asignaciones),
  });
}
