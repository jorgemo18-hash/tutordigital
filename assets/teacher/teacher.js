import {
  createInitialState,
  loadData,
  saveData,
  refreshData,
  getTenantId,
  getStudentOrderKey,
  loadTenantCfg,
  loadTeacherSession,
  saveTeacherSession,
  migrateTeacherScopedData,
} from "./js/state.js";
import { getSystemTheme, getSavedTheme, applyTheme } from "./js/theme.js";
import { cacheDashboardElements, cacheLoginElements, renderGroups } from "./js/dom.js";
import { renderLoginView, renderDashboard } from "./js/templates.js";
import { renderStudents } from "./js/students.js";
import { renderPlanner, renderTaskDetailAttachments } from "./js/tasks.js";
import { renderTickets } from "./js/tickets.js";
import { bindDashboardEvents, bindLoginEvents, closeTaskModal } from "./js/modals.js";
import { apiFetch, clearSession, logout } from "../shared/js/auth.js";
import { requireSessionOrRedirect } from "../shared/js/guard.js";
import { getActiveGroupId } from "../shared/js/groupState.js";
import {
  applyTenantBranding,
  updateTenantUI,
  updateTeacherSelect,
  setAdminPanelVisible,
  getTenant,
} from "./js/bootstrap/teacherBootstrap.js";
import { loadGroups, setActiveGroup } from "./js/features/groups.js";
import { buildHeader } from "../shared/js/header.js";
import { ensureCurrentGroup, loadStudentsForActiveGroup } from "./js/features/students.js";
import { loadTasksForActiveGroup } from "./js/features/tasks.js";
import { loadTicketsForActiveGroup } from "./js/features/tickets.js";
import { refreshNotebookForActiveGroup } from "./js/features/notebook.js";
import { renderTasksSection } from "./js/features/tasks-section.js";
import { loadTeacherRequests } from "./js/features/teacherRequests.js";

const appRoot = document.getElementById("teacherApp");
const state = createInitialState();
let elements = {};
let tenantCfg = null;

requireSessionOrRedirect({ requireTenant: true });

const ctx = {
  state,
  get elements() {
    return elements;
  },
  setElements(next) {
    elements = next;
  },
  cacheDashboardElements,
  cacheLoginElements,
  getTenant,
  renderAll() {
    renderGroups(ctx);
    renderStudents(ctx);
    renderPlanner(ctx);
    renderTickets(ctx);
    refreshNotebookForActiveGroup(ctx);
    renderTasksSection(ctx).catch(console.error);
  },
  renderStudents() {
    renderStudents(ctx);
  },
  renderPlanner() {
    renderPlanner(ctx);
  },
  renderTickets() {
    renderTickets(ctx);
  },
  refreshNotebookForActiveGroup() {
    return refreshNotebookForActiveGroup(ctx);
  },
  refreshTasksSection() {
    return renderTasksSection(ctx);
  },
  loadStudentsForActiveGroup() {
    return loadStudentsForActiveGroup(ctx);
  },
  loadTasksForActiveGroup() {
    return loadTasksForActiveGroup(ctx);
  },
  loadTicketsForActiveGroup() {
    return loadTicketsForActiveGroup(ctx);
  },
  loadGroups() {
    return loadGroups(ctx);
  },
  loadTeacherRequests() {
    return loadTeacherRequests(ctx);
  },
  setActiveGroup(groupId) {
    return setActiveGroup({
      groupId,
      groups: state.data?.groups || [],
      elements,
      tenant: getTenant(),
      state,
      onGroupChange: {
        loadTasksForActiveGroup: () => ctx.loadTasksForActiveGroup(),
        loadStudentsForActiveGroup: () => ctx.loadStudentsForActiveGroup(),
        loadTicketsForActiveGroup: () => ctx.loadTicketsForActiveGroup(),
        refreshNotebookForActiveGroup: () => ctx.refreshNotebookForActiveGroup(),
        refreshTasksSection: () => ctx.refreshTasksSection().catch(console.error),
      },
    });
  },
  renderTaskDetailAttachments(attachments) {
    renderTaskDetailAttachments(ctx, attachments);
  },
  saveData() {
    saveData(state.tenantId, state.data);
  },
  refreshData() {
    refreshData(state, state.tenantId, state.currentTeacherId);
  },
  closeTaskModal() {
    closeTaskModal(ctx);
  },
  bindDashboardEvents() {
    bindDashboardEvents(ctx);
  },
  bindLoginEvents() {
    bindLoginEvents(ctx);
  },
  renderDashboard() {
    renderDashboard(appRoot, ctx);
    updateTenantUI(elements, tenantCfg, state);
    updateTeacherSelect(elements, state);
    setAdminPanelVisible(elements, state.currentRole === "admin");
  },
  renderLoginView() {
    renderLoginView(appRoot, ctx);
  },
  updateTenantUI() {
    updateTenantUI(elements, tenantCfg, state);
  },
};

