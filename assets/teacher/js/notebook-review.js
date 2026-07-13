// notebook-review.js — sesiones needs_help=true && teacher_reviewed=false
// del periodo/grupo actualmente cargado en el Cuaderno (mismo scope que
// ctx.state.data.tutorSessions). Solo datos + actualización del badge de
// aviso — el popover de lista vive en notebook-review-popover.js, y el
// wiring del click en modals.js (evita el ciclo notebook.js↔session-drawer.js).
import { formatStudentName, normalizeStudent } from "./state.js";

export function getPendingReviewSessions(ctx) {
  const sessions = Array.isArray(ctx.state.data.tutorSessions) ? ctx.state.data.tutorSessions : [];
  const pending = sessions.filter(s => s.needs_help && !s.teacher_reviewed);
  if (!pending.length) return [];

  const students = Array.isArray(ctx.state.data.students) ? ctx.state.data.students : [];
  const tasks = ctx.state.data.weekTasks || ctx.state.data.tasks || [];
  const studentById = new Map(students.map(s => [s.id, s]));
  const taskById = new Map(tasks.map(t => [t.id, t]));

  return pending
    .map(s => ({
      sessionId: s.id,
      studentId: s.student_id,
      taskId: s.task_id,
      studentName: formatStudentName(normalizeStudent(studentById.get(s.student_id))) || "Alumno",
      taskTitle: taskById.get(s.task_id)?.title || "Tarea",
      sessionDate: s.session_date || "",
    }))
    .sort((a, b) => (b.sessionDate || "").localeCompare(a.sessionDate || ""));
}

export function updateReviewBadge(badgeEl, ctx) {
  if (!badgeEl) return;
  const pending = getPendingReviewSessions(ctx);
  if (pending.length === 0) {
    badgeEl.style.display = "none";
    return;
  }
  badgeEl.textContent = String(pending.length);
  badgeEl.style.display = "";
}
