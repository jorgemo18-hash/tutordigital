import { apiFetch, clearSession } from "../../../shared/js/auth.js";
import { setOverlay } from "../dom.js";
import { formatDate, escapeHtml } from "../utils.js";
import { formatStudentName, normalizeStudent } from "../state.js";

export async function openTaskGradeModal(ctx, taskId, studentId, allTaskIds) {
  const pooledTasks = [
    ...(Array.isArray(ctx.state.data.weekTasks) ? ctx.state.data.weekTasks : []),
    ...(Array.isArray(ctx.state.data.tasks) ? ctx.state.data.tasks : []),
  ];
  const task = pooledTasks.find(t => t.id === taskId);
  if (!task) return;

  ctx.state.activeTaskId = taskId;
  ctx.state.activeGradeStudentId = studentId || null;

  // Task selector: show if multiple tasks passed, else fixed title in header
  const taskList = allTaskIds && allTaskIds.length > 1
    ? allTaskIds.map(id => pooledTasks.find(t => t.id === id)).filter(Boolean)
    : null;

  // FIX 1: type label + task title always visible in modal header
  const typeLabel = task.type === "work" ? "Trabajo" : "Examen";
  ctx.elements.taskGradeTaskLabel.textContent = typeLabel;
  ctx.elements.taskGradeTitle.textContent = `Notas · ${typeLabel} · ${task.title}`;

  if (taskList) {
    ctx.elements.taskGradeTaskSelect.innerHTML = taskList
      .map(t => `<option value="${t.id}"${t.id === taskId ? " selected" : ""}>${escapeHtml(t.title)}</option>`)
      .join("");
    ctx.elements.taskGradeTaskSelectField.style.display = "";
  } else {
    ctx.elements.taskGradeTaskSelectField.style.display = "none";
  }

  if (studentId) {
    const student = normalizeStudent(
      (ctx.state.data.students || []).find(s => s.id === studentId)
    );
    ctx.elements.taskGradeStudentName.textContent = formatStudentName(student) || studentId;
    ctx.elements.taskGradeStudentField.style.display = "none";
    ctx.elements.taskGradeStudentNameField.style.display = "";
  } else {
    ctx.elements.taskGradeStudentField.style.display = "";
    ctx.elements.taskGradeStudentNameField.style.display = "none";
    const studentsRaw = Array.isArray(ctx.state.data.students) ? ctx.state.data.students : [];
    const groupStudents = studentsRaw
      .filter(s => s.tenantId === ctx.state.tenantId && s.groupId === ctx.state.currentGroupId)
      .map(s => normalizeStudent(s))
      .sort((a, b) => formatStudentName(a).localeCompare(formatStudentName(b), "es"));
    ctx.elements.taskGradeStudent.innerHTML = groupStudents
      .map(s => `<option value="${s.id}">${escapeHtml(formatStudentName(s))}</option>`)
      .join("");
  }

  ctx.elements.taskGradeScore.value = "";
  ctx.elements.taskGradeSaveBtn.dataset.editId = "";
  ctx.elements.taskGradeSaveBtn.textContent = "Guardar";

  await loadAndRenderTaskGrades(ctx, taskId, studentId);
  setOverlay(ctx.elements.taskGradeModal, true);
  ctx.elements.taskGradeScore.focus();
}

export function closeTaskGradeModal(ctx) {
  setOverlay(ctx.elements.taskGradeModal, false);
  ctx.state.activeTaskId = null;
  ctx.state.activeGradeStudentId = null;
}

export async function loadAndRenderTaskGrades(ctx, taskId, studentId, { updateList = true } = {}) {
  const res = await apiFetch(`/api/v1/grades?task_id=${encodeURIComponent(taskId)}`);
  if (!res.ok) {
    if (res.status === 401) { clearSession(); window.location.href = "/login"; }
    return;
  }
  const body = await res.json().catch(() => ({}));
  const grades = body?.data || [];

  // Merge fetched grades into periodGrades (replace entries for this task)
  const periodGrades = Array.isArray(ctx.state.data.periodGrades) ? ctx.state.data.periodGrades : [];
  const filtered = periodGrades.filter(g => g.task_id !== taskId);
  ctx.state.data.periodGrades = [...filtered, ...grades];

  if (updateList) {
    renderTaskGradeList(ctx, studentId);
  }

  // Fixed-student mode: auto-enter edit if grade exists, else creation
  if (studentId) {
    const existing = grades.find(g => g.student_id === studentId);
    if (existing) {
      ctx.elements.taskGradeScore.value = existing.score;
      ctx.elements.taskGradeSaveBtn.dataset.editId = existing.id;
      ctx.elements.taskGradeSaveBtn.textContent = "Actualizar";
    } else {
      ctx.elements.taskGradeScore.value = "";
      ctx.elements.taskGradeSaveBtn.dataset.editId = "";
      ctx.elements.taskGradeSaveBtn.textContent = "Guardar";
    }
  }
}

