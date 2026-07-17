import { escHtml, fetchJSON, toItems } from "../adminUtils.js";
import { computeRowActions } from "./unifiedStudentActions.js";

// Lista unificada "Alumnos del centro" (pestaña Alumnos, nivel superior) —
// sustituye a los tres bloques fragmentados que había antes (invitados /
// pendientes de aprobación / registrados), que podían mostrar a la misma
// persona dos veces. El estado de cada fila lo decide el backend
// (GET /admin/students/unified -> deriveUnifiedStudentList, ver
// server/lib/studentLifecycle.js); este módulo solo carga, filtra y pinta.
// La lógica de qué botones mostrar vive en unifiedStudentActions.js — este
// archivo se queda solo con carga + filtros + render (bajo 400 líneas).

const STATE_LABELS = {
  pendiente_aprobacion: "Pendiente de aprobación",
  invitado: "Invitado",
  activo: "Activo",
  archivado: "Archivado",
  rechazado: "Rechazado",
};

const STATE_BADGE_CLASS = {
  pendiente_aprobacion: "pending",
  invitado: "invitado",
  activo: "ok",
  archivado: "archivado",
  rechazado: "rechazado",
};

const STATUS_FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "pendiente_aprobacion", label: "Pendientes" },
  { key: "invitado", label: "Invitados" },
  { key: "activo", label: "Activos" },
  { key: "archivado", label: "Archivados" },
  { key: "rechazado", label: "Rechazados" },
];

function initialsOf(name, email) {
  const words = String(name || email || "?").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return words[0]?.slice(0, 2).toUpperCase() || "?";
}

function statusLabelOf(row) {
  if (row.state === "invitado" && row.meta?.invite_status === "expired") return "Invitación expirada";
  return STATE_LABELS[row.state] || row.state;
}

