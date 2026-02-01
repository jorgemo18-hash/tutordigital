import { createInitialState, loadData, saveData, refreshData, hasAccess, getTenantId, getGroupKey, getStudentOrderKey, loadTenantCfg, loadTeacherSession, saveTeacherSession, migrateTeacherScopedData } from "./js/state.js";
import { getSystemTheme, getSavedTheme, applyTheme } from "./js/theme.js";
import { cacheDashboardElements, cacheLoginElements, renderGroups } from "./js/dom.js";
import { renderLoginView, renderDashboard } from "./js/templates.js";
import { renderStudents } from "./js/students.js";
import { renderPlanner, renderTaskDetailAttachments } from "./js/tasks.js";
import { renderTickets } from "./js/tickets.js";
import { renderNotebook } from "./js/notebook.js";
import { bindDashboardEvents, bindLoginEvents, closeTaskModal, closeStudentModal } from "./js/modals.js";

const appRoot = document.getElementById("teacherApp");
const state = createInitialState();
let elements = {};
let tenantCfg = null;

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
  renderAll() {
    renderGroups(ctx);
    renderStudents(ctx);
    renderPlanner(ctx);
    renderTickets(ctx);
    renderNotebook(ctx);
  },
  renderStudents() {
    renderStudents(ctx);
  },
  renderTickets() {
    renderTickets(ctx);
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
  closeStudentModal() {
    closeStudentModal(ctx);
  },
  bindDashboardEvents() {
    bindDashboardEvents(ctx);
  },
  bindLoginEvents() {
    bindLoginEvents(ctx);
  },
  renderDashboard() {
    renderDashboard(appRoot, ctx);
    updateTenantUI();
    updateTeacherSelect();
  },
  renderLoginView() {
    renderLoginView(appRoot, ctx);
  },
  updateTenantUI() {
    updateTenantUI();
  }
};

function applyTenantBranding(cfg) {
  if (!cfg) return;
  if (cfg.bgImage) {
    document.documentElement.style.setProperty("--bg-photo", `url("${cfg.bgImage}")`);
  }
}

function updateTenantUI() {
  if (!elements || !elements.tenantName || !elements.tenantPill) return;
  elements.tenantName.textContent = tenantCfg?.name || "Centro";
  const teacherName = state.currentTeacherName || state.currentTeacherId || "Profe";
  elements.tenantPill.textContent = `Centro: ${tenantCfg?.name || "Centro"} · Profe: ${teacherName}`;
}

function updateTeacherSelect() {
  if (!elements.teacherSelect) return;
  const teachers = state.data.teachers || [
    { id: "p1", name: "Profe A" },
    { id: "p2", name: "Profe B" }
  ];
  elements.teacherSelect.innerHTML = "";
  teachers.forEach(teacher => {
    const option = document.createElement("option");
    option.value = teacher.id;
    option.textContent = teacher.name || teacher.id;
    elements.teacherSelect.appendChild(option);
  });
  elements.teacherSelect.value = state.currentTeacherId || teachers[0]?.id || "p1";
}

function ensureCurrentGroup() {
  const groups = state.data.groups.filter(group => group.tenantId === state.tenantId);
  if (!groups.length) {
    state.currentGroupId = null;
    return;
  }
  if (!groups.some(group => group.id === state.currentGroupId)) {
    state.currentGroupId = groups[0].id;
  }
}

function init() {
  state.tenantId = getTenantId();
  tenantCfg = loadTenantCfg(state.tenantId);
  applyTenantBranding(tenantCfg);

  const savedTheme = getSavedTheme(state.tenantId);
  if (savedTheme) {
    applyTheme(savedTheme, state.tenantId);
  } else {
    applyTheme(getSystemTheme() || "dark", state.tenantId);
  }

  const teacherSession = loadTeacherSession(state.tenantId);
  state.currentTeacherId = teacherSession?.teacherId || "p1";
  state.currentTeacherName = teacherSession?.teacherName || "Profe A";
  if (!teacherSession) {
    saveTeacherSession(state.tenantId, {
      teacherId: state.currentTeacherId,
      teacherName: state.currentTeacherName
    });
  }

  state.data = loadData(state.tenantId, state.currentTeacherId);
  if (migrateTeacherScopedData(state.data, state.currentTeacherId)) {
    saveData(state.tenantId, state.data);
  }

  state.currentGroupId = localStorage.getItem(getGroupKey(state.tenantId)) || state.data.groups[0]?.id;
  state.studentOrder = localStorage.getItem(getStudentOrderKey(state.tenantId)) || "status";
  ensureCurrentGroup();

  if (hasAccess(state.tenantId)) {
    ctx.renderDashboard();
  } else {
    ctx.renderLoginView();
  }
}

init();
