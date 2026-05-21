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

function buildNotebookRow(student, stats, estadoInfo) {
  const studentId = String(student?.id || "").trim();
  const rowEl = document.createElement("div");
  rowEl.className = "nbRow";
  rowEl.dataset.studentId = studentId;

  const nameCell = document.createElement("div");
  nameCell.className = "nbCell nbName";
  nameCell.textContent = formatStudentName(student) || "Sin nombre";

  const estadoCell = document.createElement("div");
  estadoCell.className = "nbCell nbEstado";
  if (estadoInfo.type === "needs_help") {
    const badge = document.createElement("button");
    badge.className = "nb-ticket-badge needs-help";
    badge.type = "button";
    badge.textContent = "Necesita ayuda";
    if (estadoInfo.ticketId) badge.dataset.ticketId = estadoInfo.ticketId;
    estadoCell.appendChild(badge);
  } else if (estadoInfo.type === "al_dia") {
    const badge = document.createElement("span");
    badge.className = "nb-ticket-badge al-dia";
    badge.textContent = "Al día";
    estadoCell.appendChild(badge);
  } else {
    const badge = document.createElement("span");
    badge.className = "nb-ticket-badge pending";
    badge.textContent = "Pendiente";
    estadoCell.appendChild(badge);
  }

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

  rowEl.append(nameCell, estadoCell, gradesCell, doneTotalCell, needsCell, pendingCell, actionsCell);
  return rowEl;
}

function formatYMDLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekDays(offsetWeeks) {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday + offsetWeeks * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function renderNotebookWeek(ctx) {
  const groupId = ctx.state.currentGroupId;
  const offset = ctx.state.notebookWeekOffset || 0;
  const days = getWeekDays(offset);
  const dayKeys = days.map(formatYMDLocal);
  const DAY_LABELS = ["L", "M", "X", "J", "V"];

  if (ctx.elements.notebookWeekLabel) {
    const from = days[0];
    const to = days[4];
    const fmtDay = (d) => d.getDate();
    const fmtMon = (d) => d.toLocaleDateString("es-ES", { month: "short" });
    ctx.elements.notebookWeekLabel.textContent =
      `${fmtDay(from)} ${fmtMon(from)} – ${fmtDay(to)} ${fmtMon(to)}`;
  }

  const tasksRaw = Array.isArray(ctx.state.data.tasks) ? ctx.state.data.tasks : [];
  const tasksByDay = Object.fromEntries(dayKeys.map(k => [k, []]));
  tasksRaw.forEach(task => {
    if (task.groupId !== groupId || task.tenantId !== ctx.state.tenantId) return;
    if (tasksByDay[task.dueDate]) tasksByDay[task.dueDate].push(task);
  });

  const sessions = Array.isArray(ctx.state.data.tutorSessions) ? ctx.state.data.tutorSessions : [];
  const sessionMap = new Map();
  const needsHelpMap = new Map();
  sessions.forEach(s => {
    const key = `${s.student_id}::${s.session_date}`;
    sessionMap.set(key, (sessionMap.get(key) || 0) + s.duration_seconds);
    if (s.needs_help) needsHelpMap.set(key, true);
  });
  const allTickets = Array.isArray(ctx.state.data.tickets) ? ctx.state.data.tickets : [];

  const studentsRaw = Array.isArray(ctx.state.data.students) ? ctx.state.data.students : [];
  const students = studentsRaw
    .filter(s => s.tenantId === ctx.state.tenantId && s.groupId === groupId)
    .map(s => normalizeStudent(s))
    .sort(compareBySurname);

  ctx.elements.notebookGrid.innerHTML = "";
  ctx.elements.notebookEmpty.style.display = students.length ? "none" : "block";
  if (!students.length) return;

  // Header
  const head = document.createElement("div");
  head.className = "nbRow nbHead nbRowWeek";
  ["Alumno", ...DAY_LABELS, "Total", "Tutor"].forEach((label, i) => {
    const cell = document.createElement("div");
    cell.className = `nbCell${i === 0 ? " nbName" : " center"}`;
    cell.textContent = label;
    head.appendChild(cell);
  });
  ctx.elements.notebookGrid.appendChild(head);

  // Rows
  students.forEach(student => {
    const row = document.createElement("div");
    row.className = "nbRow nbRowWeek";
    row.dataset.studentId = String(student.id || "");

    const nameCell = document.createElement("div");
    nameCell.className = "nbCell nbName";
    nameCell.textContent = formatStudentName(student) || "Sin nombre";
    row.appendChild(nameCell);

    let weekDone = 0;
    let weekTotal = 0;
    let weekSessionSecs = 0;

    dayKeys.forEach(dayKey => {
      const cell = document.createElement("div");
      cell.className = "nbCell center nbDayCell";

      const dayTasks = tasksByDay[dayKey];
      if (dayTasks.length > 0) {
        weekTotal += dayTasks.length;
        const dots = document.createElement("div");
        dots.className = "nbDots";

        const lookupKey = `${student.id}::${dayKey}`;
        const dayNeedsHelp = needsHelpMap.get(lookupKey) || false;
        const dayTicket = allTickets
          .filter(t => t.studentId === student.id && t.status === "open" && t.groupId === groupId)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
        dayTasks.forEach(task => {
          const status = getStudentTaskStatus(ctx, task.id, student.id);
          const dotColor = dayNeedsHelp ? "needs" : status === "done" ? "done" : status === "needs_teacher" ? "needs" : "pending";
          const dot = document.createElement("span");
          dot.className = `nbDot nbDot--${dotColor}`;
          dot.title = task.title;
          if (status === "done") weekDone++;
          if (dotColor === "needs" || dotColor === "done") {
            dot.classList.add("nbDot--clickable");
            dot.dataset.studentId = String(student.id);
            dot.dataset.dayKey = dayKey;
            dot.dataset.taskTitle = task.title || "";
            if (dotColor === "done") dot.dataset.mode = "readonly";
            if (dayTicket) dot.dataset.ticketId = dayTicket.id;
          }
          dots.appendChild(dot);
        });
        cell.appendChild(dots);

        const daySecs = sessionMap.get(`${student.id}::${dayKey}`) || 0;
        if (daySecs > 0) {
          weekSessionSecs += daySecs;
          const timeEl = document.createElement("div");
          timeEl.className = "nbSessionTime";
          timeEl.textContent = `${Math.round(daySecs / 60)} min`;
          cell.appendChild(timeEl);
        }
      }

      row.appendChild(cell);
    });

    // Total
    const totalCell = document.createElement("div");
    totalCell.className = "nbCell center";
    const strong = document.createElement("strong");
    strong.textContent = String(weekDone);
    totalCell.append(strong, `/${weekTotal}`);
    row.appendChild(totalCell);

    // Tutor time
    const tutorCell = document.createElement("div");
    tutorCell.className = "nbCell center";
    if (weekSessionSecs > 0) {
      const mins = Math.round(weekSessionSecs / 60);
      tutorCell.textContent = mins >= 60
        ? `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? `${mins % 60}min` : ""}`.trim()
        : `${mins}min`;
    } else {
      tutorCell.textContent = "—";
    }
    row.appendChild(tutorCell);

    ctx.elements.notebookGrid.appendChild(row);
  });
}

export function renderNotebook(ctx) {
  if (!ctx.elements.notebookGrid) return;

  const mode = ctx.state.notebookMode || "month";
  if (ctx.elements.notebookMode) ctx.elements.notebookMode.value = mode;
  if (ctx.elements.notebookMonthWrap) ctx.elements.notebookMonthWrap.style.display = mode === "month" ? "flex" : "none";
  if (ctx.elements.notebookTermWrap) ctx.elements.notebookTermWrap.style.display = mode === "term" ? "flex" : "none";
  if (ctx.elements.notebookWeekNav) ctx.elements.notebookWeekNav.style.display = mode === "week" ? "flex" : "none";

  if (mode === "week") {
    renderNotebookWeek(ctx);
    return;
  }

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

  if (ctx.elements.notebookTerm) ctx.elements.notebookTerm.value = ctx.state.notebookTerm;

  const head = document.createElement("div");
  head.className = "nbRow nbHead";
  head.innerHTML = `
    <div class="nbCell nbName">Alumno</div>
    <div class="nbCell nbEstado">Estado</div>
    <div class="nbCell nbGrades">Notas</div>
    <div class="nbCell center">Hechas/Total</div>
    <div class="nbCell center">Necesita</div>
    <div class="nbCell center">Pendiente</div>
    <div class="nbCell nbActions">Detalle</div>
  `;
  ctx.elements.notebookGrid.appendChild(head);

  const periodValue = (mode === "month") ? ctx.state.notebookMonth : ctx.state.notebookTerm;
  const tasksRaw = Array.isArray(ctx.state.data.tasks) ? ctx.state.data.tasks : [];
  const periodTasks = tasksRaw
    .filter(task => task.groupId === groupId)
    .filter(task => task.tenantId === ctx.state.tenantId)
    .filter(task => taskMatchesPeriod(task, mode, periodValue));

  const allTickets = Array.isArray(ctx.state.data.tickets) ? ctx.state.data.tickets : [];

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

    const openTickets = allTickets
      .filter(t => t.studentId === student.id && t.status === "open" && t.groupId === groupId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    let estadoInfo;
    if (stats.needs > 0 || openTickets.length > 0) {
      estadoInfo = { type: "needs_help", ticketId: openTickets[0]?.id || "" };
    } else if (summaryMatch?.status === "submitted" || (stats.total > 0 && stats.done >= stats.total)) {
      estadoInfo = { type: "al_dia" };
    } else {
      estadoInfo = { type: "pending" };
    }

    const rowEl = buildNotebookRow(student, stats, estadoInfo);
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
