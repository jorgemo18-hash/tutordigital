import { refreshSessionOnce } from "./refreshSession.js";
import { expireSession } from "./sessionExpired.js";

// Orquesta la recuperación ante un 401: intenta refrescar la sesión UNA
// vez (compartida entre llamadas concurrentes, ver refreshSessionOnce) y
// reintenta la petición original con el token nuevo. Si el refresh falla
// (sin refresh_token, o el propio /auth/refresh devuelve error), la
// sesión está genuinamente caducada — se limpia y se redirige a /login
// (ver expireSession), y esta función devuelve una promesa que NUNCA
// resuelve: el llamador original (fetchJSON, callJson, etc.) se queda
// "congelado" ahí, así que su código de manejo de error nunca llega a
// pintar "Unauthorized" en pantalla mientras la navegación está en curso.
//
// Si el refresh SÍ funciona pero la petición reintentada, ya con sesión
// válida, sigue devolviendo 401, eso ya no es caducidad de sesión — es un
// 401 real (bug de permisos) y se devuelve tal cual al llamador, que lo
// trata exactamente igual que hoy (y si no lo captura, sí llega a
// Sentry vía unhandledrejection, correctamente).
export async function handleUnauthorized({ getRefreshToken, setSessionTokens, clearSession, retryFn }) {
  const refreshed = await refreshSessionOnce({ getRefreshToken, setSessionTokens });
  if (!refreshed) {
    expireSession({ clearSession });
    return new Promise(() => {});
  }
  return retryFn();
}
