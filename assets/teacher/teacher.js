import { createInitialState, loadData, saveData, refreshData, getTenantId, getStudentOrderKey, loadTenantCfg, loadTeacherSession, saveTeacherSession, migrateTeacherScopedData } from "./js/state.js";
import { getSystemTheme, getSavedTheme, applyTheme } from "./js/theme.js";
import { cacheDashboardElements, cacheLoginElements, renderGroups } from "./js/dom.js";
import { renderLoginView, renderDashboard } from "./js/templates.js";
import { renderStudents } from "./js/students.js";
import { renderPlanner, renderTaskDetailAttachments, mapTaskFromApi } from "./js/tasks.js";
import { renderTickets } from "./js/tickets.js";
import { renderNotebook, termKeyFromMonthKey } from "./js/notebook.js";
import { bindDashboardEvents, bindLoginEvents, closeTaskModal, closeStudentModal } from "./js/modals.js";
import { apiFetch, clearSession, getTenantSlug } from "../shared/js/auth.js";
import { requireSessionOrRedirect } from "../shared/js/guard.js";
import { clearActiveGroupId, getActiveGroupId, setActiveGroupId } from "../shared/js/groupState.js";

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
    refreshNotebookForActiveGroup();
  },
  renderStudents() {
    renderStudents(ctx);
  },
  refreshNotebookForActiveGroup() {
    refreshNotebookForActiveGroup();
  },
  loadStudentsForActiveGroup() {
    loadStudentsForActiveGroup();
  },
  loadTasksForActiveGroup() {
    loadTasksForActiveGroup();
  },
  loadGroups() {
    loadGroups();
  },
  loadTeacherRequests() {
    loadTeacherRequests();
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
    setAdminPanelVisible(state.currentRole === "admin");
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
    const roleLabel = state.currentRole === "admin" ? "Admin" : "Docente";
    elements.tenantPill.textContent = `Centro: ${tenantCfg?.name || "Centro"} · Rol: ${roleLabel} · Profe: ${teacherName}${groupText}`;
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
  elements.teacherSelect.disabled = state.currentRole === "teacher";
}

function getTenant() {
  return getTenantSlug() || "";
}

function formatRequestId(body) {
  return body?.requestId || body?.request_id || "";
}

function formatYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isYMD(value = "") {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function isUuid(value = "") {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
}

function getTaskRangeParams(range = "today") {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  let end = new Date(start);
  if (range === "tomorrow") {
    start.setDate(start.getDate() + 1);
    end = new Date(start);
  } else if (range === "week") {
    end.setDate(end.getDate() + 6);
  }
  return {
    from: formatYMD(start),
    to: formatYMD(end),
  };
}

function getNotebookRangeParams() {
  const now = new Date();
  if (!state.notebookMonth) {
    state.notebookMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  if (!state.notebookTerm) {
    state.notebookTerm = termKeyFromMonthKey(state.notebookMonth);
  }

  const mode = state.notebookMode || "month";
  const [yearStr, monthStr] = state.notebookMonth.split("-");
  const year = Number(yearStr) || now.getFullYear();
  const month = Number(monthStr) || now.getMonth() + 1;

  if (mode === "month") {
    const fromDate = new Date(year, month - 1, 1);
    const toDate = new Date(year, month, 0);
    const from = formatYMD(fromDate);
    const to = formatYMD(toDate);
    return { from, to };
  }

  let startMonth = 9;
  let endMonth = 12;
  if (state.notebookTerm === "t2") {
    startMonth = 1;
    endMonth = 3;
  } else if (state.notebookTerm === "t3") {
    startMonth = 4;
    endMonth = 6;
  }
  const fromDate = new Date(year, startMonth - 1, 1);
  const toDate = new Date(year, endMonth, 0);
  const from = formatYMD(fromDate);
  const to = formatYMD(toDate);
  return { from, to };
}

async function loadCurrentMembership() {
  const res = await apiFetch("/api/v1/me");
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    clearSession();
    window.location.href = "/index.html";
    return null;
  }
  const memberships = body?.data?.memberships || [];
  const tenantSlug = getTenant();
  const membership = memberships.find((m) => m?.tenant?.slug === tenantSlug) || null;
  if (!membership) {
    window.location.href = "/index.html";
    return null;
  }
  if (membership.role === "student") {
    window.location.href = "/assets/student/index.html";
    return null;
  }
  state.currentRole = membership.role || "teacher";
  setAdminPanelVisible(state.currentRole === "admin");
  return membership;
}

function setAdminPanelVisible(visible) {
  if (!elements.teacherAdminPanel) return;
  elements.teacherAdminPanel.style.display = visible ? "" : "none";
}

function renderTeacherRequests(items = [], view = "pending") {
  const listEl = elements.teacherRequestsList;
  const emptyEl = elements.teacherRequestsEmpty;
  if (!listEl || !emptyEl) return;
  listEl.innerHTML = "";
  if (!items.length) {
    emptyEl.textContent = view === "approved" ? "Sin profesores activos." : "Sin solicitudes.";
    emptyEl.style.display = "block";
    return;
  }
  emptyEl.style.display = "none";
  const list = document.createElement("ul");
  list.className = "ticketList";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.dataset.requestId = item.id;
    const email = item.email || item.requested_by || "Usuario";
    const baseDate = view === "approved" ? item.decided_at : item.created_at;
    const date = baseDate ? new Date(baseDate).toLocaleDateString("es-ES") : "";
    const statusText = view === "approved" ? "Aprobado" : "Pendiente";
    li.innerHTML = `
      <div class="ticketMeta">
        <div class="ticketTitle">${email}</div>
        <div class="ticketHint">${statusText}${date ? ` · ${date}` : ""}</div>
      </div>
      ${
        view === "pending"
          ? `<div class="ticketActions">
               <button class="btn ghost" data-teacher-action="approve">Aprobar</button>
               <button class="btn ghost" data-teacher-action="reject">Rechazar</button>
             </div>`
          : ""
      }
    `;
    list.appendChild(li);
  });
  listEl.appendChild(list);
}

