// trimestreDetailSheet.js — Level 2 of the mobile Trimestre view: bottom
// sheet with the full per-student breakdown (stats grid, progress, grades,
// and the entry point into the stats+report sheet).

import { fmtTime } from "../../js/session-drawer-render.js";

const SVG_X = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`;

function _esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function _gradeSectionHtml(type, label, grades) {
  const right = grades.length
    ? `<span class="mt-tsect-count">${grades.length} nota${grades.length !== 1 ? "s" : ""}</span>
       <button class="mt-ver-btn" type="button" data-grade-type="${type}">Ver</button>`
    : `<span class="mt-tsect-empty">Sin notas</span>`;
  return `
    <div class="mt-tsect">
      <div class="mt-tsect-head">
        <span class="mt-tsect-label">${_esc(label)}</span>
        <div class="mt-tsect-right">${right}</div>
      </div>
    </div>`;
}

function _progressSectionHtml(progressTasks) {
  if (!progressTasks.length) return "";
  return `
    <div class="mt-tsect">
      <div class="mt-tsect-head">
        <span class="mt-tsect-label">Progreso de tareas</span>
        <div class="mt-tsect-right">
          <span class="mt-tsect-count">${progressTasks.length} tarea${progressTasks.length !== 1 ? "s" : ""}</span>
          <button class="mt-ver-btn" type="button" id="mtTdVerProgress">Ver</button>
        </div>
      </div>
    </div>`;
}

export function renderTrimestreDetail({ contentEl, studentName, data, onClose, onOpenTaskList, onOpenGrades, onOpenReport }) {
  const { stats, sessionStats, progressTasks, examGrades, workGrades } = data;
  const pct     = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  const avgSecs = sessionStats.sessionDays > 0 ? Math.round(sessionStats.totalSecs / sessionStats.sessionDays) : 0;

  contentEl.innerHTML = `
    <div class="mt-sheet-header">
      <span class="mt-sheet-title">${_esc(studentName)}</span>
      <button class="mt-sheet-close" id="mtTdClose">${SVG_X}</button>
    </div>
    <div class="mt-sheet-body">
      <div class="mt-stats-grid">
        <div class="mt-stat-cell">
          <span class="mt-stat-label">Resolvió solo</span>
          <span class="mt-stat-val">${sessionStats.solvedAlone}<em>/ ${stats.total}</em></span>
        </div>
        <div class="mt-stat-cell">
          <span class="mt-stat-label">Tiempo tutor</span>
          <span class="mt-stat-val">${_esc(fmtTime(sessionStats.totalSecs))}</span>
        </div>
        <div class="mt-stat-cell">
          <span class="mt-stat-label">Tareas hechas</span>
          <span class="mt-stat-val">${stats.done}<em>/ ${stats.total}</em> · ${pct}%</span>
        </div>
        <div class="mt-stat-cell">
          <span class="mt-stat-label">Tiempo medio/tarea</span>
          <span class="mt-stat-val">${_esc(fmtTime(avgSecs))}</span>
        </div>
      </div>
      ${_progressSectionHtml(progressTasks)}
      ${_gradeSectionHtml("exam", "Exámenes", examGrades)}
      ${_gradeSectionHtml("work", "Trabajos", workGrades)}
    </div>
    <div class="mt-sheet-footer">
      <button class="mt-btn mt-btn--primary" type="button" id="mtTdReportBtn" style="width:100%">Ver estadísticas e informe</button>
    </div>`;

  contentEl.querySelector("#mtTdClose").addEventListener("click", onClose);
  contentEl.querySelector("#mtTdVerProgress")?.addEventListener("click", onOpenTaskList);
  contentEl.querySelector('[data-grade-type="exam"]')?.addEventListener("click", () => onOpenGrades("exam", examGrades));
  contentEl.querySelector('[data-grade-type="work"]')?.addEventListener("click", () => onOpenGrades("work", workGrades));
  contentEl.querySelector("#mtTdReportBtn").addEventListener("click", onOpenReport);
}
