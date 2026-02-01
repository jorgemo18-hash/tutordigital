import { compareBySurname, normalizeStudent, formatStudentName, TYPE_LABELS } from "./state.js";
import { formatDate } from "./utils.js";
import { setOverlay } from "./dom.js";

export function monthKey(dateStr) {
  return String(dateStr || "").slice(0, 7);
}

export function termKeyFromMonthKey(ym) {
  const m = Number(String(ym).slice(5, 7));
  if (m >= 9 && m <= 12) return "t1";
  if (m >= 1 && m <= 3) return "t2";
  if (m >= 4 && m <= 6) return "t3";
  return "t3";
}

export function buildMonthOptionsForGroup(ctx, groupId) {
  const set = new Set();
  ctx.state.data.tasks.forEach(task => {
    if (task.groupId !== groupId) return;
    set.add(monthKey(task.dueDate));
  });
  if (!set.size) {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    set.add(ym);
  }
  return Array.from(set).sort();
}

export function taskMatchesPeriod(task, mode, value) {
  if (!task || !task.dueDate) return false;
  const ym = monthKey(task.dueDate);
  if (mode === "month") return ym === value;
  const tk = termKeyFromMonthKey(ym);
  return tk === value;
}

export function getStudentTaskStatus(ctx, taskId, studentId) {
  const map = ctx.state.data.taskStatus?.[taskId];
  const v = map?.[studentId];
  return v || "pending";
}

export function setStudentTaskStatus(ctx, taskId, studentId, status) {
  ctx.state.data.taskStatus = ctx.state.data.taskStatus || {};
  ctx.state.data.taskStatus[taskId] = ctx.state.data.taskStatus[taskId] || {};
  ctx.state.data.taskStatus[taskId][studentId] = status;
}

export function renderNotebook(ctx) {
  if (!ctx.elements.notebookGrid) return;

  const groupId = ctx.state.currentGroupId;
  const students = ctx.state.data.students
    .filter(student => student.groupId === groupId)
    .map(student => normalizeStudent(student))
    .sort(compareBySurname);

  ctx.elements.notebookEmpty.style.display = students.length ? "none" : "block";
  ctx.elements.notebookGrid.innerHTML = "";
  if (!students.length) return;

  const months = buildMonthOptionsForGroup(ctx, groupId);
  if (!ctx.state.notebookMonth) ctx.state.notebookMonth = months[months.length - 1];
  if (!ctx.state.notebookTerm) ctx.state.notebookTerm = termKeyFromMonthKey(ctx.state.notebookMonth);

  if (ctx.elements.notebookMonth) {
    ctx.elements.notebookMonth.innerHTML = "";
    months.forEach(ym => {
      const opt = document.createElement("option");
      opt.value = ym;
      opt.textContent = ym;
      ctx.elements.notebookMonth.appendChild(opt);
    });
    ctx.elements.notebookMonth.value = ctx.state.notebookMonth;
  }

  if (ctx.elements.notebookMode) ctx.elements.notebookMode.value = ctx.state.notebookMode;
  if (ctx.elements.notebookTerm) ctx.elements.notebookTerm.value = ctx.state.notebookTerm;

  if (ctx.elements.notebookMonthWrap && ctx.elements.notebookTermWrap) {
    ctx.elements.notebookMonthWrap.style.display = (ctx.state.notebookMode === "month") ? "flex" : "none";
    ctx.elements.notebookTermWrap.style.display = (ctx.state.notebookMode === "term") ? "flex" : "none";
  }

  const head = document.createElement("div");
  head.className = "nbRow nbHead";
  head.innerHTML = `
    <div class="nbCell nbName">Alumno</div>
    <div class="nbCell nbGrades">Notas</div>
    <div class="nbCell center">Hechas/Total</div>
    <div class="nbCell center">Necesita</div>
    <div class="nbCell center">Pendiente</div>
    <div class="nbCell nbActions">Detalle</div>
  `;
  ctx.elements.notebookGrid.appendChild(head);

  const mode = ctx.state.notebookMode;
  const periodValue = (mode === "month") ? ctx.state.notebookMonth : ctx.state.notebookTerm;

  students.forEach(student => {
    const tasks = ctx.state.data.tasks
      .filter(task => task.groupId === groupId)
      .filter(task => taskMatchesPeriod(task, mode, periodValue));

    let total = tasks.length;
    let done = 0;
    let needs = 0;
    let pending = 0;

    tasks.forEach(task => {
      const status = getStudentTaskStatus(ctx, task.id, student.id);
      if (status === "done") done++;
      else if (status === "needs_teacher") needs++;
      else pending++;
    });

    const row = document.createElement("div");
    row.className = "nbRow";
    row.dataset.studentId = student.id;
    row.innerHTML = `
      <div class="nbCell nbName">${formatStudentName(student)}</div>
      <div class="nbCell nbGrades">
        <button class="btn ghost nbBtn" data-nb-action="grades" data-student-id="${student.id}" type="button">Ver / añadir</button>
      </div>
      <div class="nbCell center"><strong>${done}</strong> / ${total}</div>
      <div class="nbCell center">${needs}</div>
      <div class="nbCell center">${pending}</div>
      <div class="nbCell nbActions">
        <button class="btn primary nbBtn" data-nb-action="detail" data-student-id="${student.id}" type="button">Detalle</button>
      </div>
    `;
    ctx.elements.notebookGrid.appendChild(row);
  });
}

