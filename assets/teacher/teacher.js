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
  if (!elements) return;
  if (elements.tenantName) {
    elements.tenantName.textContent = tenantCfg?.name || "Centro";
  }
  if (elements.tenantPill) {
    const teacherName = state.currentTeacherName || state.currentTeacherId || "Profe";
    const groupName = state.data?.groups?.find(group => group.id === state.currentGroupId)?.name || "";
    const groupText = groupName ? ` · Grupo: ${groupName}` : "";
    elements.tenantPill.textContent = `Centro: ${tenantCfg?.name || "Centro"} · Rol: Docente · Profe: ${teacherName}${groupText}`;
  }
  if (elements.tenantLoginName) {
    elements.tenantLoginName.textContent = `Centro: ${tenantCfg?.name || "Centro"}`;
  }
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
  elements.teacherSelect.disabled = Boolean(state.activeUser?.role === "teacher");
}

function ensureCurrentGroup() {
  const allowedGroupIds = state.activeUser?.groupIds?.length ? new Set(state.activeUser.groupIds) : null;
  const groups = state.data.groups.filter(group => {
    if (group.tenantId !== state.tenantId) return false;
    if (allowedGroupIds && !allowedGroupIds.has(group.id)) return false;
    return true;
  });
  if (!groups.length) {
    state.currentGroupId = null;
    return;
  }
  if (!groups.some(group => group.id === state.currentGroupId)) {
    state.currentGroupId = groups[0].id;
  }
}

function getActiveUserKey() {
  return `ttd_activeUser_${state.tenantId}`;
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

function showTeacherSignupModal() {
  const overlay = document.createElement("div");
  overlay.className = "modalOverlay open";
  overlay.id = "teacherSignupModal";
  overlay.innerHTML = 
    <div class="modalCard">
      <div class="modalHeader">
        <h2>Alta docente</h2>
        <button class="iconBtn" data-close="teacherSignupModal" type="button" aria-label="Cerrar">✕</button>
      </div>
      <div class="formGrid">
        <label class="formField">
          <span>Nombre</span>
          <input id="teacherSignupName" type="text" placeholder="Nombre y apellidos">
        </label>
        <label class="formField">
          <span>Código docente</span>
          <input id="teacherSignupCode" type="text" placeholder="LYCEO-T1">
        </label>
      </div>
      <div class="modalActions">
        <button class="btn primary" id="teacherSignupSave" type="button">Entrar</button>
      </div>
      <p class="hint">Ejemplo: LYCEO-T1 / LYCEO-T2 / INST2-T1</p>
    </div>
  ;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener("click", (ev) => {
    if (ev.target === overlay) close();
  });
  overlay.querySelectorAll("[data-close]").forEach(btn => btn.addEventListener("click", close));

  const nameInput = overlay.querySelector("#teacherSignupName");
  const codeInput = overlay.querySelector("#teacherSignupCode");
  const saveBtn = overlay.querySelector("#teacherSignupSave");

  const resolveFromCode = (code) => {
    const v = String(code || "").trim().toUpperCase();
    const map = {
      lyceo: {
        "LYCEO-T1": { teacherId: "t1", groupNames: ["1º ESO A", "2º ESO C"] },
        "LYCEO-T2": { teacherId: "t2", groupNames: ["1º ESO B"] }
      },
      instituto2: {
        "INST2-T1": { teacherId: "t1", groupNames: ["1º ESO A"] }
      }
    };
    return map[state.tenantId]?.[v] || null;
  };

  saveBtn.addEventListener("click", () => {
    const displayName = String(nameInput.value || "").trim();
    const code = String(codeInput.value || "").trim();
    const resolved = resolveFromCode(code);
    if (!displayName || !resolved) {
      codeInput.focus();
      return;
    }
    const groupIds = state.data.groups
      .filter(group => group.tenantId === state.tenantId && resolved.groupNames.includes(group.name))
      .map(group => group.id);
    const user = {
      userId: `u_${Date.now()}`,
      role: "teacher",
      displayName,
      teacherId: resolved.teacherId,
      groupIds
    };
    saveActiveUser(user);
    state.activeUser = user;
    state.currentTeacherId = user.teacherId;
    state.currentTeacherName = user.displayName;
    ensureCurrentGroup();
    ctx.renderAll();
    updateTenantUI();
    updateTeacherSelect();
    close();
  });

  nameInput?.focus();
}

function init() {
  state.tenantId = getTenantId();
  const urlTenant = new URLSearchParams(window.location.search).get("tenant");
  if (!state.tenantId) {
    window.location.replace("/");
    return;
  }
  if (!urlTenant) {
    window.location.replace(`/assets/teacher/index.html?tenant=${encodeURIComponent(state.tenantId)}`);
    return;
  }
  try { localStorage.setItem("ttd_activeTenant", state.tenantId); } catch {}

  const homeLink = document.getElementById("homeLink");
  if (homeLink) {
    homeLink.href = `/index.html?tenant=${encodeURIComponent(state.tenantId)}`;
  }

  const tenantAccessKey = `ttd_tenantAccess_${state.tenantId}`;
  if (localStorage.getItem(tenantAccessKey) !== "ok") {
    window.location.replace(`/?tenant=${encodeURIComponent(state.tenantId)}`);
    return;
  }

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

  state.activeUser = loadActiveUser();
  if (state.activeUser?.role === "teacher") {
    state.currentTeacherId = state.activeUser.teacherId || state.currentTeacherId;
    state.currentTeacherName = state.activeUser.displayName || state.currentTeacherName;
  }

  state.currentGroupId = localStorage.getItem(getGroupKey(state.tenantId)) || state.data.groups[0]?.id;
  state.studentOrder = localStorage.getItem(getStudentOrderKey(state.tenantId)) || "status";
  ensureCurrentGroup();

  ctx.renderDashboard();
  if (!state.activeUser || state.activeUser.role !== "teacher") {
    showTeacherSignupModal();
  }
}

init();
