import { getApiBase } from "../config.js";

let inFlightRefresh = null;

async function callRefreshEndpoint(refreshToken) {
  try {
    const res = await fetch(`${getApiBase()}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    return body?.data || null;
  } catch {
    return null;
  }
}

// Refresca la sesión ante un 401 — protección de estampida: si N
// peticiones concurrentes reciben 401 a la vez (el caso real de
// producción, varios fetches del panel disparados juntos al montar),
// todas comparten esta MISMA promesa en vez de disparar N llamadas a
// /auth/refresh en paralelo. getRefreshToken/setSessionTokens llegan como
// parámetros explícitos (no se importa auth.js aquí) para evitar un ciclo
// de imports con apiFetch, que es quien llama a esta función.
export function refreshSessionOnce({ getRefreshToken, setSessionTokens }) {
  if (!inFlightRefresh) {
    inFlightRefresh = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return false;
      const session = await callRefreshEndpoint(refreshToken);
      if (!session?.access_token) return false;
      setSessionTokens(session);
      return true;
    })().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}
