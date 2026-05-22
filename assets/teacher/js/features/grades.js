import { apiFetch, clearSession } from "../../../shared/js/auth.js";
import { setOverlay } from "../dom.js";
import { formatDate } from "../utils.js";
import { formatStudentName, normalizeStudent } from "../state.js";

export async function openTaskGradeModal(ctx, taskId) {
  const task = ctx.state.data.tasks.find(t => t.id === taskId);
  if (!task) return;

  ctx.state.activeTaskId = taskId;
  ctx.elements.taskGradeTitle.textContent = `Notas · ${task.title}`;

  // Populate student selector
  const studentsRaw = Array.isArray(ctx.state.data.students) ? ctx.state.data.students : [];
  const groupStudents = studentsRaw
    .filter(s => s.tenantId === ctx.state.tenantId && s.groupId === ctx.state.currentGroupId)
    .map(s => normalizeStudent(s))
    .sort((a, b) => formatStudentName(a).localeCompare(formatStudentName(b), "es"));

  ctx.elements.taskGradeStudent.innerHTML = groupStudents
    .map(s => `<option value="${s.id}">${formatStudentName(s)}</option>`)
    .join("");

  ctx.elements.taskGradeScore.value = "";
  ctx.elements.taskGradeSaveBtn.dataset.editId = "";

  await loadAndRenderTaskGrades(ctx, taskId);
  setOverlay(ctx.elements.taskGradeModal, true);
  ctx.elements.taskGradeScore.focus();
}

export function closeTaskGradeModal(ctx) {
  setOverlay(ctx.elements.taskGradeModal, false);
  ctx.state.activeTaskId = null;
}

export async function loadAndRenderTaskGrades(ctx, taskId) {
  const res = await apiFetch(`/api/v1/grades?task_id=${encodeURIComponent(taskId)}`);
  if (!res.ok) {
    if (res.status === 401) { clearSession(); window.location.href = "/index.html"; }
    return;
  }
  const body = await res.json().catch(() => ({}));
  const grades = body?.data || [];
  renderTaskGradeList(ctx, grades);
}

function renderTaskGradeList(ctx, grades) {
  const studentsRaw = Array.isArray(ctx.state.data.students) ? ctx.state.data.students : [];
  const studentsById = new Map(studentsRaw.map(s => [s.id, normalizeStudent(s)]));

  ctx.elements.taskGradeList.innerHTML = "";
  grades.forEach(grade => {
    const student = studentsById.get(grade.student_id);
    const studentName = student ? formatStudentName(student) : "Alumno";
    const li = document.createElement("li");
    li.className = "attachmentItem";
    li.innerHTML = `
      <div class="attachmentInfo">
        <div class="attachmentName">${studentName} · ${grade.score}</div>
        <div class="attachmentMeta">${grade.title} · ${grade.date}</div>
      </div>
      <div class="attachmentActions">
        <button class="btn ghost" style="font-size:11px;padding:4px 8px"
          data-grade-action="edit"
          data-grade-id="${grade.id}"
          data-student-id="${grade.student_id}"
          data-score="${grade.score}"
          type="button">Editar</button>
        <button class="btn ghost" style="font-size:11px;padding:4px 8px"
          data-grade-action="delete"
          data-grade-id="${grade.id}"
          type="button">✕</button>
      </div>
    `;
    ctx.elements.taskGradeList.appendChild(li);
  });
  ctx.elements.taskGradeEmpty.style.display = grades.length ? "none" : "block";
}

export async function handleTaskGradeSubmit(ctx, event) {
  event.preventDefault();
  const taskId = ctx.state.activeTaskId;
  if (!taskId) return;

  const studentId = ctx.elements.taskGradeStudent.value;
  const score = ctx.elements.taskGradeScore.value.trim();
  if (!studentId || !score) return;

  const task = ctx.state.data.tasks.find(t => t.id === taskId);
  const title = task?.title || "Nota";
  const date = formatDate(new Date());
  const editId = ctx.elements.taskGradeSaveBtn.dataset.editId;

  const btn = ctx.elements.taskGradeSaveBtn;
  btn.disabled = true;

  try {
    let res;
    if (editId) {
      res = await apiFetch(`/api/v1/grades/${encodeURIComponent(editId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score }),
      });
    } else {
      res = await apiFetch("/api/v1/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, student_id: studentId, title, score, date }),
      });
    }

    if (!res.ok) {
      if (res.status === 401) { clearSession(); window.location.href = "/index.html"; return; }
      return;
    }
  } finally {
    btn.disabled = false;
  }

  ctx.elements.taskGradeScore.value = "";
  ctx.elements.taskGradeSaveBtn.dataset.editId = "";
  ctx.elements.taskGradeSaveBtn.textContent = "Guardar";
  await loadAndRenderTaskGrades(ctx, taskId);
}

export async function handleTaskGradeListClick(ctx, event) {
  const taskId = ctx.state.activeTaskId;
  if (!taskId) return;

  const editBtn = event.target.closest("[data-grade-action='edit']");
  if (editBtn) {
    ctx.elements.taskGradeStudent.value = editBtn.dataset.studentId;
    ctx.elements.taskGradeScore.value = editBtn.dataset.score;
    ctx.elements.taskGradeSaveBtn.dataset.editId = editBtn.dataset.gradeId;
    ctx.elements.taskGradeSaveBtn.textContent = "Actualizar";
    ctx.elements.taskGradeScore.focus();
    return;
  }

  const deleteBtn = event.target.closest("[data-grade-action='delete']");
  if (!deleteBtn) return;
  const gradeId = deleteBtn.dataset.gradeId;
  if (!gradeId) return;

  const res = await apiFetch(`/api/v1/grades/${encodeURIComponent(gradeId)}`, { method: "DELETE" });
  if (!res.ok) {
    if (res.status === 401) { clearSession(); window.location.href = "/index.html"; }
    return;
  }
  await loadAndRenderTaskGrades(ctx, taskId);
}
