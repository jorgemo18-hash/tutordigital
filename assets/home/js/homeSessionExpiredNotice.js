import { consumeSessionExpiredMessage } from "../../shared/js/session/sessionExpired.js";
import { setError } from "./homeUi.js";

// Pinta el aviso "Tu sesión ha caducado..." dejado por expireSession()
// (ver assets/shared/js/session/sessionExpired.js) antes de redirigir
// aquí — se consume una sola vez para no repetirlo en visitas normales
// posteriores a /login.
export function showSessionExpiredNoticeIfAny(dom) {
  const msg = consumeSessionExpiredMessage();
  if (msg) setError(dom.loginError, msg);
}
