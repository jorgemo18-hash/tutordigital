// notasTaskList.js — Level 1 of "Poner notas": one row per exam/work task,
// with a "X / Y alumnos con nota" counter fetched the same way desktop's
// task-picker-drawer.js does. Renders inline into the Cuaderno page (not a
// sheet) — tapping a row opens the bulk sheet (Level 2).

import { mtFetchGradesForTask } from "./notasData.js";

function _esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function _typeLabel(type) { return type === "work" ? "TRABAJO" : "EXAMEN"; }

function _formatDate(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function _rowHtml(task) {
  return `
    <button type="button" class="mt-notas-card" data-task-id="${_esc(task.id)}">
      <div class="mt-notas-row-top">
        <span class="mt-notas-type">${_typeLabel(task.type)}</span>
        <span class="mt-notas-count" data-count-for="${_esc(task.id)}">— / ?</span>
      </div>
      <div class="mt-notas-title">${_esc(task.title || "Sin título")}</div>
      <div class="mt-notas-date">${_esc(_formatDate(task.due_date))}</div>
    </button>`;
}

export function renderNotasTaskList({ containerEl, tasks, totalStudents, apiFetch, onSelectTask }) {
  if (!tasks.length) {
    containerEl.innerHTML = `<div class="mt-loading">Sin exámenes ni trabajos en este grupo.</div>`;
    return;
  }

  containerEl.innerHTML = tasks.map(_rowHtml).join("");

  containerEl.querySelectorAll("[data-task-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      const task = tasks.find(t => t.id === btn.dataset.taskId);
      if (task) onSelectTask(task);
    });
  });

  tasks.forEach(async task => {
    const grades = await mtFetchGradesForTask(apiFetch, task.id);
    const count  = new Set(grades.map(g => g.student_id)).size;
    const el = containerEl.querySelector(`[data-count-for="${CSS.escape(task.id)}"]`);
    if (el) el.textContent = `${count} / ${totalStudents}`;
  });
}
