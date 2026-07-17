const ACCESS_KEY = "ttd_access_token";
const REFRESH_KEY = "ttd_refresh_token";
const EXPIRES_KEY = "ttd_expires_at";
const TENANT_KEY = "ttd_activeTenantSlug";
import { getApiBase } from "./config.js";
import { handleUnauthorized } from "./session/handleUnauthorized.js";
let memoryAccessToken = "";

function isApiDebugEnabled() {
  try {
    if (typeof window !== "undefined" && window.__TTD_DEBUG_API === true) return true;
  } catch {}
  try {
    return localStorage.getItem("ttd_debug_api") === "1";
  } catch {
    return false;
  }
}

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

function buildRequestHeaders(options) {
  const headers = new Headers(options.headers || {});
  const token = getAccessToken();
  const slug = getTenantSlug();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (slug) headers.set("x-ttd-tenant", slug);
  return { headers, hasToken: Boolean(token) };
}

function getStoredRefreshToken() {
  try { return localStorage.getItem(REFRESH_KEY) || ""; } catch { return ""; }
}

export async function apiFetch(path, options = {}) {
  const url = String(path || "");
  const finalUrl = url.startsWith("http") ? url : `${getApiBase()}${url}`;
  const { headers, hasToken } = buildRequestHeaders(options);
  let hasSession = hasToken || Boolean(getStoredRefreshToken());
  const hasIncomingAuthHeader = Boolean(headers.get("Authorization") || headers.get("authorization"));
  const willAttachAuth = hasToken || hasIncomingAuthHeader;
  if (isApiDebugEnabled()) {
    console.debug("[apiFetch]", {
      url: finalUrl,
      method: options?.method || "GET",
      hasSession,
      hasToken,
      willAttachAuth,
      hasAuth: Boolean(headers.get("Authorization")),
    });
  }
  const res = await fetch(finalUrl, { ...options, headers });
  if (isApiDebugEnabled()) {
    console.debug("[apiFetch:res]", {
      url: finalUrl,
      hasSession,
      hasToken,
      hasAuth: Boolean(headers.get("Authorization")),
      status: res.status,
    });
  }

  // Sesión caducada a mitad de uso (el caso real de producción: token de
  // la noche anterior) — solo tiene sentido intentar recuperarla si esta
  // petición llevaba nuestro propio token adjunto; un 401 sin token (p.ej.
  // una comprobación anónima antes de hacer login) es un 401 normal, no
  // una sesión que "haya caducado". Ver session/handleUnauthorized.js
  // para el porqué de la promesa que nunca resuelve tras redirigir.
  if (res.status !== 401 || !hasToken) return res;

  return handleUnauthorized({
    getRefreshToken: getStoredRefreshToken,
    setSessionTokens,
    clearSession,
    retryFn: async () => {
      const { headers: retryHeaders } = buildRequestHeaders(options);
      return fetch(finalUrl, { ...options, headers: retryHeaders });
    },
  });
}
