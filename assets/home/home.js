// /assets/home/home.js

(function () {
  const TENANT_PASSWORDS = {
    lyceo: "lyceo",
    instituto2: "lyceo2",
  };

  const TENANT_LABELS = {
    lyceo: "Lyceo (demo)",
    instituto2: "Instituto 2 (demo)",
  };

  function normalizeTenant(raw) {
    const value = String(raw || "").trim().toLowerCase();
    if (!value) return "";
    const map = {
      lyceo: "lyceo",
      instituto1: "lyceo",
      inst1: "lyceo",
      inst2: "instituto2",
      instituto2: "instituto2",
    };
    return map[value] || value;
  }

  function getTenantCfgKey(tenantId) {
    return `ttd_tenantCfg_${tenantId}`;
  }

  function loadTenantCfg(tenantId) {
    if (!tenantId) return null;
    const key = getTenantCfgKey(tenantId);
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch {}
    const cfg = {
      name: TENANT_LABELS[tenantId] || tenantId,
      subtitle: "Zona docente",
      bgImage: "/assets/bg/instituto.jpg",
    };
    try { localStorage.setItem(key, JSON.stringify(cfg)); } catch {}
    return cfg;
  }

  function setTenantBg(cfg) {
    if (!cfg?.bgImage) return;
    document.documentElement.style.setProperty("--bg-photo", `url(\"${cfg.bgImage}\")`);
  }

  function init() {
    const params = new URLSearchParams(location.search);
    const urlTenantRaw = params.get("tenant");
    const storedTenantRaw = localStorage.getItem("ttd_activeTenant") || "";
    const tenantFromUrl = normalizeTenant(urlTenantRaw);
    const tenantFromStorage = normalizeTenant(storedTenantRaw);
    const initialTenant = tenantFromUrl || tenantFromStorage || "";

    if (!tenantFromUrl && tenantFromStorage) {
      location.replace(`/?tenant=${encodeURIComponent(tenantFromStorage)}`);
      return;
    }

    if (initialTenant) {
      try { localStorage.setItem("ttd_activeTenant", initialTenant); } catch {}
    }

    const $ = (id) => document.getElementById(id);

    const stepTenant = $("stepTenant");
    const stepPassword = $("stepPassword");
    const stepRole = $("stepRole");

    const tenantCode = $("tenantCode");
    const tenantNext = $("tenantNext");
    const tenantError = $("tenantError");
    const tenantName = $("tenantName");
    const tenantName2 = $("tenantName2");

    const tenantPassword = $("tenantPassword");
    const tenantLogin = $("tenantLogin");
    const passError = $("passError");

    const enterStudent = $("enterStudent");
    const enterTeacher = $("enterTeacher");

    let activeTenant = initialTenant;
    if (tenantCode && activeTenant) {
      tenantCode.value = activeTenant.toUpperCase();
    }

    const show = (el, visible) => {
      if (!el) return;
      el.classList.toggle("hidden", !visible);
    };

    const setError = (el, msg) => {
      if (!el) return;
      if (!msg) {
        el.style.display = "none";
        el.textContent = "";
        return;
      }
      el.textContent = msg;
      el.style.display = "block";
    };

    function updateTenantUI() {
      const cfg = loadTenantCfg(activeTenant);
      setTenantBg(cfg);
      if (tenantName) tenantName.textContent = cfg?.name || activeTenant || "—";
      if (tenantName2) tenantName2.textContent = cfg?.name || activeTenant || "—";
    }

    function goStep(step) {
      show(stepTenant, step === "tenant");
      show(stepPassword, step === "password");
      show(stepRole, step === "role");
    }

    function hasTenantAccess(tenantId) {
      if (!tenantId) return false;
      return localStorage.getItem(`ttd_tenantAccess_${tenantId}`) === "ok";
    }

    function setTenantAccess(tenantId) {
      localStorage.setItem(`ttd_tenantAccess_${tenantId}`, "ok");
    }

    function resolveTenantFromInput(raw) {
      const value = normalizeTenant(raw);
      if (!value) return "";
      if (value === "lyceo" || value === "instituto2") return value;
      return "";
    }

    function applyTenant(tenantId) {
      activeTenant = tenantId;
      try { localStorage.setItem("ttd_activeTenant", tenantId); } catch {}
      updateTenantUI();
      if (hasTenantAccess(tenantId)) {
        goStep("role");
      } else {
        goStep("password");
      }
      if (location.search !== `?tenant=${encodeURIComponent(tenantId)}`) {
        history.replaceState({}, "", `/?tenant=${encodeURIComponent(tenantId)}`);
      }
    }

    tenantNext?.addEventListener("click", () => {
      setError(tenantError, "");
      const tenantId = resolveTenantFromInput(tenantCode?.value || "");
      if (!tenantId) {
        setError(tenantError, "Código no reconocido. Usa LYCEO o INST2.");
        tenantCode?.focus();
        return;
      }
      applyTenant(tenantId);
    });

    tenantCode?.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        tenantNext?.click();
      }
    });

    tenantLogin?.addEventListener("click", () => {
      setError(passError, "");
      const expected = TENANT_PASSWORDS[activeTenant] || "lyceo";
      const value = String(tenantPassword?.value || "").trim().toLowerCase();
      if (value !== expected) {
        setError(passError, "Contraseña incorrecta para este centro.");
        tenantPassword?.focus();
        return;
      }
      setTenantAccess(activeTenant);
      goStep("role");
    });

    tenantPassword?.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        tenantLogin?.click();
      }
    });

    enterStudent?.addEventListener("click", () => {
      if (!activeTenant) return;
      window.location.href = `/assets/student/index.html?tenant=${encodeURIComponent(activeTenant)}`;
    });

    enterTeacher?.addEventListener("click", () => {
      if (!activeTenant) return;
      window.location.href = `/assets/teacher/index.html?tenant=${encodeURIComponent(activeTenant)}`;
    });

    if (activeTenant) {
      updateTenantUI();
      if (hasTenantAccess(activeTenant)) {
        goStep("role");
      } else {
        goStep("password");
      }
    } else {
      goStep("tenant");
      tenantCode?.focus();
    }
  }

  init();
})();
