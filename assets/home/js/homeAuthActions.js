import { apiFetch, setSessionTokens, logout } from "../../shared/js/auth.js";
import { setError, extractRequestId, showStep } from "./homeUi.js";
import { setMemberships } from "./homeMembershipsState.js";
import { proceedAfterAuth } from "./homeAuthFlow.js";

export async function handleLogin(dom) {
  setError(dom.loginError, "");
  const email = String(dom.loginEmail?.value || "").trim();
  const password = String(dom.loginPassword?.value || "").trim();
  if (!email || !password) {
    setError(dom.loginError, "Introduce email y contraseña.");
    return;
  }
  try {
    const res = await apiFetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const rid = extractRequestId(data);
      if (res.status === 400) {
        setError(dom.loginError, "Email o contraseña con formato inválido.", rid);
        return;
      }
      if (res.status === 401) {
        setError(dom.loginError, "Email o contraseña incorrectos.", rid);
        return;
      }
      setError(dom.loginError, "Error del servidor. Inténtalo de nuevo.", rid);
      return;
    }
    const loginData = data?.data || {};
    setSessionTokens({
      access_token: loginData.access_token,
      refresh_token: loginData.refresh_token,
      expires_at: loginData.expires_at,
    });
    setMemberships(Array.isArray(loginData.memberships) ? loginData.memberships : []);
    await proceedAfterAuth(dom);
  } catch {
    setError(dom.loginError, "No se pudo conectar. Verifica tu conexión e inténtalo de nuevo.");
  }
}

export async function handleSignup(dom) {
  setError(dom.signupError, "");
  const email = String(dom.signupEmail?.value || "").trim();
  const password = String(dom.signupPassword?.value || "").trim();
  if (!email || !password) {
    setError(dom.signupError, "Introduce email y contraseña.");
    return;
  }
  const res = await apiFetch("/api/v1/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    setError(dom.signupError, data?.error?.message || "No se pudo crear la cuenta.");
    return;
  }
  const payload = data?.data || {};
  if (payload.needs_email_confirm) {
    setError(dom.signupError, "Revisa tu email para confirmar la cuenta.");
    return;
  }
  setSessionTokens({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at: payload.expires_at,
  });
  setMemberships(Array.isArray(payload.memberships) ? payload.memberships : []);
  await proceedAfterAuth(dom);
}

export async function handleReset(dom) {
  setError(dom.resetError, "");
  const email = String(dom.resetEmail?.value || "").trim();
  if (!email) {
    setError(dom.resetError, "Introduce tu email.");
    return;
  }
  const resetBtn = dom.resetBtn;
  resetBtn.disabled = true;
  resetBtn.textContent = "Enviando…";
  try {
    await apiFetch("/api/v1/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  } catch {}
  // Siempre mostramos éxito — no revelamos si el email existe
  resetBtn.disabled = false;
  resetBtn.textContent = "Enviar enlace";
  setError(dom.resetError, "");
  const hint = dom.stepReset?.querySelector(".hint");
  if (hint) hint.textContent = "Si ese email está registrado, recibirás el enlace en breve.";
  if (dom.resetEmail) dom.resetEmail.value = "";
}

export async function handleLogout(dom) {
  await logout();
  setMemberships([]);
  showStep(dom, "login");
}
