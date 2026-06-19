// mobileSuperData.js — API calls for the mobile superadmin panel. Thin
// wrapper around the shared apiFetch (auth headers, tenant header) that
// unwraps the {data,error} envelope so callers get plain objects/throws.

import { apiFetch } from "../../shared/js/auth.js";

export async function sFetchJSON(path, options) {
  const res  = await apiFetch(path, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || "Error de red");
  return body?.data ?? body;
}

export function fetchTenants() {
  return sFetchJSON("/api/v1/superadmin/tenants");
}

// students/teachers son recuentos reales; no hay endpoint de listado
// (GET .../students y .../teachers no existen en el backend).
export function fetchTenantStats(slug) {
  return sFetchJSON(`/api/v1/superadmin/tenants/${encodeURIComponent(slug)}/stats`);
}

export function fetchTenantAdmin(slug) {
  return sFetchJSON(`/api/v1/superadmin/tenants/${encodeURIComponent(slug)}/admin`);
}

export function patchTenant(slug, data) {
  return sFetchJSON(`/api/v1/superadmin/tenants/${encodeURIComponent(slug)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function deleteTenant(slug) {
  return sFetchJSON(`/api/v1/superadmin/tenants/${encodeURIComponent(slug)}`, { method: "DELETE" });
}

export function createTenant(payload) {
  return sFetchJSON("/api/v1/superadmin/tenants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function impersonateTenant(slug) {
  return sFetchJSON(`/api/v1/superadmin/tenants/${encodeURIComponent(slug)}/impersonate`, { method: "POST" });
}

// TODO: conectar endpoint real — GET /api/v1/superadmin/stats no existe en
// el backend (la vista de escritorio ya lo llama así pero siempre recibe
// 404; ver assets/superadmin/views/estadisticas.js). Hasta que se implemente,
// devolvemos ceros para que la tab Stats muestre el estado vacío honesto.
export async function fetchGlobalStats(/* period, tenantId */) {
  return {
    tokens_total: 0, tokens_input: 0, tokens_output: 0,
    sessions: 0, unique_students: 0, escalaciones: 0,
    modes: {}, sessions_by_day: [],
  };
}
