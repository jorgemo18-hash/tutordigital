// task-picker-drawer.js — Drawer de selección de tarea para notas en masa.
// Muestra todos los exámenes y trabajos del grupo activo (fetch fresco sin caché).
// Al pulsar una fila abre bulk-grade-drawer para esa tarea.
// Patrón singleton idéntico a grade-drawer.js.

import { apiFetch, clearSession } from "../../../shared/js/auth.js";
import { openBulkGradeDrawer, closeBulkGradeDrawer } from "./bulk-grade-drawer.js";

// ── Singleton DOM ─────────────────────────────────────────────────────────

let _overlay = null;
let _panel   = null;
let _bodyEl  = null;
let _titleEl = null;

// ── State ─────────────────────────────────────────────────────────────────

let _ctx = null;

// ── Helpers ───────────────────────────────────────────────────────────────

function _esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function _typeLabel(type) { return type === "work" ? "TRABAJO" : "EXAMEN"; }
function _typeBadgeClass(type) { return type === "work" ? "tgp-badge--work" : "tgp-badge--exam"; }

function _formatDate(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

// ── Init ──────────────────────────────────────────────────────────────────

function _init() {
  if (_overlay) return;

  _overlay = document.createElement("div");
  _overlay.className = "dd-overlay";
  _overlay.id = "taskPickerDrawerOverlay";
  _overlay.addEventListener("click", closeTaskPickerDrawer);

  _panel = document.createElement("aside");
  _panel.className = "dd-panel tpd-panel";
  _panel.setAttribute("role", "dialog");
  _panel.setAttribute("aria-modal", "true");
  _panel.setAttribute("aria-labelledby", "tpdTitle");
  _panel.addEventListener("click", e => e.stopPropagation());

  _panel.innerHTML = `
    <div class="dd-head">
      <div class="dd-head-top">
        <h2 class="gd-title" id="tpdTitle">Notas por tarea</h2>
        <button class="dd-close" id="tpdCloseBtn" type="button" title="Cerrar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="dd-body" id="tpdBody">
      <p class="gd-empty" id="tpdLoading">Cargando tareas...</p>
    </div>
  `;

  _overlay.appendChild(_panel);
  document.body.appendChild(_overlay);

  _titleEl = _panel.querySelector("#tpdTitle");
  _bodyEl  = _panel.querySelector("#tpdBody");

  _panel.querySelector("#tpdCloseBtn").addEventListener("click", closeTaskPickerDrawer);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && _overlay?.classList.contains("open")) closeTaskPickerDrawer();
  });

  // Cuando el drawer de bulk (Level 2) se cierra solo, quitar el desplazamiento de Level 1
  document.addEventListener("bulkGradeDrawerClosed", () => {
    if (_overlay?.classList.contains("open")) {
      _panel?.classList.remove("is-stacked");
    }
  });

  _bodyEl.addEventListener("click", e => {
    const row = e.target.closest("[data-tpd-task-id]");
    if (!row || !_ctx) return;
    e.stopPropagation();
    // Desplazar Level 1 a la izquierda para hacer sitio al Level 2
    _panel.classList.add("is-stacked");
    openBulkGradeDrawer(_ctx, row.dataset.tpdTaskId, {
      stacked:   true,
      taskTitle: row.dataset.tpdTaskTitle,
      taskType:  row.dataset.tpdTaskType,
      onSaved:   () => _refreshCounters().catch(console.error),
    }).catch(console.error);
  });
}

// ── Fetch & render ────────────────────────────────────────────────────────

