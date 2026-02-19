import { apiFetch, clearSession, getTenantSlug, logout } from "../../shared/js/auth.js";
import { requireSessionOrRedirect } from "../../shared/js/guard.js";
import { TENANT_LABELS, loadTenantCfg } from "../../shared/js/tenant.js";

export function initStudentTenantBootstrap() {
  const session = requireSessionOrRedirect({ requireTenant: true });

  function getTenant() {
    return getTenantSlug() || "";
  }

  if (!session.tenantSlug) {
    window.location.replace("/");
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
    const res = await apiFetch("/api/v1/student/status");
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        clearSession();
        window.location.href = "/index.html";
        return false;
      }
      if (res.status === 404) {
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
