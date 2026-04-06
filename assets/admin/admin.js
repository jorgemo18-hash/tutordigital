import {
  getAccessToken,
  getTenantSlug,
  logout,
  setActiveTenantSlug,
} from "../shared/js/auth.js";
import { buildHeader } from "../shared/js/header.js";
import { initAdminGroups } from "./modules/admin-groups.js";
import { initAdminStudentApproval } from "./modules/admin-student-approval.js";
import { fetchJSON, toItems, isActiveMembership, normalizeRole, tenantSlugOf, tenantNameOf, escHtml } from "./modules/adminUtils.js";
import { initTeacherSection } from "./modules/adminTeachers.js";
import { initGruposSection } from "./modules/adminGrupos.js";
import { initAlumnosSection } from "./modules/adminAlumnos.js";

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

// ── Accordion ──────────────────────────────────────────────────────────────

function toggleAccordion(button) {
  const targetId = button?.dataset?.accordionTarget;
  if (!targetId) return;
  const body    = document.getElementById(targetId);
  const section = button.closest(".accordion");
  const caret   = button.querySelector(".accordionCaret");
  if (!body || !section || !caret) return;

  const isOpen = !body.classList.contains("hidden");
  body.classList.toggle("hidden", isOpen);
  section.classList.toggle("isOpen", !isOpen);
  button.setAttribute("aria-expanded", String(!isOpen));
  caret.textContent = isOpen ? "▸" : "▾";

  if (!isOpen) {
    const sectionName = button.dataset.section;
    if (sectionName) loadSection(sectionName).catch(console.error);
  }
}

// ── Init ───────────────────────────────────────────────────────────────────

async function init() {
  const token = getAccessToken();
  if (!token) { window.location.href = "/index.html"; return; }

  const me = await fetchJSON("/api/v1/me");
  state.me          = me;
  state.memberships = Array.isArray(me?.memberships) ? me.memberships : [];

  const activeMemberships = state.memberships.filter(isActiveMembership);
  if (!activeMemberships.length) { window.location.href = "/index.html"; return; }

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

  const flags = roleFlags();
  if (!flags.hasAdmin) {
    if (flags.hasTeacher) return goTeacher();
    if (flags.hasStudent) return goStudent();
    window.location.href = "/index.html";
    return;
  }

  if (tenantEl) tenantEl.textContent = state.tenantName || "—";

  // ── Init modules ──────────────────────────────────────────────────────────

  let groupsModule = null;

  groupsModule = initAdminGroups({
    apiFetch: fetchJSON,
    els: groupsEls,
    state,
    opts: {
      onSelectionChange: () => { teachers.renderInviteSummary(); teachers.refreshInviteButtons(); },
    },
  });

  const approvalModule = initAdminStudentApproval({ fetchJSON, escHtml });

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
    getGroupsModule: () => groupsModule,
    setError,
  });

  // ── loadSection (accordion lazy load) ────────────────────────────────────

  async function loadSection(sectionName) {
    if (sectionName === "grupos") {
      if (!state.adminGroupsLoaded) await grupos.loadAdminGroups();
      else grupos.renderGrupos();
    } else if (sectionName === "alumnos") {
      if (state.activeGroupForStudents) await alumnos.loadStudents();
      await approvalModule?.load();
    } else if (sectionName === "docentes") {
      if (!state.teachersLoaded) await teachers.reloadTeachers();
    }
  }

  // ── Wire events ───────────────────────────────────────────────────────────

  document.querySelectorAll(".accordionHeader[data-accordion-target]").forEach((btn) => {
    btn.addEventListener("click", () => toggleAccordion(btn));
  });

  const alumnosHandlers = alumnos.wireEvents({
    reloadTeachers:  () => teachers.reloadTeachers(),
    teachersLoaded:  () => state.teachersLoaded,
  });

  grupos.wireEvents({
    getGroupsModule:         () => groupsModule,
    onOpenStudentsForGroup:  (id, name) => alumnosHandlers.openStudentsForGroup(id, name),
  });

  teachers.wireEvents();

  // ── Header + wizard init ──────────────────────────────────────────────────

  buildHeader(document.getElementById("headerNav"), {
    role: "admin",
    btnClass: "btn ghost",
    onLogout: async () => { await logout(); window.location.href = "/index.html"; },
  });

  // ── Enlace de soporte (antes del botón de logout) ─────────────────────────
  const headerNav = document.getElementById("headerNav");
  if (headerNav?.lastElementChild) {
    const sep = document.createElement("span");
    sep.className = "headerSupportSep";
    sep.setAttribute("aria-hidden", "true");
    headerNav.insertBefore(sep, headerNav.lastElementChild);

    const link = document.createElement("a");
    link.href = "mailto:info@tutordigital.app";
    link.target = "_blank";
    link.rel = "noopener";
    link.className = "btn ghost headerSupportLink";
    link.textContent = "¿Necesitas ayuda?";
    headerNav.insertBefore(link, headerNav.lastElementChild);
  }

  teachers.showInviteStep("basics");
  teachers.renderSubjectSelect();
  teachers.renderSubjectChips();
  teachers.renderInviteSummary();
  teachers.refreshSubjectAddVisibility();
  teachers.refreshInviteButtons();

  await grupos.loadAdminGroups();
}

init().catch((err) => {
  if (errorEl) errorEl.textContent = err?.message || "No se pudo cargar la zona admin.";
});
