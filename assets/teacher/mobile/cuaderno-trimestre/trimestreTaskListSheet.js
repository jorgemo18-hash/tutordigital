// trimestreTaskListSheet.js — "Progreso de tareas → Ver" sub-view. Swaps the
// content of the same Level-2 sheet (with a back arrow) instead of stacking
// a new one. Tapping a task row opens its session detail (existing
// openSessionSheet), replacing this content in turn.
import { escHtml as _esc } from "../../../shared/js/escHtml.js";

const SVG_BACK  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>`;
const SVG_CLOSE = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`;

const DOT_CLASS = { resolved: "done", help: "needs", pending: "pending" };

function _rowHtml(pt) {
  const disabled = pt.sessionId ? "" : "disabled";
  return `
    <li class="mt-tl-item" data-task-id="${_esc(pt.taskId)}">
      <span class="mt-dot mt-dot--${DOT_CLASS[pt.status] || "pending"}"></span>
      <div class="mt-tl-info">
        <span class="mt-tl-title">${_esc(pt.taskTitle)}</span>
        ${pt.sessionDate ? `<span class="mt-tl-date">${_esc(pt.sessionDate)}</span>` : ""}
      </div>
      <button class="mt-ver-btn" type="button" data-task-id="${_esc(pt.taskId)}" ${disabled}>Ver</button>
    </li>`;
}

export function renderTrimestreTaskList({ contentEl, studentName, progressTasks, onBack, onClose, onViewSession }) {
  contentEl.innerHTML = `
    <div class="mt-sheet-header">
      <button class="mt-sheet-close" id="mtTlBack" aria-label="Volver">${SVG_BACK}</button>
      <span class="mt-sheet-title">${_esc(studentName)}</span>
      <button class="mt-sheet-close" id="mtTlClose" aria-label="Cerrar">${SVG_CLOSE}</button>
    </div>
    <div class="mt-sheet-body">
      ${progressTasks.length === 0
        ? `<div class="mt-loading">Sin tareas en el trimestre.</div>`
        : `<ul class="mt-tl-list">${progressTasks.map(_rowHtml).join("")}</ul>`}
    </div>`;

  contentEl.querySelector("#mtTlBack").addEventListener("click", onBack);
  contentEl.querySelector("#mtTlClose").addEventListener("click", onClose);
  contentEl.querySelectorAll(".mt-ver-btn[data-task-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      const pt = progressTasks.find(p => p.taskId === btn.dataset.taskId);
      if (pt) onViewSession(pt);
    });
  });
}
