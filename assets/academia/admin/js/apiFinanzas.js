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
  if (!res.ok) {
    const err = new Error(body?.error?.message || "No se pudo completar la operación.");
    err.code = body?.error?.code || null;
    throw err;
  }
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

const MESES_TRIMESTRE = { 1: [1, 2, 3], 2: [4, 5, 6], 3: [7, 8, 9], 4: [10, 11, 12] };

// La lista de gastos solo existe por mes — el anexo "Gastos deducibles
// del trimestre" del PDF del Modelo 130 necesita los 3 meses juntos.
export async function fetchGastosTrimestre({ anio, trimestre }) {
  const listas = await Promise.all(
    MESES_TRIMESTRE[trimestre].map((mes) => fetchListaGastos({ mes, anio }))
  );
  return listas.flat();
}

export async function fetchCategoriasGastos({ mes, anio }) {
  const data = await callJson(`/api/v1/academia/finanzas/gastos/categorias?mes=${mes}&anio=${anio}`);
  return data.categorias || [];
}

// ---- Categorías de gasto (definiciones, no el reparto por mes de arriba) ----

export async function fetchGastoCategorias() {
  const data = await callJson("/api/v1/academia/gastos/categorias");
  return data.categorias || [];
}

export async function createGastoCategoria(nombre) {
  const data = await callJson("/api/v1/academia/gastos/categorias", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre }),
  });
  return data.categoria;
}

export async function deleteGastoCategoria(id) {
  return callJson(`/api/v1/academia/gastos/categorias/${id}`, { method: "DELETE" });
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

// ---- Fiscal (trimestral + anual) ----

// Devuelve { regimen_fiscal, tenant_type, desglose_iva } — usado tanto por
// finanzasSection.js (para ocultar la pestaña si no es academia) como por
// fiscalTab.js (para decidir qué modelos mostrar y si el 303 está activo).
export async function fetchRegimenFiscal() {
  const data = await callJson("/api/v1/academia/finanzas/fiscal/regimen");
  return {
    regimen_fiscal: data.regimen_fiscal || null,
    tenant_type:    data.tenant_type    || null,
    desglose_iva:   Boolean(data.desglose_iva),
  };
}

export async function fetchModeloFiscal(modelo, { anio, trimestre }) {
  const data = await callJson(`/api/v1/academia/finanzas/fiscal/${modelo}?anio=${anio}&trimestre=${trimestre}`);
  return data.datos;
}

// Carga un modelo anual (180 ó 390): datos guardados + los 4 trimestres
// del modelo fuente (115 para 180, 303 para 390).
export async function fetchModeloAnual(modelo, { anio }) {
  const data = await callJson(`/api/v1/academia/finanzas/fiscal/${modelo}?anio=${anio}`);
  return { datos: data.datos || null, trimestres: data.trimestres || [null, null, null, null] };
}

export async function guardarTrimestreFiscal({ modelo, anio, trimestre, datos }) {
  return callJson("/api/v1/academia/finanzas/fiscal/trimestre", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelo, anio, trimestre, datos }),
  });
}
