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
  const portalCard = document.getElementById("portalCard");

  const stepLogin = $("stepLogin");
  const stepSignup = $("stepSignup");
  const stepTenantSelect = $("stepTenantSelect");
  const stepJoinTenant = $("stepJoinTenant");
  const stepRole = $("stepRole");
  const stepPendingApproval = $("stepPendingApproval");

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
  const studentCourseSelect = $("studentCourseSelect");
  const tenantJoinBtn = $("tenantJoinBtn");
  const tenantJoinError = $("tenantJoinError");
  const tenantJoinLogout = $("tenantJoinLogout");

  const enterStudent = $("enterStudent");
  const enterTeacher = $("enterTeacher");
  const logoutBtn = $("logoutBtn");
  const pendingApprovalText = $("pendingApprovalText");
  const pendingApprovalReload = $("pendingApprovalReload");
  const pendingApprovalLogout = $("pendingApprovalLogout");

  let memberships = [];

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
    show(stepRole, step === "role");
    show(stepPendingApproval, step === "pending");
    if (portalCard) {
      if (step === "join") portalCard.classList.add("isJoinStep");
      else portalCard.classList.remove("isJoinStep");
    }
  }

  function populateStudentCourseSelect() {
    if (!studentCourseSelect) return;
    if (studentCourseSelect.options && studentCourseSelect.options.length > 0) return;
    studentCourseSelect.innerHTML = `
      <option value="">Selecciona…</option>
      <optgroup label="Primaria">
        <option value="1P">1º Primaria</option><option value="2P">2º Primaria</option><option value="3P">3º Primaria</option>
        <option value="4P">4º Primaria</option><option value="5P">5º Primaria</option><option value="6P">6º Primaria</option>
      </optgroup>
      <optgroup label="ESO">
        <option value="1E">1º ESO</option><option value="2E">2º ESO</option><option value="3E">3º ESO</option><option value="4E">4º ESO</option>
      </optgroup>
      <optgroup label="Bachillerato">
        <option value="1B">1º Bachillerato</option><option value="2B">2º Bachillerato</option>
      </optgroup>
    `;
  }

  function normalizeRole(m) {
    const raw =
      m?.role ||
      m?.member_role ||
      m?.membership_role ||
      (Array.isArray(m?.roles) ? m.roles[0] : "") ||
      (Array.isArray(m?.member_roles) ? m.member_roles[0] : "");
    return String(raw || "").trim().toLowerCase();
  }

  function normalizeStatus(value) {
    return String(value || "").trim().toLowerCase();
  }

  function tenantSlugOf(m) {
    return String(
      m?.tenant_slug ||
      m?.tenant?.slug ||
      m?.tenantSlug ||
      m?.tenant?.tenant_slug ||
      ""
    ).trim();
  }

  function tenantNameOf(m) {
    return String(m?.tenant?.name || m?.tenant_name || tenantSlugOf(m) || "").trim();
  }

  function isActiveMembership(m) {
    const status = normalizeStatus(m?.status || m?.membership_status || "");
    return !status || status === "active";
  }

  function membershipsForTenant(slug, source = memberships) {
    return (source || []).filter((m) => tenantSlugOf(m) === slug);
  }

  function isStudentPendingMembership(m) {
    return normalizeRole(m) === "student" && !isActiveMembership(m);
  }

  function showStudentPendingStep(membership) {
    const name = membership?.tenant?.name || membership?.tenant?.slug || "este centro";
    if (pendingApprovalText) {
      pendingApprovalText.textContent = `Tu acceso como alumno en ${name} está pendiente de aprobación por el docente/admin.`;
    }
    showStep("pending");
  }

  function fillTenantSelect(list = []) {
    if (!tenantSelect) return;
    tenantSelect.innerHTML = "";
    const seen = new Set();
    list.forEach((m) => {
      const slug = tenantSlugOf(m);
      if (!slug || seen.has(slug)) return;
      seen.add(slug);
      const opt = document.createElement("option");
      opt.value = slug;
      const name = tenantNameOf(m) || slug;
      opt.textContent = `${name} (${slug})`;
      tenantSelect.appendChild(opt);
    });
  }

  function setActiveTenantFromMembership(m) {
    const slug = tenantSlugOf(m);
    if (!slug) return;
    setActiveTenantSlug(slug);
    if (tenantName2) tenantName2.textContent = tenantNameOf(m) || slug;
  }

  function routeForTenant(tenantSlug, source = memberships) {
    const scoped = membershipsForTenant(tenantSlug, source);
    const active = scoped.filter(isActiveMembership);
    const roles = active.map((m) => normalizeRole(m)).filter(Boolean);

    const hasAdmin = roles.includes("admin");
    const hasTeacher = roles.includes("teacher");
    const hasStudent = roles.includes("student");

    if (hasAdmin) {
      const any = active[0] || scoped[0] || null;
      if (any) setActiveTenantFromMembership(any);
      try { localStorage.setItem("ttd_activeRole", "admin"); } catch {}
      window.location.href = "/assets/admin/";
      return;
    }

    if (hasTeacher) {
      try {
        if (tenantSlug) localStorage.setItem("ttd_activeTenantSlug", tenantSlug);
        localStorage.setItem("ttd_activeRole", "teacher");
      } catch {}
      window.location.href = "/assets/teacher/index.html";
      return;
    }

    if (hasStudent) {
      try {
        if (tenantSlug) localStorage.setItem("ttd_activeTenantSlug", tenantSlug);
        localStorage.setItem("ttd_activeRole", "student");
      } catch {}
      window.location.href = "/assets/student/index.html";
      return;
    }

    const pendingStudent = scoped.find(isStudentPendingMembership);
    if (pendingStudent) {
      try {
        if (tenantSlug) localStorage.setItem("ttd_activeTenantSlug", tenantSlug);
        localStorage.setItem("ttd_activeRole", "student");
      } catch {}
      showStudentPendingStep(pendingStudent);
      return;
    }

    showStep("join");
  }

  function getSelectedTenantSlug() {
    const fromSelect = String(tenantSelect?.value || "").trim();
    if (fromSelect) return fromSelect;
    const fromStored = String(getTenantSlug() || "").trim();
    if (fromStored) return fromStored;
    const fromMembership = String(memberships?.[0]?.tenant?.slug || "").trim();
    if (fromMembership) return fromMembership;
    return "";
  }

  function getMembershipForSelectedTenant() {
    const slug = getSelectedTenantSlug();
    if (!slug) return null;
    return memberships.find((m) => tenantSlugOf(m) === slug) || null;
  }

  async function isTeacherOrAdmin() {
    try {
      const tenant = getTenantSlug();
      if (!tenant) return { ok: false, reason: "no_tenant" };
      const res = await apiFetch("/api/v1/teacher/me", { method: "GET" });
      if (res.ok) return { ok: true };
      return { ok: false, status: res.status };
    } catch {
      return { ok: false, reason: "exception" };
    }
  }

  function redirectToTeacher() {
    window.location.href = "/assets/teacher/";
  }

  function hideCourseUI() {
    const courseRow =
      document.querySelector("[data-ttd-course-row]") ||
      document.querySelector("#courseRow") ||
      document.querySelector(".course-row") ||
      studentCourseSelect?.closest(".field") ||
      null;
    if (courseRow) courseRow.style.display = "none";

    if (studentCourseSelect) {
      studentCourseSelect.required = false;
      studentCourseSelect.disabled = true;
    }

    const courseHint =
      document.querySelector("[data-ttd-course-hint]") ||
      document.querySelector("#courseHint") ||
      null;
    if (courseHint) courseHint.style.display = "none";
  }

  async function initAccessPageTeacherBypass() {
    const token = getAccessToken();
    if (!token) return;
    const tenant = getTenantSlug();
    if (!tenant) return;
    const teacher = await isTeacherOrAdmin();
    if (!teacher.ok) return;
    hideCourseUI();
    redirectToTeacher();
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
    memberships = Array.isArray(data?.data?.memberships) ? data.data.memberships : [];
    return { ok: true, memberships };
  }

  async function proceedAfterAuth() {
    await initAccessPageTeacherBypass();
    let result = await loadMemberships();
    if (!result.ok) {
      showStep("login");
      return;
    }

    // Retry once if no memberships found, to allow auto-redeem to finish
    if (memberships.length === 0) {
      await new Promise((r) => setTimeout(r, 800));
      result = await loadMemberships();
      if (memberships.length === 0) {
        // Still no memberships? Then it's a new user (student flow)
        showStep("join");
        return;
      }
    }

    const active = memberships.filter(isActiveMembership);
    const activeTenantSlugs = Array.from(new Set(active.map(tenantSlugOf).filter(Boolean)));
    if (activeTenantSlugs.length > 1) {
      fillTenantSelect(active);
      showStep("tenant");
      return;
    }

    if (activeTenantSlugs.length === 1) {
      routeForTenant(activeTenantSlugs[0], memberships);
      return;
    }

    const pendingStudent = memberships.find(isStudentPendingMembership);
    if (pendingStudent) {
      const slug = tenantSlugOf(pendingStudent);
      if (slug) setActiveTenantSlug(slug);
      showStudentPendingStep(pendingStudent);
      return;
    }

    showStep("join");
  }

  async function handleExistingSession() {
    // Detectar sesión desde hash o query de URL (Supabase magic link / confirmación)
    const hashRaw = String(window.location.hash || "");
    const searchRaw = String(window.location.search || "");
    const fromHash = hashRaw.startsWith("#") ? hashRaw.slice(1) : hashRaw;
    const hashParams = new URLSearchParams(fromHash);
    const queryParams = new URLSearchParams(searchRaw);

    const accessToken = hashParams.get("access_token") || queryParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token") || queryParams.get("refresh_token");
    const expiresAtRaw = hashParams.get("expires_at") || queryParams.get("expires_at");
    const expiresInRaw = hashParams.get("expires_in") || queryParams.get("expires_in");
    if (accessToken) {
      const expiresAt = Number(expiresAtRaw || 0) || null;
      const expiresIn = Number(expiresInRaw || 0) || null;
      setSessionTokens({
        access_token: accessToken,
        refresh_token: refreshToken || undefined,
        expires_at: expiresAt || (expiresIn ? Math.floor(Date.now() / 1000) + expiresIn : undefined),
      });
      window.history.replaceState(null, "", window.location.pathname);
    }

    await initAccessPageTeacherBypass();
    const token = getAccessToken();
    if (!token) {
      showStep("login");
      return;
    }
    await proceedAfterAuth();
  }

  async function handleLogin() {
    setError(loginError, "");
    const email = String(loginEmail?.value || "").trim();
    const password = String(loginPassword?.value || "").trim();
    if (!email || !password) {
      setError(loginError, "Introduce email y contraseña.");
      return;
    }
    const loginPayload = { email, password };
    const res = await apiFetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginPayload),
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
    const loginData = data?.data || {};
    setSessionTokens({
      access_token: loginData.access_token,
      refresh_token: loginData.refresh_token,
      expires_at: loginData.expires_at,
    });
    memberships = Array.isArray(loginData.memberships) ? loginData.memberships : [];
    await proceedAfterAuth();
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
    memberships = Array.isArray(payload.memberships) ? payload.memberships : [];
    await proceedAfterAuth();
  }

  function handleTenantContinue() {
    setError(tenantSelectError, "");
    const slug = String(tenantSelect?.value || "").trim();
    if (!slug) {
      setError(tenantSelectError, "Selecciona un centro.");
      return;
    }
    routeForTenant(slug, memberships);
  }

  async function handleTenantJoin() {
    setError(tenantJoinError, "");
    const course = String(studentCourseSelect?.value || "").trim();
    const joinCode = String(tenantJoinCode?.value || "").trim();
    if (!course) {
      setError(tenantJoinError, "Selecciona tu curso.");
      return;
    }
    if (!joinCode) {
      setError(tenantJoinError, "Introduce el código de centro.");
      return;
    }
    const res = await apiFetch("/api/v1/tenant/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ join_code: joinCode, course }),
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
    try { localStorage.setItem("ttd_activeRole", "student"); } catch {}

    const approvalStatus = normalizeStatus(data?.data?.approval_status || "pending");
    const membershipStatus = normalizeStatus(data?.data?.membership_status || "pending");
    if (approvalStatus === "approved" && membershipStatus === "active") {
      window.location.href = "/assets/student/index.html";
      return;
    }
    await proceedAfterAuth();
    const pendingMembership =
      memberships.find((m) => tenantSlugOf(m) === tenantSlugOf({ tenant }) && isStudentPendingMembership(m)) ||
      memberships.find(isStudentPendingMembership) ||
      memberships[0] ||
      null;
    showStudentPendingStep(pendingMembership);
  }

  async function handleLogout() {
    await logout();
    memberships = [];
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
    const tenantSlug = getSelectedTenantSlug();
    const scoped = membershipsForTenant(tenantSlug);
    const activeRoles = scoped.filter(isActiveMembership).map((m) => normalizeRole(m));
    const hasAdmin = activeRoles.includes("admin");
    const hasStudent = activeRoles.includes("student");
    if (!hasAdmin && !hasStudent) {
      try { window.alert("Tu acceso en este centro no es de alumno."); } catch {}
      return;
    }
    const pendingStudent = scoped.find(isStudentPendingMembership);
    if (!hasAdmin && pendingStudent) {
      showStudentPendingStep(pendingStudent);
      return;
    }
    try {
      const slug =
        tenantSlug ||
        (window.selectedTenant && window.selectedTenant.slug) ||
        (typeof getSelectedTenantSlug === "function" ? getSelectedTenantSlug() : "");
      if (slug) {
        localStorage.setItem("ttd_activeTenantSlug", slug);
      }
      localStorage.setItem("ttd_activeRole", "student");
    } catch {}
    window.location.href = "/assets/student/index.html";
  });
  enterTeacher?.addEventListener("click", () => {
    const tenantSlug = getSelectedTenantSlug();
    const scoped = membershipsForTenant(tenantSlug);
    const activeRoles = scoped.filter(isActiveMembership).map((m) => normalizeRole(m));
    const hasAdmin = activeRoles.includes("admin");
    const hasTeacher = activeRoles.includes("teacher");
    if (!hasAdmin && !hasTeacher) {
      try { window.alert("Tu acceso en este centro no es de docente."); } catch {}
      return;
    }
    try {
      const slug =
        tenantSlug ||
        (window.selectedTenant && window.selectedTenant.slug) ||
        (typeof getSelectedTenantSlug === "function" ? getSelectedTenantSlug() : "");
      if (slug) {
        localStorage.setItem("ttd_activeTenantSlug", slug);
      }
      localStorage.setItem("ttd_activeRole", "teacher");
    } catch {}
    window.location.href = "/assets/teacher/index.html";
  });
  logoutBtn?.addEventListener("click", handleLogout);
  signupToggle?.addEventListener("click", () => showStep("signup"));
  signupBack?.addEventListener("click", () => showStep("login"));
  signupBtn?.addEventListener("click", handleSignup);
  tenantJoinBtn?.addEventListener("click", handleTenantJoin);
  tenantJoinLogout?.addEventListener("click", handleLogout);
  pendingApprovalLogout?.addEventListener("click", handleLogout);

  populateStudentCourseSelect();
  handleExistingSession();
})();
