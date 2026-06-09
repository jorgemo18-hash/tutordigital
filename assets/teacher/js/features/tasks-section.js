// tasks-section.js — Sección "Tareas" del panel profesor.
// Muestra exámenes y trabajos del grupo activo con contador de notas.

import { apiFetch, clearSession } from "../../../shared/js/auth.js";

function _esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function _typeLabel(type) {
  return type === "work" ? "TRABAJO" : "EXAMEN";
}

function _typeBadgeClass(type) {
  return type === "work" ? "tgp-badge--work" : "tgp-badge--exam";
}

function _formatDate(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

async function _fetchGradeCount(taskId) {
  try {
    const res = await apiFetch(`/api/v1/grades?task_id=${encodeURIComponent(taskId)}`);
    if (!res.ok) {
      if (res.status === 401) { clearSession(); window.location.href = "/login"; }
      return 0;
    }
    const body = await res.json().catch(() => ({}));
    const grades = body?.data || [];
    const uniqueStudents = new Set(grades.map(g => g.student_id));
    return uniqueStudents.size;
  } catch {
    return 0;
  }
}

export async function renderTasksSection(ctx) {
  const listEl = ctx.elements.tasksGradeList;
  const emptyEl = ctx.elements.tasksGradeEmpty;
  if (!listEl) return;

  listEl.innerHTML = "";
  if (emptyEl) emptyEl.style.display = "none";

  const groupId = ctx.state.currentGroupId;
  const subjectFilter = ctx.state.currentSubjectFilter || "";
  const tenantId = ctx.state.tenantId;

  const allTasks = Array.isArray(ctx.state.data.tasks) ? ctx.state.data.tasks : [];
  const students = Array.isArray(ctx.state.data.students) ? ctx.state.data.students : [];
  const totalStudents = students.filter(
    s => s.tenantId === tenantId && s.groupId === groupId
  ).length;

  const tasks = allTasks
    .filter(t =>
      t.tenantId === tenantId &&
      t.groupId === groupId &&
      (t.type === "exam" || t.type === "work") &&
      (!subjectFilter || t.subjectName === subjectFilter || t.subject_name === subjectFilter)
    )
    .sort((a, b) => {
      const da = a.dueDate || a.due_date || "";
      const db = b.dueDate || b.due_date || "";
      return db.localeCompare(da);
    });

  if (!tasks.length) {
    if (emptyEl) emptyEl.style.display = "";
    return;
  }

  // Render skeleton rows first, then fill counts async
  tasks.forEach(task => {
    const dueDate = task.dueDate || task.due_date || "";
    const title = task.title || "—";
    const type = task.type;

    const row = document.createElement("div");
    row.className = "tgp-row";
    row.dataset.bulkAction = "open-bulk-drawer";
    row.dataset.taskId = task.id;
    row.innerHTML = `
      <div class="tgp-row-left">
        <span class="tgp-badge ${_typeBadgeClass(type)}">${_typeLabel(type)}</span>
        <div class="tgp-row-info">
          <span class="tgp-row-title">${_esc(title)}</span>
          <span class="tgp-row-date">${_esc(_formatDate(dueDate))}</span>
        </div>
      </div>
      <div class="tgp-row-right">
        <span class="tgp-counter" id="tgp-count-${_esc(task.id)}">— / ${totalStudents}</span>
        <svg class="tgp-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </div>
    `;
    listEl.appendChild(row);
  });

  // Fetch grade counts in parallel and update counters
  await Promise.all(tasks.map(async task => {
    const count = await _fetchGradeCount(task.id);
    const el = listEl.querySelector(`#tgp-count-${CSS.escape(task.id)}`);
    if (el) el.textContent = `${count} / ${totalStudents}`;
  }));
}
