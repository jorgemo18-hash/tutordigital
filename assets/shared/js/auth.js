const ACCESS_KEY = "ttd_access_token";
const REFRESH_KEY = "ttd_refresh_token";
const EXPIRES_KEY = "ttd_expires_at";
const TENANT_KEY = "ttd_activeTenantSlug";
import { getApiBase } from "./config.js";
let memoryAccessToken = "";

export function getAccessToken() {
  if (memoryAccessToken) return memoryAccessToken;
  try { return localStorage.getItem(ACCESS_KEY) || ""; } catch { return ""; }
}

export function getTenantSlug() {
  try { return localStorage.getItem(TENANT_KEY) || ""; } catch { return ""; }
}

export function setSessionTokens({ access_token, refresh_token, expires_at } = {}) {
  try {
    if (access_token) {
      memoryAccessToken = access_token;
      localStorage.setItem(ACCESS_KEY, access_token);
    }
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
    memoryAccessToken = "";
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(EXPIRES_KEY);
    localStorage.removeItem(TENANT_KEY);
  } catch {}
}

export async function logout() {
  const token = getAccessToken();
  try {
    if (token) {
      await apiFetch("/api/v1/auth/logout", { method: "POST" });
    }
  } catch {} finally {
    clearSession();
  }
}

export async function apiFetch(path, options = {}) {
  const url = String(path || "");
  const headers = new Headers(options.headers || {});
  const token = getAccessToken();
  const slug = getTenantSlug();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (slug) headers.set("x-tenant-slug", slug);
  const finalUrl = url.startsWith("http") ? url : `${getApiBase()}${url}`;
  return fetch(finalUrl, { ...options, headers });
}
