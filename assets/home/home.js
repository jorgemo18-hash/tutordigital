import {
  apiFetch,
  clearSession,
  getAccessToken,
  getTenantSlug,
  setSessionTokens,
  setActiveTenantSlug,
} from "../shared/js/auth.js";

(function () {
  const $ = (id) => document.getElementById(id);

  const stepLogin = $("stepLogin");
  const stepTenantSelect = $("stepTenantSelect");
  const stepRole = $("stepRole");

  const loginEmail = $("loginEmail");
  const loginPassword = $("loginPassword");
  const loginBtn = $("loginBtn");
  const loginError = $("loginError");

  const tenantSelect = $("tenantSelect");
  const tenantContinue = $("tenantContinue");
  const tenantSelectError = $("tenantSelectError");
  const tenantName2 = $("tenantName2");

  const enterStudent = $("enterStudent");
  const enterTeacher = $("enterTeacher");
  const logoutBtn = $("logoutBtn");

  let memberships = [];

  function show(el, visible) {
    if (!el) return;
    el.classList.toggle("hidden", !visible);
  }

  function setError(el, msg) {
    if (!el) return;
    el.textContent = msg || "";
    el.style.display = msg ? "block" : "none";
  }

  function showStep(step) {
    show(stepLogin, step === "login");
    show(stepTenantSelect, step === "tenant");
    show(stepRole, step === "role");
  }

  function fillTenantSelect(list = []) {
    if (!tenantSelect) return;
    tenantSelect.innerHTML = "";
    list.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.tenant.slug;
      opt.textContent = `${m.tenant.name} (${m.tenant.slug})`;
      tenantSelect.appendChild(opt);
    });
  }

  function setActiveTenantFromMembership(m) {
    if (!m?.tenant?.slug) return;
    setActiveTenantSlug(m.tenant.slug);
    if (tenantName2) tenantName2.textContent = m.tenant.name || m.tenant.slug;
  }

  async function loadMemberships() {
    const token = getAccessToken();
    if (!token) return { ok: false };
    const res = await apiFetch("/api/v1/me");
    if (!res.ok) {
      clearSession();
      return { ok: false };
    }
    const data = await res.json();
    memberships = data?.data?.memberships || [];
    return { ok: true, memberships };
  }

  async function handleExistingSession() {
    const token = getAccessToken();
    if (!token) {
      showStep("login");
      return;
    }
    const result = await loadMemberships();
    if (!result.ok) {
      showStep("login");
      return;
    }
    if (memberships.length === 1) {
      setActiveTenantFromMembership(memberships[0]);
      showStep("role");
      return;
    }
    if (memberships.length > 1) {
      fillTenantSelect(memberships);
      showStep("tenant");
      return;
    }
    showStep("login");
  }

  async function handleLogin() {
    setError(loginError, "");
    const email = String(loginEmail?.value || "").trim();
    const password = String(loginPassword?.value || "").trim();
    if (!email || !password) {
      setError(loginError, "Introduce email y contraseña.");
      return;
    }
    const res = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(loginError, data?.error?.message || "Credenciales inválidas.");
      return;
    }
    const payload = data?.data || {};
    setSessionTokens({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      expires_at: payload.expires_at,
    });
    memberships = payload.memberships || [];
    if (memberships.length === 1) {
      setActiveTenantFromMembership(memberships[0]);
      showStep("role");
      return;
    }
    if (memberships.length > 1) {
      fillTenantSelect(memberships);
      showStep("tenant");
      return;
    }
    showStep("login");
  }

  function handleTenantContinue() {
    setError(tenantSelectError, "");
    const slug = String(tenantSelect?.value || "").trim();
    if (!slug) {
      setError(tenantSelectError, "Selecciona un centro.");
      return;
    }
    const m = memberships.find((x) => x?.tenant?.slug === slug);
    if (m) setActiveTenantFromMembership(m);
    showStep("role");
  }

  async function handleLogout() {
    const token = getAccessToken();
    try {
      if (token) {
        await apiFetch("/api/v1/auth/logout", { method: "POST" });
      }
    } catch {}
    clearSession();
    showStep("login");
  }

  loginBtn?.addEventListener("click", handleLogin);
  loginPassword?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      handleLogin();
    }
  });

  tenantContinue?.addEventListener("click", handleTenantContinue);
  tenantSelect?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      handleTenantContinue();
    }
  });

  enterStudent?.addEventListener("click", () => {
    window.location.href = "/assets/student/index.html";
  });
  enterTeacher?.addEventListener("click", () => {
    window.location.href = "/assets/teacher/index.html";
  });
  logoutBtn?.addEventListener("click", handleLogout);

  handleExistingSession();
})();
