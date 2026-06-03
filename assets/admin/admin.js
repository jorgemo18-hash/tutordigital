import {
  getAccessToken,
  getTenantSlug,
  logout,
  setActiveTenantSlug,
  setSessionTokens,
} from "../shared/js/auth.js";
import { buildHeader } from "../shared/js/header.js";
import { initAdminGroups } from "./modules/admin-groups.js";
import { fetchJSON, isActiveMembership, normalizeRole, tenantSlugOf, tenantNameOf } from "./modules/adminUtils.js";
import { initTeacherSection } from "./modules/adminTeachers.js";
import { initGruposSection } from "./modules/adminGrupos.js";
import { initAlumnosSection } from "./modules/adminAlumnos.js";
import { initSupportModal } from "./modules/adminSupport.js";
import { initAdminTabs } from "./modules/adminTabs.js";

// ── State ──────────────────────────────────────────────────────────────────

const state = {
  me: null,
  tenantSlug: "",
  tenantName: "",
  memberships: [],
  groups: [],
  teachers: [],
  customSubjects: [],
  allGroups: [],
  selectedGroupIds: new Set(),
  // GRUPOS navigation
  adminGroups: [],
  adminGroupsLoaded: false,
  gruposLevel: 1,
  gruposStage: null,
  gruposYear: null,
  // DOCENTES
  teachersLoaded: false,
  // ALUMNOS
  activeGroupForStudents: null,
  groupStudents: [],
};

// ── DOM refs ───────────────────────────────────────────────────────────────

const tenantEl  = document.getElementById("adminTenant");
const errorEl   = document.getElementById("adminError");

const stageSelect       = document.getElementById("stageSelect");
const yearSelect        = document.getElementById("yearSelect");
const trackSelect       = document.getElementById("trackSelect");
const customTrackWrap   = document.getElementById("customTrackWrap");
const customTrackInput  = document.getElementById("customTrackInput");
const groupChips        = document.getElementById("groupChips");
const groupsHint        = document.getElementById("groupsHint");
const tutorGroupSelect  = document.getElementById("tutorGroupSelect");

const groupsEls = {
  stageSelect,
  yearSelect,
  trackSelect,
  customTrackWrap,
  customTrackInput,
  trackPills: null,
  groupGrid: null,
  groupChips,
  groupsHint,
  tutorGroupSelect,
  adminError: errorEl,
};

// ── Helpers ────────────────────────────────────────────────────────────────

function setError(msg) {
  if (!errorEl) return;
  errorEl.textContent = msg || "";
}

function selectedTenantMemberships() {
  return (state.memberships || []).filter((m) => tenantSlugOf(m) === state.tenantSlug);
}

function roleFlags() {
  const roles = selectedTenantMemberships().filter(isActiveMembership).map(normalizeRole);
  return { hasAdmin: roles.includes("admin"), hasTeacher: roles.includes("teacher"), hasStudent: roles.includes("student") };
}

function goTeacher() {
  try { localStorage.setItem("ttd_activeRole", "teacher"); } catch {}
  window.location.href = "/assets/teacher/";
}

function goStudent() {
  try { localStorage.setItem("ttd_activeRole", "student"); } catch {}
  window.location.href = "/assets/student/";
}

// ── Generic auto-scroll for any expanding element ─────────────────────────

/**
 * Scroll `el` into view if it extends below the viewport.
 * For accordion bodies, scrolls to the parent section so the header stays
 * visible. Does nothing if the top of the target is above the viewport
 * (the user has already scrolled past it).
 */
