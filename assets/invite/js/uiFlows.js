// Selección y cableado del flujo de UI correcto — extraído literal de las
// 4 ramas mutuamente excluyentes que vivían en init() en invite.html
// (student magic-link, teacher magic-link, enlace manual, genérico), más
// el badge de centro y la adaptación de título por rol.
import { getAccessToken } from "/assets/shared/js/auth.js";
import { doAuth, doSetPassword } from "./authFlows.js";
import { redeemInvite } from "./redeemInvite.js";

export function showTenantBadge(params, ui) {
  const { el } = ui;
  if (!params.tenant) return;
  const badge = el("tenantBadge");
  const label = el("tenantLabel");
  if (badge && label) {
    label.textContent = `Centro: ${params.tenant}`;
    badge.classList.remove("hidden");
  }
}

function adaptTitleForRole(params, ui) {
  const { el } = ui;
  if (params.role === "student") {
    el("title").textContent = "Unirte a tu clase";
    el("subtitle").textContent = "Tu profesor te ha invitado a TutorDigital.";
  }
}

function setupStudentMagicLinkFlow(params, ui) {
  const { el } = ui;
  el("modeRow").classList.add("hidden");
  const emailInput = el("email");
  if (params.prefillEmail) emailInput.value = params.prefillEmail;
  emailInput.readOnly = true;
  emailInput.style.opacity = "0.6";
  emailInput.style.cursor = "not-allowed";

  if (params.existing) {
    el("passwordLabel").closest("label")?.classList.add("hidden");
    el("password").closest("label")?.classList.add("hidden");
    document.querySelector('label[for="password"]')?.classList.add("hidden");
    el("password").style.display = "none";
    el("passwordLabel").style.display = "none";
    el("btnAuth").textContent = "Unirme a la clase";
    el("btnAuth").addEventListener("click", () => redeemInvite(params, ui));
  } else {
    el("passwordLabel").textContent = "Crea una contraseña";
    el("password").autocomplete = "new-password";
    el("password").placeholder = "Mínimo 6 caracteres";
    el("confirmRow").classList.remove("hidden");
    el("btnAuth").textContent = "Crear cuenta y unirme";
    el("btnAuth").addEventListener("click", () => doSetPassword(params, ui));
    el("password").addEventListener("keydown", (e) => {
      if (e.key === "Enter") el("confirmPassword").focus();
    });
    el("confirmPassword").addEventListener("keydown", (e) => {
      if (e.key === "Enter") doSetPassword(params, ui);
    });
  }
}

function setupTeacherMagicLinkFlow(params, ui) {
  const { el } = ui;
  el("modeRow").classList.add("hidden");
  const emailInput = el("email");
  if (params.prefillEmail) emailInput.value = params.prefillEmail;
  emailInput.readOnly = true;
  emailInput.style.opacity = "0.6";
  emailInput.style.cursor = "not-allowed";

  el("passwordLabel").textContent = "Nueva contraseña";
  el("password").autocomplete = "new-password";
  el("password").placeholder = "Mínimo 6 caracteres";
  el("confirmRow").classList.remove("hidden");
  el("btnAuth").textContent = "Activar cuenta";

  el("btnAuth").addEventListener("click", () => doSetPassword(params, ui));
  el("password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") el("confirmPassword").focus();
  });
  el("confirmPassword").addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSetPassword(params, ui);
  });
}

function setupManualTokenFlow(params, ui) {
  const { el, setMode } = ui;
  el("modeRow").classList.add("hidden");
  const emailInput = el("email");
  emailInput.readOnly = true;
  emailInput.style.opacity = "0.6";
  emailInput.style.cursor = "not-allowed";

  el("password").placeholder = "Mínimo 6 caracteres";
  el("password").autocomplete = "new-password";
  el("confirmRow").classList.remove("hidden");

  setMode("signup");
  el("btnAuth").textContent = params.role === "student" ? "Crear cuenta y unirme" : "Activar cuenta";

  el("btnAuth").addEventListener("click", () => doAuth(params, ui));
  el("password").addEventListener("keydown", (e) => { if (e.key === "Enter") el("confirmPassword").focus(); });
  el("confirmPassword").addEventListener("keydown", (e) => { if (e.key === "Enter") doAuth(params, ui); });
}

async function setupGenericFlow(params, ui) {
  const { el, setMode } = ui;
  el("btnModeLogin").addEventListener("click", () => setMode("login"));
  el("btnModeSignup").addEventListener("click", () => setMode("signup"));
  el("btnAuth").addEventListener("click", () => doAuth(params, ui));

  // Enter key submits
  el("password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") doAuth(params, ui);
  });

  setMode("login");

  // Auto-redeem solo en flujo genérico (sin parámetros de invitación).
  // Si hay token TutorDigital en la URL el redeem lo hace doSetPassword/doAuth.
  if (getAccessToken() && !params.token) {
    await redeemInvite(params, ui);
  }
}

export async function activateInviteFlow(params, ui, consumed) {
  adaptTitleForRole(params, ui);

  // ── Student magic-link: sesión consumida + token presente ──────────────
  if (consumed && params.token && params.role === "student") {
    setupStudentMagicLinkFlow(params, ui);
    return;
  }

  // ── Teacher magic-link: sesión consumida + token presente ──────────────
  if (consumed && params.token && params.role !== "student") {
    setupTeacherMagicLinkFlow(params, ui);
    return;
  }

  // Flujo de enlace manual: token + email en URL pero sin sesión de Supabase
  if (params.token && params.prefillEmail && !consumed) {
    setupManualTokenFlow(params, ui);
    return;
  }

  await setupGenericFlow(params, ui);
}