function renderTaskGradeList(ctx, studentId) {
  const periodGrades = Array.isArray(ctx.state.data.periodGrades) ? ctx.state.data.periodGrades : [];

  const allTasksRaw = [
    ...(Array.isArray(ctx.state.data.weekTasks) ? ctx.state.data.weekTasks : []),
    ...(Array.isArray(ctx.state.data.tasks) ? ctx.state.data.tasks : []),
  ];
  const taskTitleMap   = new Map(allTasksRaw.map(t => [t.id, t.title]));
  const taskSubjectMap = new Map(allTasksRaw.map(t => [t.id, t.subjectName || ""]));
  const taskTypeMap    = new Map(allTasksRaw.map(t => [t.id, t.type || ""]));

  // Bug 1+3: filter by task TYPE of the active task, not by weekTaskIds
  // (weekTaskIds mixed exam/work; grades from previous weeks are also valid)
  const activeTask     = allTasksRaw.find(t => t.id === ctx.state.activeTaskId);
  const activeTaskType = activeTask?.type || "";

  const grades = studentId
    ? periodGrades.filter(g =>
        g.student_id === studentId &&
        (!activeTaskType || taskTypeMap.get(g.task_id) === activeTaskType)
      )
    : periodGrades.filter(g => g.task_id === ctx.state.activeTaskId);

  const studentsRaw = Array.isArray(ctx.state.data.students) ? ctx.state.data.students : [];
  const studentsById = new Map(studentsRaw.map(s => [s.id, normalizeStudent(s)]));

  ctx.elements.taskGradeList.innerHTML = "";
  grades.forEach(grade => {
    const taskTitle = taskTitleMap.get(grade.task_id) || grade.title || "—";
    const subject = taskSubjectMap.get(grade.task_id) || "";
    const subtitle = studentId
      ? grade.date
      : `${formatStudentName(studentsById.get(grade.student_id)) || "Alumno"} · ${grade.date}`;
    const li = document.createElement("li");
    li.className = "attachmentItem";
    li.innerHTML = `
      <div class="tgGradeScore">${escapeHtml(grade.score)}</div>
      <div class="attachmentInfo">
        ${subject ? `<div class="tgGradeSubject">${escapeHtml(subject)}</div>` : ""}
        <div class="tgGradeTitle">${escapeHtml(taskTitle)}</div>
        <div class="tgGradeDate">${escapeHtml(subtitle)}</div>
      </div>
      <div class="attachmentActions">
        <button class="btn ghost" style="font-size:11px;padding:4px 8px"
          data-grade-action="edit"
          data-grade-id="${grade.id}"
          data-task-id="${grade.task_id}"
          data-student-id="${grade.student_id}"
          data-score="${escapeHtml(grade.score)}"
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

  const studentId = ctx.state.activeGradeStudentId || ctx.elements.taskGradeStudent.value;
  const score = ctx.elements.taskGradeScore.value.trim().replace(",", ".");
  if (!studentId || !score) return;

  const allTasks = [
    ...(Array.isArray(ctx.state.data.weekTasks) ? ctx.state.data.weekTasks : []),
    ...(Array.isArray(ctx.state.data.tasks) ? ctx.state.data.tasks : []),
  ];
  const task = allTasks.find(t => t.id === taskId);
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
      if (res.status === 401) { clearSession(); window.location.href = "/login"; return; }
      return;
    }
  } finally {
    btn.disabled = false;
  }

  ctx.elements.taskGradeScore.value = "";
  ctx.elements.taskGradeSaveBtn.dataset.editId = "";
  ctx.elements.taskGradeSaveBtn.textContent = "Guardar";
  await loadAndRenderTaskGrades(ctx, taskId, ctx.state.activeGradeStudentId || null);
  ctx.refreshNotebookForActiveGroup?.();
}

export async function handleTaskGradeListClick(ctx, event) {
  const taskId = ctx.state.activeTaskId;
  if (!taskId) return;

  const editBtn = event.target.closest("[data-grade-action='edit']");
  if (editBtn) {
    // Bug 2: switch activeTaskId to the grade's own task, not the selector's current value
    const gradeTaskId = editBtn.dataset.taskId;
    if (gradeTaskId) {
      ctx.state.activeTaskId = gradeTaskId;
      const opt = ctx.elements.taskGradeTaskSelect?.querySelector(`option[value="${gradeTaskId}"]`);
      if (opt && ctx.elements.taskGradeTaskSelect) ctx.elements.taskGradeTaskSelect.value = gradeTaskId;
    }
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
    if (res.status === 401) { clearSession(); window.location.href = "/login"; }
    return;
  }
  await loadAndRenderTaskGrades(ctx, taskId, ctx.state.activeGradeStudentId || null);
  ctx.refreshNotebookForActiveGroup?.();
}