function scrollIfBelow(el) {
  requestAnimationFrame(() => {
    if (!el.isConnected) return;
    const target = el.classList.contains("accordionBody")
      ? (el.closest(".accordion") ?? el)
      : el;
    // Si ya estamos al top de la página no hace falta scrollear a ningún sitio
    if (window.scrollY === 0) return;
    const rect = target.getBoundingClientRect();
    if (rect.top >= 0 && rect.bottom > window.innerHeight) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

/**
 * Register generic scroll observers — call once at init.
 * Covers:
 *   • <details> elements opening (toggle event, capture phase)
 *   • Elements whose `hidden` class is removed
 *   • Elements whose HTML `hidden` attribute is removed
 */
function initAutoScroll() {
  // <details> — toggle doesn't bubble reliably across browsers
  document.addEventListener("toggle", (e) => {
    if (e.target.open) scrollIfBelow(e.target);
  }, { capture: true });

  const observer = new MutationObserver((mutations) => {
    for (const mut of mutations) {
      const el = mut.target;
      if (mut.attributeName === "class") {
        const hadHidden = (mut.oldValue ?? "").split(/\s+/).includes("hidden");
        if (hadHidden && !el.classList.contains("hidden")) scrollIfBelow(el);
      } else if (mut.attributeName === "hidden") {
        // oldValue is "" when attribute was present, null when absent
        if (mut.oldValue !== null && !el.hasAttribute("hidden")) scrollIfBelow(el);
      }
    }
  });
  observer.observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "hidden"],
    attributeOldValue: true,
  });
}

// ── Auth callback processing (magic link / impersonation) ──────────────────

