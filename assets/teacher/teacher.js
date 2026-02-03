import { createInitialState, loadData, saveData, refreshData, getTenantId, getStudentOrderKey, loadTenantCfg, loadTeacherSession, saveTeacherSession, migrateTeacherScopedData } from "./js/state.js";
import { getSystemTheme, getSavedTheme, applyTheme } from "./js/theme.js";
import { cacheDashboardElements, cacheLoginElements, renderGroups } from "./js/dom.js";
import { renderLoginView, renderDashboard } from "./js/templates.js";
import { renderStudents } from "./js/students.js";
import { renderPlanner, renderTaskDetailAttachments } from "./js/tasks.js";
import { renderTickets } from "./js/tickets.js";
import { renderNotebook } from "./js/notebook.js";
import { bindDashboardEvents, bindLoginEvents, closeTaskModal, closeStudentModal } from "./js/modals.js";
import { apiFetch, clearSession, getTenantSlug } from "../shared/js/auth.js";
import { requireSessionOrRedirect } from "../shared/js/guard.js";
import { getActiveGroupId, setActiveGroupId } from "../shared/js/groupState.js";

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
  loadStudentsForActiveGroup() {
    loadStudentsForActiveGroup();
  },
  setActiveGroup(groupId) {
    setActiveGroup(groupId, state.data?.groups || []);
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

function getTenant() {
  return getTenantSlug() || "";
}

function formatRequestId(body) {
  return body?.requestId || body?.request_id || "";
}

function applyActiveGroupStyles(listEl, activeId) {
  if (!listEl) return;
  listEl.querySelectorAll("[data-group-id]").forEach((node) => {
    node.classList.toggle("is-active", node.dataset.groupId === activeId);
  });
}

function renderGroupSelects(items = []) {
  if (!elements.groupSelect) return;
  const select = elements.groupSelect;
  select.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Selecciona grupo";
  select.appendChild(placeholder);
  items.forEach((group) => {
    const opt = document.createElement("option");
    opt.value = group.id;
    opt.textContent = group.name || "Grupo";
    select.appendChild(opt);
  });
  const activeId = getActiveGroupId(getTenant());
  if (activeId) {
    select.value = activeId;
  } else {
    select.value = "";
  }
  if (elements.taskGroup) {
    elements.taskGroup.innerHTML = "";
    items.forEach((group) => {
      const opt = document.createElement("option");
      opt.value = group.id;
      opt.textContent = group.name || "Grupo";
      elements.taskGroup.appendChild(opt);
    });
    if (activeId) elements.taskGroup.value = activeId;
  }
}

function setActiveGroup(groupId, groups = []) {
  const tenant = getTenant();
  if (!tenant || !groupId) return;
  setActiveGroupId(tenant, groupId);
  applyActiveGroupStyles(document.getElementById("groupsList"), groupId);
  if (elements.groupSelect) elements.groupSelect.value = groupId;
  if (elements.taskGroup) elements.taskGroup.value = groupId;
  if (elements.studentGroupLabel) {
    const g = groups.find((item) => item.id === groupId);
    elements.studentGroupLabel.textContent = g?.name || "Grupo";
  }
  loadStudentsForActiveGroup();
}

function renderGroupsList(el, items = []) {
  if (!el) return;
  if (!items.length) {
    el.textContent = "No hay grupos todavía.";
    return;
  }
  el.innerHTML = "";
  const list = document.createElement("ul");
  list.className = "ticketList";
  items.forEach((group) => {
    const li = document.createElement("li");
    li.dataset.groupId = group?.id || "";
    li.setAttribute("role", "button");
    li.tabIndex = 0;
    const name = String(group?.name || "Grupo");
    const level = group?.level ? ` · ${group.level}` : "";
    let created = "";
    if (group?.created_at) {
      const d = new Date(group.created_at);
      if (!Number.isNaN(d.getTime())) {
        created = ` · ${d.toLocaleDateString("es-ES")}`;
      }
    }
    li.textContent = `${name}${level}${created}`;
    li.addEventListener("click", () => {
      if (!group?.id) return;
      setActiveGroup(group.id, items);
    });
    li.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        li.click();
      }
    });
    list.appendChild(li);
  });
  el.appendChild(list);
  const saved = getActiveGroupId(getTenant());
  if (saved) applyActiveGroupStyles(el, saved);
}

