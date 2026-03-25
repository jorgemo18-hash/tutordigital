import { apiFetch, clearSession } from "../../../shared/js/auth.js";
import { clearActiveGroupId, getActiveGroupId, setActiveGroupId } from "../../../shared/js/groupState.js";
import { formatRequestId } from "../api/teacherApiHelpers.js";
import { getTenant } from "../bootstrap/teacherBootstrap.js";

export function applyActiveGroupStyles(listEl, activeId) {
  if (!listEl) return;
  listEl.querySelectorAll("[data-group-id]").forEach((node) => {
    node.classList.toggle("is-active", node.dataset.groupId === activeId);
  });
}

export function renderGroupSelects(elements, items = []) {
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

export function renderGroupsList(listEl, items = [], onSelectGroup = () => {}) {
  if (!listEl) return;
  if (!items.length) {
    listEl.textContent = "No hay grupos todavía.";
    return;
  }
  listEl.innerHTML = "";
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
      onSelectGroup(group.id);
    });
    li.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        li.click();
      }
    });
    list.appendChild(li);
  });
  listEl.appendChild(list);
  const saved = getActiveGroupId(getTenant());
  if (saved) applyActiveGroupStyles(listEl, saved);
}

export function setActiveGroup({
  groupId,
  groups = [],
  elements,
  tenant,
  state,
  onGroupChange,
}) {
  if (!tenant || !groupId) return;
  setActiveGroupId(tenant, groupId);
  const _listEl = document.getElementById("groupsList");
  if (_listEl) applyActiveGroupStyles(_listEl, groupId);
  if (elements.groupSelect) elements.groupSelect.value = groupId;
  if (elements.taskGroup) elements.taskGroup.value = groupId;
  if (elements.studentGroupLabel) {
    const g = groups.find((item) => item.id === groupId);
    elements.studentGroupLabel.textContent = g?.name || "Grupo";
  }
  state.currentGroupId = groupId;
  onGroupChange?.loadTasksForActiveGroup?.();
  onGroupChange?.loadStudentsForActiveGroup?.();
  onGroupChange?.loadTicketsForActiveGroup?.();
}

export async function loadGroups(ctx) {
  const { state, elements } = ctx;
  if (!elements.groupSelect) return;
  const listEl = document.getElementById("groupsList");
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
      if (listEl) listEl.textContent = `Demasiadas peticiones. Prueba en unos segundos.${rid}`;
      return;
    }
    const rid = formatRequestId(body) ? ` (ref: ${formatRequestId(body)})` : "";
    if (listEl) listEl.textContent = `Error cargando grupos${rid}`;
    return;
  }
  const items = body?.data?.items || [];
  const mapped = items.map((group) => ({
    id: group.id,
    name: group.name,
    level: group.level || null,
    tenantId: state.tenantId,
    createdAt: group.created_at || null,
    created_at: group.created_at || null,
  }));
  state.data.groups = mapped;
  renderGroupSelects(elements, mapped);
  if (listEl) {
    renderGroupsList(listEl, mapped, (groupId) => {
      setActiveGroup({
        groupId,
        groups: mapped,
        elements,
        tenant: getTenant(),
        state,
        onGroupChange: {
          loadTasksForActiveGroup: () => ctx.loadTasksForActiveGroup(),
          loadStudentsForActiveGroup: () => ctx.loadStudentsForActiveGroup(),
          loadTicketsForActiveGroup: () => ctx.loadTicketsForActiveGroup(),
        },
      });
    });
  }

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
    if (listEl) applyActiveGroupStyles(listEl, activeId);
    if (elements.groupSelect) elements.groupSelect.value = activeId;
    if (elements.taskGroup) elements.taskGroup.value = activeId;
    state.currentGroupId = activeId;
    ctx.loadTasksForActiveGroup();
    ctx.loadStudentsForActiveGroup();
    ctx.loadTicketsForActiveGroup();
    return;
  }

  if (saved && !mapped.some((g) => g?.id === saved)) {
    clearActiveGroupId(tenant);
  }
}
