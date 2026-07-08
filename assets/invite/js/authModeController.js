// Encapsula el estado de modo login/signup (antes un `let mode` compartido
// por closure entre varias funciones del <script> inline de invite.html).
// setModeSilently existe solo para reproducir un comportamiento exacto del
// original: doAuth() reasignaba `mode` directamente (sin pasar por los
// efectos visuales de setMode) al auto-detectar "email ya registrado" en
// signup — ver authFlows.js.
import { el, showMessage } from "./dom.js";

export function createAuthModeController() {
  let mode = "login";

  function getMode() {
    return mode;
  }

  function setMode(next) {
    mode = next;
    el("btnModeLogin").classList.toggle("active", mode === "login");
    el("btnModeSignup").classList.toggle("active", mode === "signup");
    el("btnAuth").textContent = mode === "login" ? "Iniciar sesión" : "Crear cuenta";
    const pwInput = el("password");
    if (pwInput) pwInput.autocomplete = mode === "login" ? "current-password" : "new-password";
    showMessage("authMsg", "");
  }

  function setModeSilently(next) {
    mode = next;
  }

  return { getMode, setMode, setModeSilently };
}