export function createUnifiedStudents({ pendingInviteUrls }) {
  let statusFilter = "todos";
  // "Todos" incluye archivados/rechazados solo cuando el admin lo elige de
  // forma explícita (clic en el chip) — la carga inicial de la sección usa
  // el mismo valor "todos" pero sin haber sido clicado todavía, así que no
  // los mezcla. Esto es lo que pide el diseño: "Archivados visible solo bajo
  // su propio filtro o 'Todos', no mezclados por defecto" — el "por
  // defecto" es la carga inicial, no el hecho de que el chip se llame Todos.
  let filterExplicitlyChosen = false;

  function counts(items) {
    const c = { todos: items.length };
    for (const key of Object.keys(STATE_LABELS)) c[key] = 0;
    for (const row of items) c[row.state] = (c[row.state] || 0) + 1;
    return c;
  }

  function populateGroupFilter(state) {
    const sel = document.getElementById("alumnosGroupFilter");
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">Todos los grupos</option>';
    (state.unifiedGroups || []).forEach((g) => {
      const opt = document.createElement("option");
      opt.value = g.id;
      opt.textContent = g.name;
      sel.appendChild(opt);
    });
    if (current) sel.value = current;
  }

  function renderFilterChips(items) {
    const el = document.getElementById("alumnosStatusFilters");
    if (!el) return;
    const c = counts(items);
    el.innerHTML = STATUS_FILTERS.map(
      (f) => `
      <button type="button" class="av-status-filter${f.key === statusFilter ? " active" : ""}" data-status-filter="${f.key}">
        ${escHtml(f.label)}<span class="n">${c[f.key] || 0}</span>
      </button>`
    ).join("");
  }

  function matchesFilters(row, q, groupId) {
    if (statusFilter === "todos") {
      const isTerminal = row.state === "archivado" || row.state === "rechazado";
      if (isTerminal && !filterExplicitlyChosen) return false;
    } else if (row.state !== statusFilter) {
      return false;
    }
    if (groupId && row.group_id !== groupId) return false;
    if (q) {
      const hay = `${row.name || ""} ${row.email || ""} ${row.group_name || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function renderRow(row) {
    const actions = computeRowActions(row, { hasCopyLink: row.invite_id ? pendingInviteUrls.has(row.invite_id) : false });
    const name = row.name || row.email || "(sin nombre)";
    const sub = [row.email || "sin email", row.group_name || "Sin grupo"].join(" · ");
    const buttons = [];
    if (actions.approve) buttons.push(`<button class="btn ghost small" data-unified-action="approve" data-unified-key="${escHtml(row.key)}" type="button">Aprobar</button>`);
    if (actions.reject) buttons.push(`<button class="btn ghost small" data-unified-action="reject" data-unified-key="${escHtml(row.key)}" type="button" style="color:var(--danger,#e55)">Rechazar</button>`);
    if (actions.resend) buttons.push(`<button class="btn ghost small" data-unified-action="resend" data-unified-key="${escHtml(row.key)}" type="button">Reenviar</button>`);
    if (actions.copyLink) buttons.push(`<button class="btn ghost small" data-unified-action="copyLink" data-unified-key="${escHtml(row.key)}" type="button">Copiar enlace</button>`);
    if (actions.revoke) buttons.push(`<button class="btn ghost small" data-unified-action="revoke" data-unified-key="${escHtml(row.key)}" type="button">Revocar</button>`);
    if (actions.archive) buttons.push(`<button class="btn ghost small" data-unified-action="archive" data-unified-key="${escHtml(row.key)}" type="button" style="color:var(--danger,#e55)">Archivar</button>`);
    if (actions.restore) buttons.push(`<button class="btn ghost small" data-unified-action="restore" data-unified-key="${escHtml(row.key)}" type="button">Restaurar</button>`);
    if (actions.delete) buttons.push(`<button class="btn ghost small" data-unified-action="delete" data-unified-key="${escHtml(row.key)}" type="button" style="color:var(--danger,#e55)">Eliminar</button>`);

    return `
      <div class="av-unified-row ${escHtml(row.state)}">
        <div class="av-avatar">${escHtml(initialsOf(row.name, row.email))}</div>
        <div>
          <div class="av-cell-name">${escHtml(name)}</div>
          <div class="av-cell-sub">${escHtml(sub)}</div>
        </div>
        <span class="av-status ${STATE_BADGE_CLASS[row.state] || ""}"><span class="dot"></span>${escHtml(statusLabelOf(row))}</span>
        <div class="av-unified-actions">${buttons.join("")}</div>
      </div>`;
  }

  function render(state) {
    const el = document.getElementById("alumnosList");
    if (!el) return;
    const items = state.unifiedStudents || [];
    renderFilterChips(items);

    const q = String(document.getElementById("alumnosSearch")?.value || "").toLowerCase().trim();
    const groupId = document.getElementById("alumnosGroupFilter")?.value || "";
    const filtered = items.filter((row) => matchesFilters(row, q, groupId));

    const el2 = document.getElementById("alumnosSubtitle");
    if (el2) el2.textContent = `${items.length} alumnos`;

    if (!filtered.length) {
      el.innerHTML = `<p class="emptyState">${
        statusFilter === "todos" ? "No hay alumnos que coincidan con la búsqueda." : `No hay alumnos en estado "${escHtml(STATUS_FILTERS.find((f) => f.key === statusFilter)?.label || statusFilter)}".`
      }</p>`;
      return;
    }
    el.innerHTML = filtered.map(renderRow).join("");
  }

  async function load(state) {
    const errEl = document.getElementById("alumnosError");
    if (errEl) errEl.textContent = "";
    try {
      const data = await fetchJSON("/api/v1/admin/students/unified");
      state.unifiedStudents = toItems(data, "items");
      state.unifiedGroups = data?.groups || [];
      populateGroupFilter(state);
      render(state);
    } catch (err) {
      if (errEl) errEl.textContent = err?.message || "No se pudieron cargar los alumnos.";
    }
  }

  function setStatusFilter(key, state) {
    statusFilter = key;
    filterExplicitlyChosen = true;
    render(state);
  }

  function findRow(state, key) {
    return (state.unifiedStudents || []).find((r) => r.key === key) || null;
  }

  return { load, render, setStatusFilter, findRow };
}
