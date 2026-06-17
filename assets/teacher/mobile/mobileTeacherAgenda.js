// mobileTeacherAgenda.js — Agenda tab for the mobile teacher panel.

import { mtFetchTasks, mtDeleteTask } from "./mobileTeacherData.js";
import { openNewTaskSheet } from "./mobileTeacherSheets.js";
import { formatYMDLocal } from "../js/notebook-week.js";

const SVG_PLUS = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const SVG_CAL  = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
const SVG_CLIP = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`;
const SVG_PIN  = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;

function _esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

// "Today" must be computed in the device's local timezone — using toISOString()
// (UTC) made tasks due "today" show up under the "tomorrow" filter for hours
// near local midnight in Spain. formatYMDLocal mirrors the rest of the app.
function _todayStr() { return formatYMDLocal(new Date()); }
function _tomorrowStr() { const d = new Date(); d.setDate(d.getDate() + 1); return formatYMDLocal(d); }
function _in7Days() { const d = new Date(); d.setDate(d.getDate() + 6); return formatYMDLocal(d); }

function _matchesFilter(task, filter) {
  const due = task.due_date || task.dueDate || "";
  if (!due) return filter === "7days";
  const today    = _todayStr();
  const tomorrow = _tomorrowStr();
  const in7      = _in7Days();
  if (filter === "today")    return due === today;
  if (filter === "tomorrow") return due === tomorrow;
  if (filter === "7days")    return due >= today && due <= in7;
  return true;
}

function _fmtDate(isoDate) {
  if (!isoDate) return "";
  try {
    const d = new Date(isoDate + "T12:00:00");
    return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  } catch { return isoDate; }
}

function _renderTaskIndicators(task) {
  const hasAttachment = Array.isArray(task.attachments) && task.attachments.length > 0;
  const hasNote       = !!String(task.teacher_notes || "").trim();
  if (!hasAttachment && !hasNote) return "";
  return `<div class="mt-task-indicators">
    ${hasAttachment ? `<span class="mt-task-indicator" aria-label="Tiene adjunto">${SVG_CLIP}</span>` : ""}
    ${hasNote ? `<span class="mt-task-indicator" aria-label="Tiene nota para el alumno">${SVG_PIN}</span>` : ""}
  </div>`;
}

function _renderTaskCard(task, onDelete) {
  const div  = document.createElement("div");
  div.className = "mt-task-card";
  const due  = task.due_date || task.dueDate || "";
  const subj = task.subject_name || task.subjectName || "";

  div.innerHTML = `
    <button type="button" class="mt-task-delete" aria-label="Eliminar tarea">&times;</button>
    ${subj ? `<div class="mt-task-subject">${_esc(subj)}</div>` : ""}
    <div class="mt-task-title">${_esc(task.title || "Sin título")}</div>
    <div class="mt-task-meta">
      <span>${SVG_CAL} ${_esc(_fmtDate(due))}</span>
    </div>
    ${_renderTaskIndicators(task)}`;

  div.querySelector(".mt-task-delete").addEventListener("click", e => {
    e.stopPropagation();
    onDelete(task);
  });
  return div;
}

function _renderTaskGroup(label, tasks, onDelete) {
  const frag = document.createDocumentFragment();
  if (!tasks.length) return frag;
  const lbl = document.createElement("div");
  lbl.className = "mt-task-group-label";
  lbl.textContent = label;
  frag.appendChild(lbl);
  tasks.forEach(t => frag.appendChild(_renderTaskCard(t, onDelete)));
  return frag;
}

function _buildHeader(headerEl, mtState, refreshFn) {
  const today = new Date();
  const eyebrowDate = today.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  headerEl.innerHTML = `
    <div class="mt-header-eyebrow">${_esc(eyebrowDate.toUpperCase())}</div>
    <h1 class="mt-header-title">Tu <em>agenda</em></h1>
    <div class="mt-agenda-controls">
      <div class="mt-seg" style="flex:1;margin-bottom:0">
        <button class="mt-seg-btn ${mtState.dateFilter === "today"    ? "mt-seg-btn--active" : ""}" data-filter="today">Hoy</button>
        <button class="mt-seg-btn ${mtState.dateFilter === "tomorrow" ? "mt-seg-btn--active" : ""}" data-filter="tomorrow">Mañana</button>
        <button class="mt-seg-btn ${mtState.dateFilter === "7days"    ? "mt-seg-btn--active" : ""}" data-filter="7days">7 días</button>
      </div>
      <button class="mt-add-btn" id="mtAddTaskBtn">${SVG_PLUS} Añadir</button>
    </div>`;

  headerEl.querySelectorAll(".mt-seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      mtState.dateFilter = btn.dataset.filter;
      refreshFn();
    });
  });
}

export async function initMtAgenda({ pageEl, headerEl, sheetEl, backdropEl, mtState, apiFetch }) {
  const contentEl = document.createElement("div");
  contentEl.id = "mtAgendaContent";
  pageEl.appendChild(contentEl);

  async function refresh() {
    _buildHeader(headerEl, mtState, refresh);

    headerEl.querySelector("#mtAddTaskBtn")?.addEventListener("click", () => {
      openNewTaskSheet({
        sheetEl, backdropEl,
        groups: mtState.groups,
        currentGroupId: mtState.currentGroupId,
        apiFetch,
        onCreated: () => refresh(),
      });
    });

    contentEl.innerHTML = `<div class="mt-loading">Cargando…</div>`;

    const groupId = mtState.currentGroupId;
    if (!groupId) { contentEl.innerHTML = `<div class="mt-agenda-empty">Selecciona un grupo.</div>`; return; }

    const tasks = await mtFetchTasks(apiFetch, groupId).catch(() => []);
    const filtered = tasks.filter(t => _matchesFilter(t, mtState.dateFilter));
    const byType   = { homework: [], exam: [], work: [] };
    filtered.forEach(t => { if (byType[t.type]) byType[t.type].push(t); });

    contentEl.innerHTML = "";
    if (!filtered.length) {
      contentEl.innerHTML = `<div class="mt-agenda-empty">Nada por aquí de momento.</div>`;
      return;
    }

    async function _handleDelete(task) {
      if (!confirm(`¿Eliminar la tarea "${task.title}"?`)) return;
      await mtDeleteTask(apiFetch, task.id).catch(() => {});
      refresh();
    }

    contentEl.appendChild(_renderTaskGroup("DEBERES",  byType.homework, _handleDelete));
    contentEl.appendChild(_renderTaskGroup("EXÁMENES", byType.exam,     _handleDelete));
    contentEl.appendChild(_renderTaskGroup("TRABAJOS", byType.work,     _handleDelete));
  }

  await refresh();
}
