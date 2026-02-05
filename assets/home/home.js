import {
  apiFetch,
  clearSession,
  getAccessToken,
  getTenantSlug,
  logout,
  setSessionTokens,
  setActiveTenantSlug,
} from "../shared/js/auth.js";

(function () {
  const $ = (id) => document.getElementById(id);

  const stepLogin = $("stepLogin");
  const stepSignup = $("stepSignup");
  const stepTenantSelect = $("stepTenantSelect");
  const stepJoinTenant = $("stepJoinTenant");
  const stepTeacherJoin = $("stepTeacherJoin");
  const stepRole = $("stepRole");

  const loginEmail = $("loginEmail");
  const loginPassword = $("loginPassword");
  const loginBtn = $("loginBtn");
  const signupToggle = $("signupToggle");
  const loginError = $("loginError");

  const signupEmail = $("signupEmail");
  const signupPassword = $("signupPassword");
  const signupBtn = $("signupBtn");
  const signupBack = $("signupBack");
  const signupError = $("signupError");

  const tenantSelect = $("tenantSelect");
  const tenantContinue = $("tenantContinue");
  const tenantSelectError = $("tenantSelectError");
  const tenantName2 = $("tenantName2");

  const tenantJoinCode = $("tenantJoinCode");
  const tenantJoinBtn = $("tenantJoinBtn");
  const tenantJoinError = $("tenantJoinError");
  const tenantJoinLogout = $("tenantJoinLogout");
  const teacherJoinToggle = $("teacherJoinToggle");

  const teacherJoinCode = $("teacherJoinCode");
  const teacherJoinBtn = $("teacherJoinBtn");
  const teacherJoinBack = $("teacherJoinBack");
  const teacherJoinError = $("teacherJoinError");

  const enterStudent = $("enterStudent");
  const enterTeacher = $("enterTeacher");
  const logoutBtn = $("logoutBtn");

  let memberships = [];
  let teacherRequests = [];

  function show(el, visible) {
    if (!el) return;
    el.classList.toggle("hidden", !visible);
  }

  function setError(el, msg, requestId = "") {
    if (!el) return;
    el.textContent = "";
    if (msg) {
      el.append(document.createTextNode(msg));
      if (requestId) {
        const span = document.createElement("span");
        span.className = "errorRef";
        span.textContent = ` (ref: ${requestId})`;
        el.appendChild(span);
      }
    }
    el.style.display = msg ? "block" : "none";
  }

  function extractRequestId(data) {
    return data?.requestId || data?.request_id || "";
  }

  function showStep(step) {
    show(stepLogin, step === "login");
    show(stepSignup, step === "signup");
    show(stepTenantSelect, step === "tenant");
    show(stepJoinTenant, step === "join");
    show(stepTeacherJoin, step === "teacherJoin");
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

  function routeFromMembership(m) {
    if (!m) {
      showStep("login");
      return;
    }
    setActiveTenantFromMembership(m);
    const role = m.role;
    if (role === "admin") {
      showStep("role");
      return;
    }
    if (role === "teacher") {
      window.location.href = "/assets/teacher/index.html";
      return;
    }
    if (role === "student") {
      window.location.href = "/assets/student/index.html";
      return;
    }
    showStep("login");
  }

  function applyTeacherJoinStatus(status) {
    if (!teacherJoinError || !teacherJoinBtn || !teacherJoinCode) return;
    if (status === "pending") {
      setError(teacherJoinError, "Solicitud pendiente de aprobación.");
      teacherJoinBtn.disabled = true;
      teacherJoinCode.disabled = true;
      return;
    }
    if (status === "rejected") {
      setError(teacherJoinError, "Solicitud rechazada. Puedes volver a intentarlo.");
      teacherJoinBtn.disabled = false;
      teacherJoinCode.disabled = false;
      return;
    }
    setError(teacherJoinError, "");
    teacherJoinBtn.disabled = false;
    teacherJoinCode.disabled = false;
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
    teacherRequests = data?.data?.teacher_requests || [];
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
    if (memberships.length === 0) {
      const latestRequest = teacherRequests[0];
      if (latestRequest?.status) {
        applyTeacherJoinStatus(latestRequest.status);
        showStep("teacherJoin");
        return;
      }
      showStep("join");
      return;
    }
    if (memberships.length === 0) {
      showStep("join");
      return;
    }
    if (memberships.length > 1) {
      fillTenantSelect(memberships);
      showStep("tenant");
      return;
    }
    if (memberships.length === 1) {
      routeFromMembership(memberships[0]);
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
    const payload = { email, password };
    const res = await apiFetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const rid = extractRequestId(data);
      if (res.status === 400) {
        setError(loginError, "Email o contraseña con formato inválido.", rid);
        return;
      }
      if (res.status === 401) {
        setError(loginError, "Email o contraseña incorrectos.", rid);
        return;
      }
      setError(loginError, "Error del servidor. Inténtalo de nuevo.", rid);
      return;
    }
    const payload = data?.data || {};
    setSessionTokens({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      expires_at: payload.expires_at,
    });
    memberships = payload.memberships || [];
    if (memberships.length === 0) {
      await loadMemberships();
      if (teacherRequests.length > 0) {
        applyTeacherJoinStatus(teacherRequests[0]?.status);
        showStep("teacherJoin");
      } else {
        showStep("join");
      }
      return;
    }
    if (memberships.length === 1) {
      routeFromMembership(memberships[0]);
      return;
    }
    if (memberships.length > 1) {
      fillTenantSelect(memberships);
      showStep("tenant");
      return;
    }
    showStep("login");
  }

  async function handleSignup() {
    setError(signupError, "");
    const email = String(signupEmail?.value || "").trim();
    const password = String(signupPassword?.value || "").trim();
    if (!email || !password) {
      setError(signupError, "Introduce email y contraseña.");
      return;
    }
    const res = await apiFetch("/api/v1/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(signupError, data?.error?.message || "No se pudo crear la cuenta.");
      return;
    }
    const payload = data?.data || {};
    if (payload.needs_email_confirm) {
      setError(signupError, "Revisa tu email para confirmar la cuenta.");
      return;
    }
    setSessionTokens({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      expires_at: payload.expires_at,
    });
    memberships = payload.memberships || [];
    if (memberships.length === 0) {
      await loadMemberships();
      if (teacherRequests.length > 0) {
        applyTeacherJoinStatus(teacherRequests[0]?.status);
        showStep("teacherJoin");
      } else {
        showStep("join");
      }
      return;
    }
    if (memberships.length === 1) {
      routeFromMembership(memberships[0]);
      return;
    }
    fillTenantSelect(memberships);
    showStep("tenant");
  }

  function handleTenantContinue() {
    setError(tenantSelectError, "");
    const slug = String(tenantSelect?.value || "").trim();
    if (!slug) {
      setError(tenantSelectError, "Selecciona un centro.");
      return;
    }
    const m = memberships.find((x) => x?.tenant?.slug === slug);
    if (m) routeFromMembership(m);
  }

  async function handleTenantJoin() {
    setError(tenantJoinError, "");
    const joinCode = String(tenantJoinCode?.value || "").trim();
    if (!joinCode) {
      setError(tenantJoinError, "Introduce el código de centro.");
      return;
    }
    const res = await apiFetch("/api/v1/tenant/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ join_code: joinCode }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(tenantJoinError, data?.error?.message || "Código incorrecto.");
      return;
    }
    const tenant = data?.data?.tenant;
    if (tenant?.slug) {
      setActiveTenantSlug(tenant.slug);
      if (tenantName2) tenantName2.textContent = tenant.name || tenant.slug;
    }
    const role = data?.data?.role || "student";
    if (role === "student") {
      window.location.href = "/assets/student/index.html";
      return;
    }
    showStep("role");
  }

  async function handleTeacherJoin() {
    setError(teacherJoinError, "");
    const code = String(teacherJoinCode?.value || "").trim();
    if (!code) {
      setError(teacherJoinError, "Introduce el código docente.");
      return;
    }
    const res = await apiFetch("/api/v1/teacher/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacher_join_code: code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(teacherJoinError, data?.error?.message || "No se pudo solicitar el alta.");
      return;
    }
    const status = data?.data?.status || "pending";
    applyTeacherJoinStatus(status);
  }

  async function handleLogout() {
    await logout();
    memberships = [];
    teacherRequests = [];
    showStep("login");
  }

  loginBtn?.addEventListener("click", handleLogin);
  loginEmail?.addEventListener("input", () => setError(loginError, ""));
  loginPassword?.addEventListener("input", () => setError(loginError, ""));
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
  signupToggle?.addEventListener("click", () => showStep("signup"));
  signupBack?.addEventListener("click", () => showStep("login"));
  signupBtn?.addEventListener("click", handleSignup);
  tenantJoinBtn?.addEventListener("click", handleTenantJoin);
  tenantJoinLogout?.addEventListener("click", handleLogout);
  teacherJoinToggle?.addEventListener("click", () => showStep("teacherJoin"));
  teacherJoinBack?.addEventListener("click", () => showStep("join"));
  teacherJoinBtn?.addEventListener("click", handleTeacherJoin);

  handleExistingSession();
})();