async function loadCurrentMembership() {
  const res = await apiFetch("/api/v1/me");
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    clearSession();
    window.location.href = "/login";
    return null;
  }

  const memberships = body?.data?.memberships || [];
  const tenantSlug = getTenant();
  const membership = memberships.find((m) => m?.tenant?.slug === tenantSlug) || null;
  if (!membership) {
    window.location.href = "/login";
    return null;
  }
  if (membership.role === "student") {
    window.location.href = "/assets/student/index.html";
    return null;
  }

  state.currentRole = membership.role || "teacher";
  if (body?.data?.user?.display_name) {
    state.currentTeacherName = body.data.user.display_name;
  }
  setAdminPanelVisible(elements, state.currentRole === "admin");
  return membership;
}

async function init() {
  state.tenantId = getTenantId();
  if (!state.tenantId) {
    window.location.replace("/");
    return;
  }
  try { localStorage.setItem("ttd_activeTenantSlug", state.tenantId); } catch {}

  const homeLink = document.getElementById("homeLink");
  if (homeLink) {
    homeLink.href = "/index.html";
  }

  tenantCfg = loadTenantCfg(state.tenantId);
  applyTenantBranding(tenantCfg);

  const membership = await loadCurrentMembership();
  if (!membership) return;

  const savedTheme = getSavedTheme(state.tenantId);
  if (savedTheme) {
    applyTheme(savedTheme, state.tenantId);
  } else {
    applyTheme(getSystemTheme() || "dark", state.tenantId);
  }

  const teacherSession = loadTeacherSession(state.tenantId);
  state.currentTeacherId = teacherSession?.teacherId || "p1";

  // API name takes priority over localStorage
  const apiName = state.currentTeacherName; // set by loadCurrentMembership()
  const sessionName = teacherSession?.teacherName || "";
  if (apiName) {
    // Always use API name; update session if it differs
    if (!teacherSession || sessionName !== apiName) {
      saveTeacherSession(state.tenantId, {
        teacherId: state.currentTeacherId,
        teacherName: apiName,
      });
    }
  } else {
    state.currentTeacherName = sessionName;
    if (!teacherSession) {
      saveTeacherSession(state.tenantId, {
        teacherId: state.currentTeacherId,
        teacherName: sessionName,
      });
    }
  }

  state.data = loadData(state.tenantId, state.currentTeacherId);
  if (migrateTeacherScopedData(state.data, state.currentTeacherId)) {
    saveData(state.tenantId, state.data);
  }

  state.currentGroupId = getActiveGroupId(getTenant()) || state.data.groups[0]?.id;
  state.studentOrder = localStorage.getItem(getStudentOrderKey(state.tenantId)) || "status";
  ensureCurrentGroup(state);

  ctx.renderDashboard();

  // ── Theme toggle ────────────────────────────────────────────────────────────
  const toggleBtn = ctx.elements.themeToggle;
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const current = document.documentElement.dataset.theme || "dark";
      applyTheme(current === "dark" ? "light" : "dark", state.tenantId);
    });
  }

  buildHeader(document.getElementById("headerNav"), {
    role: "teacher",
    btnClass: "headerAction",
    skipTheme: true,
    onLogout: async () => { await logout(); window.location.href = "/login"; },
  });

  // Botón "← Admin" — solo si el admin abrió este panel desde el panel admin
  try {
    const headerNav = document.getElementById("headerNav");
    if (headerNav && localStorage.getItem("ttd_admin_return") === "1") {
      const returnBtn = document.createElement("button");
      returnBtn.type = "button";
      returnBtn.className = "headerAction";
      returnBtn.textContent = "← Admin";
      returnBtn.addEventListener("click", () => {
        try { localStorage.removeItem("ttd_admin_return"); } catch {}
        window.location.href = "/assets/admin/";
      });
      headerNav.insertBefore(returnBtn, headerNav.firstChild);
    }
  } catch {}

  ctx.loadGroups();
  if (state.currentRole === "admin") {
    ctx.loadTeacherRequests();
  }
}

init();
