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

export function fetchTenantStats(slug) {
  return sFetchJSON(`/api/v1/superadmin/tenants/${encodeURIComponent(slug)}/stats`);
}

export function fetchTenantStudents(slug) {
  return sFetchJSON(`/api/v1/superadmin/tenants/${encodeURIComponent(slug)}/students`);
}

export function fetchTenantTeachers(slug) {
  return sFetchJSON(`/api/v1/superadmin/tenants/${encodeURIComponent(slug)}/teachers`);
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

// GET /api/v1/superadmin/stats — métricas globales (centros/alumnos/docentes
// activos, sesiones y escalaciones del mes, coste IA real derivado de
// ai_token_usage — null si el periodo no tiene tracking todavía, nunca 0
// disfrazado de consumo real). No incluye desglose por función/modo ni
// serie diaria — esa granularidad no existe todavía en el backend, así que
// la tab Stats muestra esas secciones vacías.
export function fetchGlobalStats() {
  return sFetchJSON("/api/v1/superadmin/stats");
}