async function loadTeacherRequests() {
  if (state.currentRole !== "admin") return;
  if (!elements.teacherRequestsList) return;
  if (elements.teacherRequestsError) elements.teacherRequestsError.textContent = "";
  elements.teacherRequestsList.textContent = "Cargando…";
  const view = state.teacherRequestView || "pending";
  const res = await apiFetch(`/api/v1/teacher/requests?status=${encodeURIComponent(view)}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 || body?.error?.code === "unauthorized") {
      clearSession();
      window.location.href = "/index.html";
      return;
    }
    const rid = formatRequestId(body) ? ` (ref: ${formatRequestId(body)})` : "";
    if (elements.teacherRequestsError) {
      elements.teacherRequestsError.textContent = `Error cargando solicitudes${rid}`;
    }
    elements.teacherRequestsList.innerHTML = "";
    if (elements.teacherRequestsEmpty) elements.teacherRequestsEmpty.style.display = "none";
    return;
  }
  const items = body?.data?.items || [];
  renderTeacherRequests(items, view);
}

let notebookInflight = null;
const DEBUG_NOTEBOOK = Boolean(window.RUNTIME_CONFIG?.DEBUG_NOTEBOOK);
function refreshNotebookForActiveGroup() {
  if (notebookInflight) return notebookInflight;
  notebookInflight = (async () => {
    const tenant = getTenant();
    let groupId = getActiveGroupId(tenant);
    if (groupId && !isUuid(groupId)) {
      clearActiveGroupId(tenant);
      const fallback = (state.data?.groups || []).find((g) => isUuid(g?.id))?.id || "";
      if (fallback) {
        setActiveGroupId(tenant, fallback);
        groupId = fallback;
      } else {
        groupId = "";
      }
    }
    if (!groupId) {
      if (elements.notebookGrid) elements.notebookGrid.innerHTML = "";
      if (elements.notebookEmpty) {
        elements.notebookEmpty.textContent = "Selecciona un grupo.";
        elements.notebookEmpty.style.display = "block";
      }
      return;
    }
    const range = getNotebookRangeParams();
    if (DEBUG_NOTEBOOK) {
      console.log("[NOTEBOOK_SUMMARY] range raw =", range, {
        fromType: typeof range?.from,
        toType: typeof range?.to,
        fromIsArray: Array.isArray(range?.from),
        toIsArray: Array.isArray(range?.to),
      });
    }
    if (!isYMD(String(range.from)) || !isYMD(String(range.to))) {
      console.warn("[notebook/summary] invalid date range", range);
      if (elements.notebookEmpty) {
        elements.notebookEmpty.textContent = "Rango de fechas inválido.";
        elements.notebookEmpty.style.display = "block";
      }
      return;
    }
    const url =
      `/api/v1/notebook/summary?group_id=${encodeURIComponent(groupId)}&from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
    if (DEBUG_NOTEBOOK) console.log("[NOTEBOOK_SUMMARY] url=", url);
    const res = await apiFetch(url);
    if (DEBUG_NOTEBOOK) console.log("[NOTEBOOK_SUMMARY] status=", res.status);
    if (!res.ok) {
      const errorText = await res.clone().text();
      if (DEBUG_NOTEBOOK) console.log("[NOTEBOOK_SUMMARY] error=", errorText);
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 || body?.error?.code === "unauthorized") {
        clearSession();
        window.location.href = "/index.html";
        return;
      }
      state.data.notebookSummary = null;
      if (elements.notebookEmpty) {
        const rid = formatRequestId(body) ? ` (ref: ${formatRequestId(body)})` : "";
        elements.notebookEmpty.textContent = `Error cargando cuaderno${rid}`;
        elements.notebookEmpty.style.display = "block";
      }
      return;
    }
    state.data.notebookSummary = body?.data || null;
    state.currentGroupId = groupId;
    renderNotebook(ctx);
  })().finally(() => {
    notebookInflight = null;
  });
  return notebookInflight;
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
  loadTasksForActiveGroup();
  loadStudentsForActiveGroup();
  loadTicketsForActiveGroup();
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
    loadTasksForActiveGroup();
    loadStudentsForActiveGroup();
    loadTicketsForActiveGroup();
  }
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
    approval_status: item?.approval_status || "approved",
    tenantId: state.tenantId,
  };
}

