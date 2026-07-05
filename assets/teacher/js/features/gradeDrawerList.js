// gradeDrawerList.js — Pools a context's tasks and renders the "Notas
// registradas" list for grade-drawer.js. Split out to keep that file under
// the line-count budget; every function takes its dependencies explicitly.

import { formatStudentName, normalizeStudent } from "../state.js";
import { escHtml as _esc } from "../../../shared/js/escHtml.js";

export function pooledTasks(ctx) {
  if (!ctx) return [];
  return [
    ...(Array.isArray(ctx.state.data.weekTasks) ? ctx.state.data.weekTasks : []),
    ...(Array.isArray(ctx.state.data.tasks) ? ctx.state.data.tasks : []),
  ];
}

// Renders the registered-notes list into listEl, toggling emptyEl.
// activeStudentId both filters the rows and decides whether each row also
// prints the student's name (omitted when the drawer is already scoped to one).
export function renderGradeList({ listEl, emptyEl, grades, activeStudentId, ctx }) {
  const allTasks       = pooledTasks(ctx);
  const taskTitleMap   = new Map(allTasks.map(t => [t.id, t.title]));
  const taskSubjectMap = new Map(allTasks.map(t => [t.id, t.subjectName || ""]));

  const studentsRaw = Array.isArray(ctx?.state?.data?.students) ? ctx.state.data.students : [];
  const studentsMap = new Map(studentsRaw.map(s => [s.id, normalizeStudent(s)]));

  const filtered = activeStudentId
    ? grades.filter(g => g.student_id === activeStudentId)
    : grades;

  listEl.innerHTML = "";
  filtered.forEach(grade => {
    const taskTitle   = taskTitleMap.get(grade.task_id) || grade.title || "—";
    const subject     = taskSubjectMap.get(grade.task_id) || "";
    const studentName = !activeStudentId
      ? (formatStudentName(studentsMap.get(grade.student_id)) || "Alumno")
      : null;

    const li = document.createElement("li");
    li.className = "gd-grade-item";
    li.innerHTML = `
      <div class="gd-grade-score">${_esc(grade.score)}</div>
      <div class="gd-grade-info">
        ${subject ? `<div class="gd-grade-subject">${_esc(subject)}</div>` : ""}
        <div class="gd-grade-task">${_esc(taskTitle)}</div>
        <div class="gd-grade-date">${studentName ? `${_esc(studentName)} · ` : ""}${_esc(grade.date || "")}</div>
      </div>
      <div class="gd-grade-actions">
        <button class="btn ghost" style="font-size:11px;padding:4px 8px"
          data-gd-edit="${_esc(grade.id)}"
          data-gd-score="${_esc(grade.score)}"
          type="button">Editar</button>
        <button class="btn ghost" style="font-size:11px;padding:4px 8px"
          data-gd-delete="${_esc(grade.id)}"
          type="button">✕</button>
      </div>
    `;
    listEl.appendChild(li);
  });

  emptyEl.style.display = filtered.length ? "none" : "block";
}