async function loadGroups() {
  const listEl = document.getElementById("groupsList");
  if (!listEl) return;
  listEl.textContent = "Cargando…";
  const res = await apiFetch("/api/v1/groups?limit=50&offset=0");
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 || body?.error?.code === "unauthorized") {
      clearSession();
      window.location.href = "/index.html";
      return;
    }
    if (res.status === 429) {
      const rid = formatRequestId(body) ? ` (ref: ${formatRequestId(body)})` : "";
      listEl.textContent = `Demasiadas peticiones. Prueba en unos segundos.${rid}`;
      return;
    }
    const rid = formatRequestId(body) ? ` (ref: ${formatRequestId(body)})` : "";
    listEl.textContent = `Error cargando grupos${rid}`;
    return;
  }
  const items = body?.data?.items || [];
  const mapped = items.map((group) => ({
    id: group.id,
    name: group.name,
    level: group.level || null,
    tenantId: state.tenantId,
    createdAt: group.created_at || null,
  }));
  state.data.groups = mapped;
  renderGroupSelects(mapped);
  renderGroupsList(listEl, mapped);
  const tenant = getTenant();
  const saved = getActiveGroupId(tenant);
  if (!saved && mapped.length > 0) {
    setActiveGroupId(tenant, mapped[0].id);
  }
  const activeId = getActiveGroupId(tenant);
  if (activeId && mapped.some((g) => g?.id === activeId)) {
    if (elements.studentGroupLabel) {
      const g = mapped.find((item) => item.id === activeId);
      elements.studentGroupLabel.textContent = g?.name || "Grupo";
    }
    applyActiveGroupStyles(listEl, activeId);
    if (elements.groupSelect) elements.groupSelect.value = activeId;
    if (elements.taskGroup) elements.taskGroup.value = activeId;
    loadStudentsForActiveGroup();
  }
}

async function createGroup() {
  const nameInput = document.getElementById("groupNameInput");
  const levelInput = document.getElementById("groupLevelInput");
  const errorEl = document.getElementById("createGroupError");
  const name = String(nameInput?.value || "").trim();
  const level = String(levelInput?.value || "").trim();
  if (errorEl) errorEl.textContent = "";
  if (!name) {
    if (errorEl) errorEl.textContent = "Indica un nombre de grupo.";
    nameInput?.focus();
    return;
  }
  const payload = level ? { name, level } : { name };
  const res = await apiFetch("/api/v1/groups", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 || body?.error?.code === "unauthorized") {
      clearSession();
      window.location.href = "/index.html";
      return;
    }
    const rid = formatRequestId(body) ? ` (ref: ${formatRequestId(body)})` : "";
    if (errorEl) errorEl.textContent = `Error creando grupo${rid}`;
    return;
  }
  if (nameInput) nameInput.value = "";
  if (levelInput) levelInput.value = "";
  if (errorEl) errorEl.textContent = "";
  await loadGroups();
}

function normalizeStudentStatus(raw) {
  const value = String(raw || "").toLowerCase().trim();
  if (!value) return "pending";
  if (["needs_teacher", "needs-professor", "necesita_profesor"].includes(value)) return "needs_teacher";
  if (["pending", "pendiente"].includes(value)) return "pending";
  if (["ok", "done", "submitted"].includes(value)) return "submitted";
  return "pending";
}

function mapStudentFromApi(item) {
  const display = String(item?.display_name || item?.name || "").trim();
  return {
    id: item?.id,
    name: display,
    groupId: item?.group_id || item?.groupId || "",
    status: normalizeStudentStatus(item?.status),
    tenantId: state.tenantId,
  };
}

async function loadStudentsForActiveGroup() {
  const groupId = getActiveGroupId(getTenant());
  if (!groupId) {
    if (elements.studentList) elements.studentList.innerHTML = "";
    if (elements.studentEmpty) {
      elements.studentEmpty.textContent = "Selecciona un grupo.";
      elements.studentEmpty.style.display = "block";
    }
    return;
  }
  if (elements.studentEmpty) {
    elements.studentEmpty.textContent = "Cargando…";
    elements.studentEmpty.style.display = "block";
  }
  const res = await apiFetch(
    `/api/v1/students?group_id=${encodeURIComponent(groupId)}&limit=200&offset=0`
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 || body?.error?.code === "unauthorized") {
      clearSession();
      window.location.href = "/index.html";
      return;
    }
    const rid = formatRequestId(body) ? ` (ref: ${formatRequestId(body)})` : "";
    if (elements.studentEmpty) {
      const msg =
        res.status === 429
          ? `Demasiadas peticiones${rid}`
          : `Error cargando alumnos${rid}`;
      elements.studentEmpty.textContent = msg;
      elements.studentEmpty.style.display = "block";
    }
    return;
  }
  const items = body?.data?.items || [];
  state.currentGroupId = groupId;
  if (elements.studentEmpty) {
    elements.studentEmpty.textContent = "No hay alumnos en este grupo.";
  }
  state.data.students = items.map(mapStudentFromApi);
  renderStudents(ctx);
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
  overlay.innerHTML = `
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
  `;
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
  if (!state.tenantId) {
    window.location.replace("/");
    return;
  }
  try { localStorage.setItem("ttd_activeTenantSlug", state.tenantId); } catch {}

  const homeLink = document.getElementById("homeLink");
  if (homeLink) {
    homeLink.href = `/index.html`;
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

  state.currentGroupId = getActiveGroupId(getTenant()) || state.data.groups[0]?.id;
  state.studentOrder = localStorage.getItem(getStudentOrderKey(state.tenantId)) || "status";
  ensureCurrentGroup();

  ctx.renderDashboard();
  const createBtn = document.getElementById("createGroupBtn");
  const nameInput = document.getElementById("groupNameInput");
  createBtn?.addEventListener("click", createGroup);
  nameInput?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      createGroup();
    }
  });
  loadGroups();
  if (!state.activeUser || state.activeUser.role !== "teacher") {
    showTeacherSignupModal();
  }
}

init();
