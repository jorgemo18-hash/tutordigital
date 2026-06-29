// Llamadas específicas de Finanzas — separadas de api.js (alumnos,
// familias, recibos, config...) para no acercarlo a las 400 líneas.
import { apiFetch, clearSession } from "../../../shared/js/auth.js";

async function parseJson(res) {
  return res.json().catch(() => ({}));
}

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

// ---- Ingresos ----

export async function fetchPendientesIngresos({ mes, anio }) {
  const data = await callJson(`/api/v1/academia/finanzas/ingresos/pendientes?mes=${mes}&anio=${anio}`);
  return data.grupos || [];
}

export async function fetchGridIngresos({ mes, anio }) {
  const data = await callJson(`/api/v1/academia/finanzas/ingresos/grid?mes=${mes}&anio=${anio}`);
  return data.filas || [];
}

export async function marcarReciboPagado(reciboId) {
  return callJson(`/api/v1/academia/recibos/${reciboId}/marcar-pagado`, { method: "PUT" });
}

export async function marcarReciboPendiente(reciboId) {
  return callJson(`/api/v1/academia/recibos/${reciboId}/marcar-pendiente`, { method: "PUT" });
}

// ---- Gastos ----

export async function fetchResumenGastos({ mes, anio }) {
  const data = await callJson(`/api/v1/academia/finanzas/gastos/resumen?mes=${mes}&anio=${anio}`);
  return data.resumen || {};
}

export async function fetchListaGastos({ mes, anio }) {
  const data = await callJson(`/api/v1/academia/finanzas/gastos/lista?mes=${mes}&anio=${anio}`);
  return data.gastos || [];
}

export async function fetchCategoriasGastos({ mes, anio }) {
  const data = await callJson(`/api/v1/academia/finanzas/gastos/categorias?mes=${mes}&anio=${anio}`);
  return data.categorias || [];
}

export async function createGasto(payload) {
  const data = await callJson("/api/v1/academia/finanzas/gastos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return data.gasto;
}

export async function extraerGasto({ base64, mediaType }) {
  return callJson("/api/v1/academia/finanzas/gastos/extraer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64, mediaType }),
  });
}

export async function updateGasto(id, payload) {
  const data = await callJson(`/api/v1/academia/finanzas/gastos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return data.gasto;
}

export async function deleteGasto(id) {
  return callJson(`/api/v1/academia/finanzas/gastos/${id}`, { method: "DELETE" });
}

export async function uploadFotoGasto(id, { base64, mime }) {
  const data = await callJson(`/api/v1/academia/finanzas/gastos/${id}/upload-foto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64, mime }),
  });
  return data.url;
}

// ---- Resumen ----

export async function fetchResumenMensual(anio) {
  const data = await callJson(`/api/v1/academia/finanzas/resumen/mensual?anio=${anio}`);
  return data.meses || [];
}

export async function fetchResumenFiscal(anio) {
  const data = await callJson(`/api/v1/academia/finanzas/resumen/fiscal?anio=${anio}`);
  return data.fiscal || {};
}

// ---- Fiscal (Modelo 130/115/111) ----

export async function fetchModelo130({ anio, trimestre }) {
  const data = await callJson(`/api/v1/academia/finanzas/fiscal/130?anio=${anio}&trimestre=${trimestre}`);
  return data.modelo130 || { ingresos: 0, gastos_deducibles: 0 };
}

export async function fetchModelo115({ anio, trimestre }) {
  const data = await callJson(`/api/v1/academia/finanzas/fiscal/115?anio=${anio}&trimestre=${trimestre}`);
  return Number(data.alquiler_base_mensual || 0);
}

export async function fetchModelo111({ anio, trimestre }) {
  const data = await callJson(`/api/v1/academia/finanzas/fiscal/111?anio=${anio}&trimestre=${trimestre}`);
  return { trimestres: data.trimestres || [], nominasConfig: data.nominas_config || {} };
}
