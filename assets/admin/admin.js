import {
  getAccessToken,
  getTenantSlug,
  logout,
  setActiveTenantSlug,
} from "../shared/js/auth.js";
import { initAdminGroups } from "./modules/admin-groups.js";
import { fetchJSON, isActiveMembership, normalizeRole, tenantSlugOf, tenantNameOf } from "./modules/adminUtils.js";
import { initTeacherSection } from "./modules/adminTeachers.js";
import { initTeacherDrawer } from "./modules/adminTeacherDrawer.js";
import { initGruposSection } from "./modules/adminGrupos.js";
import { initAlumnosSection } from "./modules/adminAlumnos.js";
import { initSupportModal } from "./modules/adminSupport.js";
import { initAdminTabs } from "./modules/adminTabs.js";
import { initTermDatesDrawer } from "./modules/term-dates-drawer.js";
import { initMobileAdmin } from "./mobile/mobileAdmin.js";
import { initAutoScroll } from "./modules/autoScroll.js";
import { processAuthCallback } from "./modules/authCallback.js";
import { createDashboardController } from "./modules/adminDashboard.js";
import { wireSidebarActions } from "./modules/adminSidebarActions.js";

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

  const teacherDrawer = initTeacherDrawer({
    state,
    reloadTeachers: () => teachers.reloadTeachers(),
  });

  // ── Dashboard ─────────────────────────────────────────────────────────────

  const dashboard = createDashboardController({ fetchJSON, state });
  async function loadDashboard() {
    await dashboard.load(() => tabs.refreshMetrics());
  }

  // ── loadSection (accordion lazy load) ────────────────────────────────────

  async function loadSection(sectionName) {
    if (sectionName === "dashboard") {
      await loadDashboard();
    } else if (sectionName === "grupos") {
      if (!state.adminGroupsLoaded) await grupos.loadAdminGroups();
      else grupos.renderGrupos();
    } else if (sectionName === "alumnos") {
      await alumnos.loadUnifiedStudents();
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

  // ── Term dates drawer ─────────────────────────────────────────────────────
  const termDatesDrawer = initTermDatesDrawer();
  document.getElementById("openTermDatesBtn")?.addEventListener("click", () => termDatesDrawer.open());

  // ── Quick actions desde el dashboard ─────────────────────────────────────
  // Se queda aquí (no se extrae): depende de `tabs`, que en el momento de
  // extraerlo estaría a medio construir — no compensa el desacoplamiento.
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
      } else if (action === "ver-pendientes") {
        await tabs.activateTab("alumnos");
        document.querySelector('[data-status-filter="pendiente_aprobacion"]')?.click();
        document.getElementById("alumnosList")?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  wireSidebarActions({ logout, initSupportModalFn: initSupportModal });

  teachers.showInviteStep("basics");
  teachers.renderAssignmentSubjectSelect();
  teachers.renderInviteSummary();
  teachers.refreshInviteButtons();

  await grupos.loadAdminGroups();
  await loadDashboard();

  initMobileAdmin({
    state,
    fetchJSON,
    teacherDrawer,
    roleFlags,
    goTeacher,
    goStudent,
    reloadTeachers: () => teachers.reloadTeachers(),
    reloadGroups:   () => grupos.loadAdminGroups(),
    refreshDashboard: () => loadDashboard(),
    onLogout: async () => { await logout(); window.location.href = "/login"; },
  }).catch((err) => console.error("[admin] mobile init failed:", err));
}

init().catch((err) => {
  if (errorEl) errorEl.textContent = err?.message || "No se pudo cargar la zona admin.";
});
