const MESSAGE_KEY = "ttd_session_expired_msg";
const DEFAULT_MESSAGE = "Tu sesión ha caducado, vuelve a iniciar sesión.";

let redirecting = false;

// Sesión confirmada como caducada (sin refresh_token, o el refresh
// falló) — limpia el estado local y redirige a /login con un aviso
// visible, sin dejar la UI a medias con textos "Unauthorized" sueltos.
//
// Protección de estampida: si varias peticiones concurrentes llegan aquí
// a la vez (todas comparten el refreshSessionOnce() ya fallido), solo la
// primera limpia sesión y redirige — el resto no repite el trabajo ni
// encadena una segunda navegación.
export function expireSession({ clearSession }) {
  if (redirecting) return;
  redirecting = true;
  try {
    sessionStorage.setItem(MESSAGE_KEY, DEFAULT_MESSAGE);
  } catch {}
  clearSession();
  window.location.href = "/login";
}

// Leído por la página /login al cargar (ver home.js) — se consume una
// sola vez para no repetir el aviso en visitas normales posteriores.
export function consumeSessionExpiredMessage() {
  try {
    const msg = sessionStorage.getItem(MESSAGE_KEY);
    if (msg) sessionStorage.removeItem(MESSAGE_KEY);
    return msg || "";
  } catch {
    return "";
  }
}