function mapTicketFromApi(item) {
  if (!item) return item;
  return {
    id: item.id,
    title: item.title,
    detail: item.detail || "",
    status: item.status,
    studentId: item.student_id || null,
    groupId: item.group_id || null,
    teacherId: item.teacher_id || null,
    createdAt: item.created_at || null,
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
    await refreshNotebookForActiveGroup();
    return;
  }
  if (elements.studentEmpty) {
    elements.studentEmpty.textContent = "Cargando…";
    elements.studentEmpty.style.display = "block";
  }
  const approval = state.studentApprovalView || "pending";
  const res = await apiFetch(
    `/api/v1/students?group_id=${encodeURIComponent(groupId)}&approval_status=${encodeURIComponent(approval)}&limit=200&offset=0`
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
  await refreshNotebookForActiveGroup();
}

async function loadTicketsForActiveGroup() {
  const groupId = getActiveGroupId(getTenant());
  if (!groupId) {
    state.data.tickets = [];
    renderTickets(ctx);
    return;
  }

  const res = await apiFetch(
    `/api/v1/tickets?status=open&groupId=${encodeURIComponent(groupId)}&limit=200&offset=0`
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 || body?.error?.code === "unauthorized") {
      clearSession();
      window.location.href = "/index.html";
      return;
    }
    state.data.tickets = [];
    renderTickets(ctx);
    return;
  }

  const items = body?.data?.items || [];
  state.data.tickets = items.map(mapTicketFromApi);
  renderTickets(ctx);
}

async function loadTasksForActiveGroup() {
  const groupId = getActiveGroupId(getTenant());
  if (!groupId) {
    state.data.tasks = [];
    renderPlanner(ctx);
    await refreshNotebookForActiveGroup();
    return;
  }

  const range = getTaskRangeParams(state.range);
  const res = await apiFetch(
    `/api/v1/tasks?group_id=${encodeURIComponent(groupId)}&from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}&limit=200&offset=0`
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 || body?.error?.code === "unauthorized") {
      clearSession();
      window.location.href = "/index.html";
      return;
    }
    state.data.tasks = [];
    renderPlanner(ctx);
    await refreshNotebookForActiveGroup();
    return;
  }

  const items = body?.data?.items || [];
  state.data.tasks = items.map((item) =>
    mapTaskFromApi(item, state.tenantId, state.currentTeacherId)
  );
  renderPlanner(ctx);
  await refreshNotebookForActiveGroup();
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


async function init() {
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

  state.currentGroupId = getActiveGroupId(getTenant()) || state.data.groups[0]?.id;
  state.studentOrder = localStorage.getItem(getStudentOrderKey(state.tenantId)) || "status";
  ensureCurrentGroup();

  ctx.renderDashboard();
  loadGroups();
  if (state.currentRole === "admin") {
    loadTeacherRequests();
  }
}

init();
