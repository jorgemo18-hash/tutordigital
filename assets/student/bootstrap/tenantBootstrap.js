import { apiFetch, clearSession, getTenantSlug, logout, setActiveTenantSlug } from "../../shared/js/auth.js";
import { requireSessionOrRedirect } from "../../shared/js/guard.js";
import { TENANT_LABELS, loadTenantCfg } from "../../shared/js/tenant.js";

const DEBUG_STUDENT_BOOT =
  Boolean(window.RUNTIME_CONFIG?.DEBUG_STUDENT_BOOT) ||
  (typeof localStorage !== "undefined" && localStorage.getItem("ttd_debug_student_boot") === "1");

function dlog(...args) { if (DEBUG_STUDENT_BOOT) console.log(...args); }
function dwarn(...args) { if (DEBUG_STUDENT_BOOT) console.warn(...args); }

export function initStudentTenantBootstrap() {
  const session = requireSessionOrRedirect({ requireTenant: false });

  function getTenant() {
    return getTenantSlug() || "";
  }

  function storageSnapshot() {
    try {
      return {
        ttd_activeTenantSlug: localStorage.getItem("ttd_activeTenantSlug"),
        hasAccessToken: Boolean(localStorage.getItem("ttd_access_token")),
      };
    } catch {
      return {};
    }
  }

  function logRedirect(reason, extra = {}) {
    try {
      dwarn("[STUDENT_GUARD] redirect reason", {
        reason,
        path: window.location.pathname,
        search: window.location.search,
        tenant: getTenant(),
        sessionTenant: session?.tenantSlug || "",
        ...storageSnapshot(),
        ...extra,
      });
    } catch {}
  }

  if (!session?.token) {
    logRedirect("missing_token");
    window.location.href = "/index.html";
    return {
      session,
      getTenant,
      TENANT_CFG: null,
      ACTIVE_USER: null,
      loadActiveUser: () => null,
      saveActiveUser: () => {},
      ensureStudentApproval: async () => false,
      initThemeControls: () => {},
    };
  }

  if (!session.tenantSlug) {
    // No redirigimos aún: intentaremos recuperar tenant por membership en ensureStudentApproval().
    try {
      dwarn("[STUDENT_GUARD] missing tenant at bootstrap, will recover via /api/v1/me", {
        path: window.location.pathname,
        search: window.location.search,
        ...storageSnapshot(),
      });
    } catch {}
  }

  if (session.tenantSlug) {
    try { localStorage.setItem("ttd_activeTenantSlug", session.tenantSlug); } catch {}
  }

  const fallbackTenantName =
    getTenant() === "instituto2"
      ? (TENANT_LABELS.instituto2 || "Instituto 2 (demo)")
      : (TENANT_LABELS.lyceo || "Lyceo (demo)");

  const TENANT_CFG = loadTenantCfg(getTenant(), {
    name: fallbackTenantName,
    bgImage: "/assets/bg/instituto.jpg",
  });

  function getActiveUserKey() {
    return `ttd_activeUser_${getTenant()}`;
  }

  function loadActiveUser() {
    try {
      const raw = localStorage.getItem(getActiveUserKey());
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function saveActiveUser(user) {
    try { localStorage.setItem(getActiveUserKey(), JSON.stringify(user)); } catch {}
  }

  const ACTIVE_USER = loadActiveUser();

  async function ensureStudentApproval() {
    if (!getTenant()) {
      try {
        const meRes = await apiFetch("/api/v1/me");
        const meBody = await meRes.json().catch(() => ({}));
        const me = meBody?.data || meBody || {};

        function normalizeRole(m) {
          const r =
            m?.role ??
            m?.member_role ??
            m?.membership_role ??
            (Array.isArray(m?.roles) ? m.roles[0] : undefined) ??
            (Array.isArray(m?.member_roles) ? m.member_roles[0] : undefined);
          return (typeof r === "string" ? r.toLowerCase() : "");
        }

        const memberships = Array.isArray(me?.memberships) ? me.memberships : [];
        const pickStudent = memberships.find((m) => normalizeRole(m) === "student");
        const pickTeacher = memberships.find((m) => ["teacher", "admin"].includes(normalizeRole(m)));
        const chosen = pickStudent || pickTeacher || memberships[0] || null;

        dlog("[STUDENT_GUARD] /api/v1/me memberships", memberships.map((m) => ({
          role: normalizeRole(m),
          tenant: m?.tenant_slug || m?.tenant?.slug || m?.tenantSlug || m?.tenant?.tenant_slug || "",
        })));
        dlog("[STUDENT_GUARD] /api/v1/me selected membership", {
          role: normalizeRole(chosen),
          tenant: chosen?.tenant_slug || chosen?.tenant?.slug || chosen?.tenantSlug || chosen?.tenant?.tenant_slug || "",
        });

        const chosenSlug =
          chosen?.tenant_slug ||
          chosen?.tenant?.slug ||
          chosen?.tenantSlug ||
          chosen?.tenant?.tenant_slug ||
          "";

        if (chosenSlug) {
          setActiveTenantSlug(chosenSlug);
          session.tenantSlug = chosenSlug;
        }
      } catch (error) {
        console.error("[STUDENT_GUARD] tenant recovery failed", error);
      }
    }

    if (!getTenant()) {
      logRedirect("missing_tenant_after_me");
      window.location.href = "/index.html";
      return false;
    }

    const res = await apiFetch("/api/v1/student/status");
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        logRedirect("student_status_unauthorized", { status: res.status });
        clearSession();
        window.location.href = "/index.html";
        return false;
      }
      if (res.status === 404) {
        logRedirect("student_status_not_found", { status: res.status });
        window.location.href = "/index.html";
        return false;
      }
      return true;
    }

    const approval = body?.data?.student?.approval_status || "pending";

    if (approval === "approved") {
      const student = body?.data?.student;
      if (student?.id) {
        saveActiveUser({
          userId: student.id,
          role: "student",
          displayName: student.display_name || "",
          groupId: student.group_id || "",
        });
      }
      return true;
    }

    const overlay = document.createElement("div");
    overlay.className = "modalOverlay open";
    overlay.id = "studentApprovalStatus";

    const title = approval === "rejected" ? "Acceso no aprobado" : "Pendiente de aprobación";
    const message =
      approval === "rejected"
        ? "Tu acceso no ha sido aprobado. Contacta con tu profesor."
        : "Tu solicitud está pendiente de aprobación por tu profesor.";

    overlay.innerHTML = `
      <div class="modalCard">
        <div class="modalBrand">Tutordigital</div>
        <div class="modalTitle">${title}</div>
        <p class="modalHint">${message}</p>
        <button class="modalBtn" type="button" id="studentApprovalLogout">Cerrar sesión</button>
      </div>
    `;

    document.body.appendChild(overlay);

    const logoutBtn = overlay.querySelector("#studentApprovalLogout");
    logoutBtn?.addEventListener("click", async () => {
      await logout();
      logRedirect("approval_overlay_logout_click");
      window.location.href = "/index.html";
    });

    return false;
  }

  function initThemeControls() {
    function getThemeKey() {
      return `ttdTheme_${getTenant()}`;
    }

    function applyTheme(theme) {
      const t = (theme === "dark" || theme === "light") ? theme : "";
      if (t) document.documentElement.dataset.theme = t;
      else delete document.documentElement.dataset.theme;

      try { localStorage.setItem(getThemeKey(), t); } catch {}
    }

    function updateThemeToggleLabel(btn) {
      if (!btn) return;
      const current = document.documentElement.dataset.theme || "dark";
      btn.textContent = current === "dark" ? "Claro" : "Oscuro";
    }

    try {
      const saved = localStorage.getItem(getThemeKey());
      if (saved === "dark" || saved === "light") applyTheme(saved);
    } catch {}

    try {
      const themeBtn = document.getElementById("themeToggle");
      if (themeBtn) {
        updateThemeToggleLabel(themeBtn);
        themeBtn.addEventListener("click", () => {
          const current = document.documentElement.dataset.theme || "dark";
          const next = current === "dark" ? "light" : "dark";
          applyTheme(next);
          updateThemeToggleLabel(themeBtn);
        });
      }
    } catch {}

    window.addEventListener("message", (ev) => {
      try {
        if (ev.origin !== window.location.origin) return;
        const d = ev.data || {};
        if (d.type === "ttd:set-theme") applyTheme(d.theme);
      } catch {}
    });
  }

  return {
    session,
    getTenant,
    TENANT_CFG,
    ACTIVE_USER,
    loadActiveUser,
    saveActiveUser,
    ensureStudentApproval,
    initThemeControls,
  };
}