export function openNotebookDetail(ctx, studentId) {
  const student = normalizeStudent(ctx.state.data.students.find(item => item.id === studentId));
  if (!student) return;

  const mode = ctx.state.notebookMode;
  const periodValue = (mode === "month") ? ctx.state.notebookMonth : ctx.state.notebookTerm;
  const label = (mode === "month") ? `Mes ${periodValue}` : `Trimestre ${String(periodValue).toUpperCase()}`;

  const groupId = ctx.state.currentGroupId;
  const tasks = ctx.state.data.tasks
    .filter(task => task.groupId === groupId)
    .filter(task => taskMatchesPeriod(task, mode, periodValue))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  ctx.elements.notebookDetailTitle.textContent = `${formatStudentName(student)} · ${label}`;

  if (!tasks.length) {
    ctx.elements.notebookDetailBody.innerHTML = "<div>No hay tareas en este periodo.</div>";
    setOverlay(ctx.elements.notebookDetailModal, true);
    ctx.state.activeNotebookStudentId = studentId;
    return;
  }

  const items = tasks.map(task => {
    const status = getStudentTaskStatus(ctx, task.id, studentId);
    const options = [
      { v: "pending", label: "Pendiente" },
      { v: "done", label: "Hecha" },
      { v: "needs_teacher", label: "Necesita profesor" }
    ].map(opt => `<option value="${opt.v}" ${opt.v === status ? "selected" : ""}>${opt.label}</option>`).join("");

    return `
      <div class="nbTaskRow">
        <div class="nbTaskInfo">
          <div class="nbTaskTitle">${task.title}</div>
          <div class="nbTaskMeta">${task.dueDate} · ${TYPE_LABELS[task.type] || "Tarea"}</div>
        </div>
        <select class="nbTaskSelect" data-task-id="${task.id}">
          ${options}
        </select>
      </div>
    `;
  }).join("");

  ctx.elements.notebookDetailBody.innerHTML = `<div class="nbTaskList">${items}</div>`;
  setOverlay(ctx.elements.notebookDetailModal, true);
  ctx.state.activeNotebookStudentId = studentId;
}

export function closeNotebookDetail(ctx) {
  setOverlay(ctx.elements.notebookDetailModal, false);
  ctx.state.activeNotebookStudentId = null;
}

export function openGradesModal(ctx, studentId) {
  const student = normalizeStudent(ctx.state.data.students.find(item => item.id === studentId));
  if (!student) return;

  ctx.elements.gradesTitle.textContent = `Notas · ${formatStudentName(student)}`;
  ctx.state.activeNotebookStudentId = studentId;

  try { ctx.elements.gradeForm.reset(); } catch {}
  ctx.elements.gradeDate.value = formatDate(new Date());

  renderGradeList(ctx, studentId);
  setOverlay(ctx.elements.gradesModal, true);
}

export function closeGradesModal(ctx) {
  setOverlay(ctx.elements.gradesModal, false);
  ctx.state.activeNotebookStudentId = null;
}

export function renderGradeList(ctx, studentId) {
  const list = ctx.state.data.grades?.[studentId] || [];
  ctx.elements.gradeList.innerHTML = "";
  list.forEach(grade => {
    const li = document.createElement("li");
    li.className = "attachmentItem";
    li.innerHTML = `
      <div class="attachmentInfo">
        <div class="attachmentName">${grade.title} · ${grade.score}</div>
        <div class="attachmentMeta">${grade.date}</div>
      </div>
      <button class="btn ghost" data-grade-id="${grade.id}" type="button">Borrar</button>
    `;
    ctx.elements.gradeList.appendChild(li);
  });
  ctx.elements.gradeEmpty.style.display = list.length ? "none" : "block";
}
}
