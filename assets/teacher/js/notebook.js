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
  const tasks = Array.isArray(ctx.state.data.tasks) ? ctx.state.data.tasks : [];
  tasks.forEach(task => {
    if (task.groupId !== groupId) return;
    if (task.tenantId !== ctx.state.tenantId) return;
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
  const map = ctx.state.data.taskStatus?.[ctx.state.currentTeacherId]?.[taskId];
  const v = map?.[studentId];
  return v || "pending";
}

export function setStudentTaskStatus(ctx, taskId, studentId, status) {
  ctx.state.data.taskStatus = ctx.state.data.taskStatus || {};
  ctx.state.data.taskStatus[ctx.state.currentTeacherId] = ctx.state.data.taskStatus[ctx.state.currentTeacherId] || {};
  ctx.state.data.taskStatus[ctx.state.currentTeacherId][taskId] = ctx.state.data.taskStatus[ctx.state.currentTeacherId][taskId] || {};
  ctx.state.data.taskStatus[ctx.state.currentTeacherId][taskId][studentId] = status;
}

function asCount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function studentNameKey(student) {
  return String(formatStudentName(normalizeStudent(student)) || "")
    .trim()
    .toLowerCase();
}

function buildNotebookRow(student, stats) {
  const studentId = String(student?.id || "").trim();
  const rowEl = document.createElement("div");
  rowEl.className = "nbRow";
  rowEl.dataset.studentId = studentId;

  const nameCell = document.createElement("div");
  nameCell.className = "nbCell nbName";
  nameCell.textContent = formatStudentName(student) || "Sin nombre";

  const gradesCell = document.createElement("div");
  gradesCell.className = "nbCell nbGrades";
  const gradesBtn = document.createElement("button");
  gradesBtn.className = "btn nbBtn copper-chip";
  gradesBtn.dataset.nbAction = "grades";
  gradesBtn.dataset.studentId = studentId;
  gradesBtn.type = "button";
  gradesBtn.textContent = "Ver / añadir";
  gradesBtn.disabled = !studentId;
  gradesCell.appendChild(gradesBtn);

  const doneTotalCell = document.createElement("div");
  doneTotalCell.className = "nbCell center";
  const strong = document.createElement("strong");
  strong.textContent = String(stats.done);
  doneTotalCell.append(strong, ` / ${stats.total}`);

  const needsCell = document.createElement("div");
  needsCell.className = "nbCell center";
  needsCell.textContent = String(stats.needs);

  const pendingCell = document.createElement("div");
  pendingCell.className = "nbCell center";
  pendingCell.textContent = String(stats.pending);

  const actionsCell = document.createElement("div");
  actionsCell.className = "nbCell nbActions";
  const detailBtn = document.createElement("button");
  detailBtn.className = "btn nbBtn copper-cta";
  detailBtn.dataset.nbAction = "detail";
  detailBtn.dataset.studentId = studentId;
  detailBtn.type = "button";
  detailBtn.textContent = "Detalle";
  detailBtn.disabled = !studentId;
  actionsCell.appendChild(detailBtn);

  rowEl.append(nameCell, gradesCell, doneTotalCell, needsCell, pendingCell, actionsCell);
  return rowEl;
}

export function renderNotebook(ctx) {
  if (!ctx.elements.notebookGrid) return;

  const groupId = ctx.state.currentGroupId;
  const summary = ctx.state.data.notebookSummary;
  const summaryValid = summary?.group_id && summary.group_id === groupId;
  const summaryRows = summaryValid && Array.isArray(summary?.students) ? summary.students : [];
  const summaryById = new Map();
  const summaryByName = new Map();
  summaryRows.forEach((s) => {
    if (!s || typeof s !== "object") return;
    const summaryStudentId = String(s.student_id || s.studentId || s.id || "").trim();
    const summaryName = String(s.name || s.display_name || s.student_name || "").trim();
    const normalized = normalizeStudent({
      id: summaryStudentId,
      name: summaryName,
      tasks_total: asCount(s.tasks_total),
      tasks_done: asCount(s.tasks_done),
      tickets_open: asCount(s.tickets_open),
      tickets_closed: asCount(s.tickets_closed),
      status: s.status || "ok",
    });
    if (summaryStudentId) summaryById.set(summaryStudentId, normalized);
    const key = studentNameKey(normalized);
    if (key) summaryByName.set(key, normalized);
  });

  const studentsRaw = Array.isArray(ctx.state.data.students) ? ctx.state.data.students : [];
  const fallbackStudents = studentsRaw
    .filter(student => student.tenantId === ctx.state.tenantId && student.groupId === groupId)
    .map(student => normalizeStudent(student))
    .sort(compareBySurname);

  const students = fallbackStudents.length
    ? fallbackStudents
    : Array.from(summaryById.values()).sort(compareBySurname);

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
  const tasksRaw = Array.isArray(ctx.state.data.tasks) ? ctx.state.data.tasks : [];
  const periodTasks = tasksRaw
    .filter(task => task.groupId === groupId)
    .filter(task => task.tenantId === ctx.state.tenantId)
    .filter(task => taskMatchesPeriod(task, mode, periodValue));

  students.forEach(student => {
    const summaryMatch = summaryById.get(String(student.id || "").trim()) || summaryByName.get(studentNameKey(student));
    let stats = {
      total: asCount(summaryMatch?.tasks_total),
      done: asCount(summaryMatch?.tasks_done),
      needs: asCount(summaryMatch?.tickets_open),
      pending: 0,
    };
    stats.pending = stats.total > stats.done ? stats.total - stats.done : 0;

    if (!summaryMatch) {
      stats = { total: periodTasks.length, done: 0, needs: 0, pending: 0 };
      periodTasks.forEach(task => {
        const status = getStudentTaskStatus(ctx, task.id, student.id);
        if (status === "done") stats.done++;
        else if (status === "needs_teacher") stats.needs++;
        else stats.pending++;
      });
    }

    const rowEl = buildNotebookRow(student, stats);
    ctx.elements.notebookGrid.appendChild(rowEl);
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
    .filter(task => task.tenantId === ctx.state.tenantId)
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
  const list = ctx.state.data.grades?.[ctx.state.currentTeacherId]?.[studentId] || [];
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