async function processAuthCallback() {
  const qs   = new URLSearchParams(window.location.search);
  const code  = qs.get("code") || "";
  const hash  = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  const hashP = new URLSearchParams(hash);
  const accessToken = hashP.get("access_token") || "";

  // Si el callback incluye el slug del tenant (impersonación), fijarlo ahora
  // antes de cualquier API call para que getTenantSlug() devuelva el valor correcto.
  const tenantFromUrl = qs.get("tenant") || "";
  if (tenantFromUrl) setActiveTenantSlug(tenantFromUrl);

  if (code) {
    // PKCE: intercambiar el código por una sesión via el endpoint existente
    try {
      const res = await fetch("/api/v1/auth/exchange-invite-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = await res.json().catch(() => ({}));
      const d = body?.data || {};
      if (d.access_token) {
        setSessionTokens({
          access_token:  d.access_token,
          refresh_token: d.refresh_token || undefined,
          expires_at:    d.expires_at    || undefined,
        });
      }
    } catch (e) {
      console.error("[admin] exchange code failed:", e);
    }
    // Limpiar el ?code= de la URL (mantener ?impersonating= y ?tenant= si están)
    const clean = new URLSearchParams(window.location.search);
    clean.delete("code");
    const newSearch = clean.toString() ? "?" + clean.toString() : "";
    window.history.replaceState({}, document.title, window.location.pathname + newSearch);
    return;
  }

  if (accessToken) {
    // Implicit: token en el hash
    const refreshToken = hashP.get("refresh_token") || "";
    const expiresAt    = Number(hashP.get("expires_at") || 0) || null;
    const expiresIn    = Number(hashP.get("expires_in") || 0) || null;
    setSessionTokens({
      access_token:  accessToken,
      refresh_token: refreshToken || undefined,
      expires_at:    expiresAt || (expiresIn ? Math.floor(Date.now() / 1000) + expiresIn : undefined),
    });
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  }
}

// ── Init ───────────────────────────────────────────────────────────────────

async function init() {
  initAutoScroll();

  // Procesar token si llegamos desde un magic link (impersonación)
  await processAuthCallback();

  const token = getAccessToken();
  if (!token) { window.location.href = "/login"; return; }

  const me = await fetchJSON("/api/v1/me");
  state.me          = me;
  state.memberships = Array.isArray(me?.memberships) ? me.memberships : [];

  const activeMemberships = state.memberships.filter(isActiveMembership);
  if (!activeMemberships.length) { window.location.href = "/login"; return; }

  let tenantSlug = String(getTenantSlug() || "").trim();
  if (!tenantSlug) {
    tenantSlug = tenantSlugOf(activeMemberships[0]) || "";
    if (tenantSlug) setActiveTenantSlug(tenantSlug);
  }

  let scoped = activeMemberships.filter((m) => tenantSlugOf(m) === tenantSlug);
  if (!scoped.length) {
    scoped     = activeMemberships;
    tenantSlug = tenantSlugOf(scoped[0]) || tenantSlug;
    if (tenantSlug) setActiveTenantSlug(tenantSlug);
  }

  state.tenantSlug = tenantSlug;
  state.tenantName = tenantNameOf(scoped[0]) || tenantSlug;
  if (tenantSlug) setActiveTenantSlug(tenantSlug);

  const flags = roleFlags();
  if (!flags.hasAdmin) {
    if (flags.hasTeacher) return goTeacher();
    if (flags.hasStudent) return goStudent();
    window.location.href = "/login";
    return;
  }

  if (tenantEl) tenantEl.textContent = state.tenantName || "—";
  const heroTenantEl = document.getElementById("heroTenantName");
  if (heroTenantEl) heroTenantEl.textContent = state.tenantName || "—";

  // ── Init modules ──────────────────────────────────────────────────────────

  let groupsModule = null;

  groupsModule = initAdminGroups({
    apiFetch: fetchJSON,
    els: groupsEls,
    state,
    opts: {
      onSelectionChange: () => { teachers.renderInviteSummary(); teachers.refreshInviteButtons(); },
      onGroupsUpdated: () => { teachers?.renderGroupPicker?.(); },
    },
  });

  const grupos = initGruposSection({
    state,
    onGroupsLoaded: () => groupsModule?.loadGroups(),
  });

  const alumnos = initAlumnosSection({
    state,
    gruposGoTo:   grupos.gruposGoTo,
    renderGrupos: grupos.renderGrupos,
  });

  const teachers = initTeacherSection({
    state,
    groupsEls,
    setError,
  });

  // ── Dashboard ─────────────────────────────────────────────────────────────

  function renderActivityToday(data) {
    const dateEl = document.getElementById("activityDate");
    if (dateEl) {
      dateEl.textContent = new Date().toLocaleDateString("es-ES", {
        weekday: "long", day: "numeric", month: "long",
      });
    }
    const studentsBox = document.getElementById("activityStudentsBox");
    const teachersBox = document.getElementById("activityTeachersBox");
    const n = data?.activity_today || {};

    if (studentsBox) {
      const count = n.students ?? 0;
      studentsBox.innerHTML = count > 0
        ? `<div class="av-metric-num" style="font-size:36px">${count}</div>
           <div class="av-metric-eye" style="margin-top:6px">Alumnos en el tutor</div>`
        : `<p class="emptyState">Ningún alumno ha abierto el tutor hoy.</p>`;
    }
    if (teachersBox) {
      const count = n.teachers ?? 0;
      teachersBox.innerHTML = count > 0
        ? `<div class="av-metric-num" style="font-size:36px">${count}</div>
           <div class="av-metric-eye" style="margin-top:6px">Profesores en el panel</div>`
        : `<p class="emptyState">Ningún profesor ha accedido hoy.</p>`;
    }
  }

  async function loadDashboard() {
    try {
      const data = await fetchJSON("/api/v1/admin/dashboard");
      state.dashboardData = data;
      tabs.refreshMetrics();
      renderActivityToday(data);
    } catch (err) {
      console.error("[admin] dashboard fetch failed:", err?.message);
      renderActivityToday(null);
    }
  }

  // ── loadSection (accordion lazy load) ────────────────────────────────────

  async function loadSection(sectionName) {
    if (sectionName === "dashboard") {
      await loadDashboard();
    } else if (sectionName === "grupos") {
      if (!state.adminGroupsLoaded) await grupos.loadAdminGroups();
      else grupos.renderGrupos();
    } else if (sectionName === "alumnos") {
      await alumnos.loadAllStudents();
    } else if (sectionName === "docentes") {
      if (!state.teachersLoaded) await teachers.reloadTeachers();
    }
  }

  // ── Wire events ───────────────────────────────────────────────────────────

  const tabs = initAdminTabs({
    loadSection,
    state,
    onLeave:      { profesores: () => teachers.closeInvitePanel() },
    onReactivate: { grupos: () => { if (state.gruposLevel > 1) grupos.gruposGoTo(1); } },
  });

  // ── Quick actions desde el dashboard ─────────────────────────────────────
  document.querySelectorAll("[data-quick-action]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.quickAction;
      if (action === "crear-grupo") {
        await tabs.activateTab("grupos");
        document.getElementById("toggleCreateGroupBtn")?.click();
      } else if (action === "invitar-profesor") {
        await tabs.activateTab("profesores");
        document.getElementById("showInviteFormBtn")?.click();
      } else if (action === "invitar-alumno") {
        await tabs.activateTab("alumnos");
        document.getElementById("showInviteStudentBtn")?.click();
      }
    });
  });

  const alumnosHandlers = alumnos.wireEvents({
    reloadTeachers:  () => teachers.reloadTeachers(),
    teachersLoaded:  () => state.teachersLoaded,
  });

  grupos.wireEvents({
    onOpenStudentsForGroup: (id, name, hint) => alumnosHandlers.openStudentsForGroup(id, name, hint),
  });

  teachers.wireEvents();

  // ── Header + wizard init ──────────────────────────────────────────────────

  buildHeader(document.getElementById("headerNav"), {
    role: "admin",
    btnClass: "btn ghost",
    onLogout: async () => { await logout(); window.location.href = "/login"; },
  });

  // ── Botón "Volver al superadmin" si viene de impersonación ──────────────
  const isImpersonating = new URLSearchParams(window.location.search).get("impersonating") === "true";
  if (isImpersonating) {
    const headerNav = document.getElementById("headerNav");
    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "btn ghost";
    backBtn.textContent = "← Volver al superadmin";
    backBtn.style.cssText = "background:rgba(202,124,59,.15);border-color:rgba(202,124,59,.4);color:#ca7c3b;margin-right:8px";
    backBtn.addEventListener("click", () => {
      if (window.opener) {
        window.close();
      } else {
        window.location.href = "https://tutordigital.app/assets/superadmin/index.html";
      }
    });
    headerNav?.prepend(backBtn);
  }

  // ── Modal de soporte ──────────────────────────────────────────────────────
  const support = initSupportModal();

  // Botones "Ver como" — visibles solo si el admin también tiene ese rol
  const headerNav = document.getElementById("headerNav");
  const viewRoles = [
    { label: "Ver como profesor", role: "teacher", url: "/assets/teacher/" },
    { label: "Ver como alumno",   role: "student", url: "/assets/student/" },
  ];
  for (const vr of viewRoles) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn ghost small";
    btn.textContent = vr.label;
    btn.addEventListener("click", () => {
      try {
        localStorage.setItem("ttd_activeRole", vr.role);
        localStorage.setItem("ttd_admin_return", "1");
      } catch {}
      window.location.href = vr.url;
    });
    headerNav?.insertBefore(btn, headerNav.lastElementChild);
  }

  // Botón "¿Necesitas ayuda?" en el header (antes del botón de logout)
  if (headerNav?.lastElementChild) {
    const sep = document.createElement("span");
    sep.className = "headerSupportSep";
    sep.setAttribute("aria-hidden", "true");
    headerNav.insertBefore(sep, headerNav.lastElementChild);

    const helpBtn = document.createElement("button");
    helpBtn.type = "button";
    helpBtn.className = "btn ghost headerSupportLink";
    helpBtn.textContent = "¿Necesitas ayuda?";
    helpBtn.addEventListener("click", () => support.open());
    headerNav.insertBefore(helpBtn, headerNav.lastElementChild);
  }

  teachers.showInviteStep("basics");
  teachers.renderAssignmentSubjectSelect();
  teachers.renderInviteSummary();
  teachers.refreshInviteButtons();

  await grupos.loadAdminGroups();
  await loadDashboard();
}

init().catch((err) => {
  if (errorEl) errorEl.textContent = err?.message || "No se pudo cargar la zona admin.";
});
