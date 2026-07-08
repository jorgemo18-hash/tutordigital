// Las dos llamadas de red de autenticación — extraído literal de
// invite.html. Reciben `params` (datos de URL, inmutables) y `ui` (helpers
// de dom.js + el controller de modo) en vez de cerrar sobre variables de
// módulo, como hacía el script inline original.
import { apiFetch, setSessionTokens } from "/assets/shared/js/auth.js";
import { redeemInvite } from "./redeemInvite.js";

export async function doAuth(params, ui) {
  const { el, showMessage, getMode, setModeSilently } = ui;
  showMessage("authMsg", "");
  const email = String(el("email")?.value || "").trim();
  const password = String(el("password")?.value || "");

  if (!email || !password) {
    showMessage("authMsg", "Falta email o contraseña.");
    return;
  }

  if (getMode() === "signup" && !el("confirmRow").classList.contains("hidden")) {
    const confirm = String(el("confirmPassword")?.value || "");
    if (password !== confirm) {
      showMessage("authMsg", "Las contraseñas no coinciden.");
      return;
    }
  }

  const btnAuth = el("btnAuth");
  if (btnAuth) { btnAuth.disabled = true; btnAuth.textContent = "Procesando…"; }

  try {
    const path = (getMode() === "login") ? "/api/v1/auth/login" : "/api/v1/auth/signup";
    const res = await apiFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Si estamos en modo signup y el email ya existe, cambiar automáticamente a login
      if (getMode() === "signup") {
        const errCode = String(body?.error?.code || "").toLowerCase();
        const errMsg  = String(body?.error?.message || "").toLowerCase();
        const isAlreadyRegistered =
          res.status === 409 ||
          errCode.includes("email_exists") ||
          errCode.includes("already_registered") ||
          errMsg.includes("already registered") ||
          errMsg.includes("already in use") ||
          errMsg.includes("ya registrado");
        if (isAlreadyRegistered) {
          // Reasignación silenciosa (sin los efectos visuales de setMode) —
          // reproduce el comportamiento exacto del original.
          setModeSilently("login");
          const pwInput = el("password");
          if (pwInput) { pwInput.autocomplete = "current-password"; pwInput.placeholder = "••••••••"; }
          el("confirmRow")?.classList.add("hidden");
          if (btnAuth) { btnAuth.disabled = false; btnAuth.textContent = "Iniciar sesión"; }
          showMessage("authMsg", "Ya tienes cuenta con este email. Introduce tu contraseña para continuar.", true);
          el("password")?.focus();
          return;
        }
      }
      throw new Error(body?.error?.message || "Error en la autenticación.");
    }
    const data = body?.data || body || {};

    if (data?.needs_email_confirm) {
      showMessage("authMsg", "Cuenta creada. Revisa tu email para confirmar.", true);
      if (btnAuth) { btnAuth.disabled = false; btnAuth.textContent = (getMode() === "login") ? "Iniciar sesión" : "Crear cuenta"; }
      return;
    }

    if (data?.access_token) {
      setSessionTokens({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
      });
    }

    await redeemInvite(params, ui);
  } catch (e) {
    showMessage("authMsg", e?.message || "Error en autenticación.");
    if (btnAuth) { btnAuth.disabled = false; btnAuth.textContent = (getMode() === "login") ? "Iniciar sesión" : "Crear cuenta"; }
  }
}

export async function doSetPassword(params, ui) {
  const { el, showMessage } = ui;
  showMessage("authMsg", "");
  const password = String(el("password")?.value || "");
  const confirm = String(el("confirmPassword")?.value || "");

  if (!password || password.length < 6) {
    showMessage("authMsg", "La contraseña debe tener al menos 6 caracteres.");
    return;
  }
  if (password !== confirm) {
    showMessage("authMsg", "Las contraseñas no coinciden.");
    return;
  }

  const btnAuth = el("btnAuth");
  if (btnAuth) { btnAuth.disabled = true; btnAuth.textContent = "Activando…"; }

  try {
    const res = await apiFetch("/api/v1/auth/set-invite-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error?.message || "No se pudo establecer la contraseña.");
    }
    await redeemInvite(params, ui);
  } catch (e) {
    showMessage("authMsg", e?.message || "Error al activar la cuenta.");
    if (btnAuth) { btnAuth.disabled = false; btnAuth.textContent = "Activar cuenta"; }
  }
}
