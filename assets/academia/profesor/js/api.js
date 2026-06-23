import { apiFetch, getTenantSlug } from "../../../shared/js/auth.js";

async function parseJson(res) {
  return res.json().catch(() => ({}));
}

export async function fetchMe() {
  const res = await apiFetch("/api/v1/me");
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

export async function fetchHorario() {
  const res = await apiFetch("/api/v1/academia/horario");
  const body = await parseJson(res);
  if (!res.ok) throw new Error(body?.error?.message || "No se pudo cargar el horario.");
  return body?.data?.franjas || [];
}

export async function fetchConfig() {
  const res = await apiFetch("/api/v1/academia/config");
  const body = await parseJson(res);
  if (!res.ok) throw new Error(body?.error?.message || "No se pudo cargar la configuración.");
  return body?.data?.config || null;
}

export async function fetchDiario(fecha) {
  const res = await apiFetch(`/api/v1/academia/sesiones?fecha=${encodeURIComponent(fecha)}`);
  const body = await parseJson(res);
  if (!res.ok) throw new Error(body?.error?.message || "No se pudo cargar el diario.");
  return body?.data || { fecha, alumnos: [] };
}

export async function saveSesion(sesion) {
  const res = await apiFetch("/api/v1/academia/sesiones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sesion),
  });
  const body = await parseJson(res);
  if (!res.ok) throw new Error(body?.error?.message || "No se pudo guardar la sesión.");
  return body?.data?.sesion;
}