async function _loadAndRender() {
  if (!_ctx) return;
  const groupId = _ctx.state.currentGroupId;
  const subjectFilter = _ctx.state.currentSubjectFilter || "";

  if (!groupId) {
    _bodyEl.innerHTML = `<p class="gd-empty">No hay grupo activo.</p>`;
    return;
  }

  // Fetch fresco — sin depender de state.data.tasks (que solo carga el rango de agenda)
  let tasks = [];
  try {
    const res = await apiFetch(
      `/api/v1/tasks?group_id=${encodeURIComponent(groupId)}&history=true&limit=500&offset=0`
    );
    if (!res.ok) {
      if (res.status === 401) { clearSession(); window.location.href = "/login"; }
      _bodyEl.innerHTML = `<p class="gd-empty">Error al cargar tareas.</p>`;
      return;
    }
    const body = await res.json().catch(() => ({}));
    const items = body?.data?.items || [];
    tasks = items
      .filter(t => (t.type === "exam" || t.type === "work") &&
        (!subjectFilter || (t.subject_name || "") === subjectFilter))
      .sort((a, b) => (b.due_date || "").localeCompare(a.due_date || ""));
  } catch {
    _bodyEl.innerHTML = `<p class="gd-empty">Error de red.</p>`;
    return;
  }

  if (!tasks.length) {
    _bodyEl.innerHTML = `<p class="gd-empty">Sin exámenes ni trabajos en este grupo.</p>`;
    return;
  }

  const students = Array.isArray(_ctx.state.data.students) ? _ctx.state.data.students : [];
  const total = students.filter(
    s => s.tenantId === _ctx.state.tenantId && s.groupId === groupId
  ).length;

  const list = document.createElement("div");
  list.className = "tgp-list";

  tasks.forEach(t => {
    const row = document.createElement("div");
    row.className = "tgp-row";
    row.dataset.tpdTaskId    = t.id;
    row.dataset.tpdTaskTitle = t.title || "";
    row.dataset.tpdTaskType  = t.type  || "exam";
    row.innerHTML = `
      <div class="tgp-row-left">
        <span class="tgp-badge ${_typeBadgeClass(t.type)}">${_typeLabel(t.type)}</span>
        <div class="tgp-row-info">
          <span class="tgp-row-title">${_esc(t.title)}</span>
          <span class="tgp-row-date">${_esc(_formatDate(t.due_date))}</span>
        </div>
      </div>
      <div class="tgp-row-right">
        <span class="tgp-counter" data-tpd-count="${_esc(t.id)}">— / ${total}</span>
        <svg class="tgp-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </div>
    `;
    list.appendChild(row);
  });

  _bodyEl.innerHTML = "";
  _bodyEl.appendChild(list);

  // Fetch grade counts in parallel
  await Promise.all(tasks.map(async t => {
    const count = await _fetchGradeCount(t.id);
    const el = _bodyEl.querySelector(`[data-tpd-count="${CSS.escape(t.id)}"]`);
    if (el) el.textContent = `${count} / ${total}`;
  }));
}

async function _fetchGradeCount(taskId) {
  try {
    const res = await apiFetch(`/api/v1/grades?task_id=${encodeURIComponent(taskId)}`);
    if (!res.ok) return 0;
    const body = await res.json().catch(() => ({}));
    const grades = body?.data || [];
    return new Set(grades.map(g => g.student_id)).size;
  } catch {
    return 0;
  }
}

async function _refreshCounters() {
  if (!_bodyEl || !_ctx) return;
  const groupId = _ctx.state.currentGroupId;
  const students = Array.isArray(_ctx.state.data.students) ? _ctx.state.data.students : [];
  const total = students.filter(
    s => s.tenantId === _ctx.state.tenantId && s.groupId === groupId
  ).length;

  const counters = _bodyEl.querySelectorAll("[data-tpd-count]");
  await Promise.all(Array.from(counters).map(async el => {
    const taskId = el.dataset.tpdCount;
    const count = await _fetchGradeCount(taskId);
    el.textContent = `${count} / ${total}`;
  }));
}

// ── Public API ────────────────────────────────────────────────────────────

export async function openTaskPickerDrawer(ctx) {
  _init();
  _ctx = ctx;

  _overlay.classList.add("open");
  _panel.classList.add("open");
  _bodyEl.innerHTML = `<p class="gd-empty">Cargando tareas...</p>`;

  await _loadAndRender();
}

export function closeTaskPickerDrawer() {
  _overlay?.classList.remove("open");
  _panel?.classList.remove("open", "is-stacked");
  closeBulkGradeDrawer();
  _ctx = null;
}
