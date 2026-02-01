import { createInitialState, loadData, saveData, refreshData, hasAccess, GROUP_KEY, STUDENT_ORDER_KEY } from "./js/state.js";
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
    saveData(state.data);
  },
  refreshData() {
    refreshData(state);
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
  },
  renderLoginView() {
    renderLoginView(appRoot, ctx);
  }
};

function init() {
  const savedTheme = getSavedTheme();
  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    applyTheme(getSystemTheme() || "dark");
  }

  state.data = loadData();
  state.currentGroupId = localStorage.getItem(GROUP_KEY) || state.data.groups[0]?.id;
  state.studentOrder = localStorage.getItem(STUDENT_ORDER_KEY) || "status";

  if (hasAccess()) {
    ctx.renderDashboard();
  } else {
    ctx.renderLoginView();
  }
}

init();
