const ACCESS_KEY = "ttd_access_token";
const REFRESH_KEY = "ttd_refresh_token";
const EXPIRES_KEY = "ttd_expires_at";
const TENANT_KEY = "ttd_activeTenantSlug";
const API_BASE = "https://tutordigital.onrender.com";

export function getAccessToken() {
  try { return localStorage.getItem(ACCESS_KEY) || ""; } catch { return ""; }
}

export function getTenantSlug() {
  try { return localStorage.getItem(TENANT_KEY) || ""; } catch { return ""; }
}

export function setSessionTokens({ access_token, refresh_token, expires_at } = {}) {
  try {
    if (access_token) localStorage.setItem(ACCESS_KEY, access_token);
    if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token);
    if (expires_at != null) localStorage.setItem(EXPIRES_KEY, String(expires_at));
  } catch {}
}

export function setActiveTenantSlug(slug = "") {
  try {
    if (slug) localStorage.setItem(TENANT_KEY, slug);
  } catch {}
}

export function clearSession() {
  try {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(EXPIRES_KEY);
    localStorage.removeItem(TENANT_KEY);
  } catch {}
}

export async function apiFetch(path, options = {}) {
  const url = String(path || "");
  const headers = new Headers(options.headers || {});
  const token = getAccessToken();
  const slug = getTenantSlug();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (slug) headers.set("x-tenant-slug", slug);
  const finalUrl = url.startsWith("http") ? url : `${API_BASE}${url}`;
  return fetch(finalUrl, { ...options, headers });
}
