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

function fmtTime(secs) {
  if (!secs) return "—";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}min`;
  return `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? `${mins % 60}min` : ""}`.trim();
}

function badgeEl(estadoInfo) {
  if (estadoInfo.type === "needs_help") {
    const b = document.createElement("button");
    b.className = "nb-ticket-badge needs-help";
    b.type = "button";
    b.textContent = "Necesita ayuda";
    if (estadoInfo.ticketId) b.dataset.ticketId = estadoInfo.ticketId;
    return b;
  }
  const b = document.createElement("span");
  b.className = `nb-ticket-badge ${estadoInfo.type === "al_dia" ? "al-dia" : "pending"}`;
  b.textContent = estadoInfo.type === "al_dia" ? "Al día" : "Pendiente";
  return b;
}

function buildStudentCard(student, stats, sessionStats, cardGrades, estadoInfo, groupId) {
  const studentId = String(student?.id || "").trim();
  const card = document.createElement("div");
  card.className = "nbStudentCard";
  card.dataset.studentId = studentId;

  const head = document.createElement("div");
  head.className = "nbStudentCardHead";
  const nameEl = document.createElement("span");
  nameEl.className = "nbStudentName";
  nameEl.textContent = formatStudentName(student) || "Sin nombre";
  head.appendChild(nameEl);
  head.appendChild(badgeEl(estadoInfo));
  card.appendChild(head);

  const statGrid = document.createElement("div");
  statGrid.className = "nbStudentCardStats";

  const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  const statsData = [
    ["Tareas", `${stats.done}/${stats.total} (${pct}%)`],
    ["Resolvió solo", String(sessionStats.solvedAlone)],
    ["Necesitó ayuda", String(sessionStats.neededHelp)],
    ["Tiempo tutor", fmtTime(sessionStats.totalSecs)],
    ["Tiempo medio", sessionStats.sessionDays > 0 ? fmtTime(Math.round(sessionStats.totalSecs / sessionStats.sessionDays)) : "—"],
  ];
  statsData.forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "nbStatItem";
    item.innerHTML = `<span class="nbStatLabel">${label}</span><span class="nbStatValue">${value}</span>`;
    statGrid.appendChild(item);
  });
  card.appendChild(statGrid);

  ["exam", "work"].forEach(type => {
    const typeLabel = type === "exam" ? "Exámenes" : "Trabajos";
    const typeGrades = cardGrades.filter(g => g._taskType === type);
    const block = document.createElement("div");
    block.className = "nbGradeBlock";
    block.innerHTML = `<span class="nbGradeBlockLabel">${typeLabel}</span>`;
    const tags = document.createElement("div");
    tags.className = "nbGradeTags";
    if (typeGrades.length) {
      typeGrades.forEach(g => {
        const tag = document.createElement("span");
        tag.className = "nbGradeTag";
        tag.textContent = `${g._taskTitle || g.title}: ${g.score}`;
        tags.appendChild(tag);
      });
    } else {
      const empty = document.createElement("span");
      empty.className = "nbGradeTag nbGradeTag--empty";
      empty.textContent = "sin notas";
      tags.appendChild(empty);
    }
    block.appendChild(tags);
    card.appendChild(block);
  });

  const actions = document.createElement("div");
  actions.className = "nbStudentCardActions";
  actions.innerHTML = `
    <button class="btn copper-chip nbBtn" data-nb-action="generate-report" data-student-id="${studentId}" data-group-id="${groupId}" type="button">Generar informe IA</button>
    <button class="btn ghost nbBtn" data-nb-action="detail" data-student-id="${studentId}" type="button">Detalle</button>
  `;
  card.appendChild(actions);

  const reportArea = document.createElement("div");
  reportArea.className = "nbReportArea";
  reportArea.id = `nbReport_${studentId}`;
  reportArea.style.display = "none";
  card.appendChild(reportArea);

  return card;
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
  // sessionMap: student_id::session_date → total seconds (for weekly TUTOR column)
  const sessionMap = new Map();
  // taskDurationMap: student_id::session_date::task_id → total seconds (for per-dot time)
  const taskDurationMap = new Map();
  // latestSessionMap: student_id::session_date::task_id → most recent session (for dot color)
  const latestSessionMap = new Map();
  sessions.forEach(s => {
    const dayKey = `${s.student_id}::${s.session_date}`;
    sessionMap.set(dayKey, (sessionMap.get(dayKey) || 0) + s.duration_seconds);
    const taskKey = `${s.student_id}::${s.session_date}::${s.task_id}`;
    taskDurationMap.set(taskKey, (taskDurationMap.get(taskKey) || 0) + s.duration_seconds);
    const prev = latestSessionMap.get(taskKey);
    if (!prev || (s.created_at && s.created_at > prev.created_at)) {
      latestSessionMap.set(taskKey, { needs_help: s.needs_help, created_at: s.created_at || "" });
    }
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

        const dayTicket = allTickets
          .filter(t => t.studentId === student.id && t.status === "open" && t.groupId === groupId)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
        dayTasks.forEach(task => {
          const taskKey = `${student.id}::${dayKey}::${task.id}`;
          const latestSession = latestSessionMap.get(taskKey);
          const taskSecs = taskDurationMap.get(taskKey) || 0;
          const status = getStudentTaskStatus(ctx, task.id, student.id);
          const dotColor = latestSession
            ? (latestSession.needs_help ? "needs" : "done")
            : (status === "done" ? "done" : status === "needs_teacher" ? "needs" : "pending");
          if (dotColor === "done") weekDone++;

          const dotRow = document.createElement("div");
          dotRow.className = "nbDotRow";

          const dot = document.createElement("span");
          dot.className = `nbDot nbDot--${dotColor}`;
          dot.title = task.title;
          if (dotColor === "needs" || dotColor === "done") {
            dot.classList.add("nbDot--clickable");
            dot.dataset.studentId = String(student.id);
            dot.dataset.dayKey = dayKey;
            dot.dataset.taskTitle = task.title || "";
            if (dotColor === "done") dot.dataset.mode = "readonly";
            if (dayTicket) dot.dataset.ticketId = dayTicket.id;
          }
          dotRow.appendChild(dot);

          if (taskSecs > 0) {
            const timeEl = document.createElement("span");
            timeEl.className = "nbDotTime";
            timeEl.textContent = taskSecs < 60 ? "< 1min" : `${Math.round(taskSecs / 60)}min`;
            dotRow.appendChild(timeEl);
          }

          dots.appendChild(dotRow);
        });
        cell.appendChild(dots);

        const daySecs = sessionMap.get(`${student.id}::${dayKey}`) || 0;
        if (daySecs > 0) weekSessionSecs += daySecs;
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
    ctx.elements.notebookGrid.classList.remove("is-cards");
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
    const sid = String(s.student_id || s.studentId || s.id || "").trim();
    const sname = String(s.name || s.display_name || s.student_name || "").trim();
    const normalized = normalizeStudent({
      id: sid, name: sname,
      tasks_total: asCount(s.tasks_total), tasks_done: asCount(s.tasks_done),
      tickets_open: asCount(s.tickets_open), tickets_closed: asCount(s.tickets_closed),
      status: s.status || "ok",
    });
    if (sid) summaryById.set(sid, normalized);
    const key = studentNameKey(normalized);
    if (key) summaryByName.set(key, normalized);
  });

  const studentsRaw = Array.isArray(ctx.state.data.students) ? ctx.state.data.students : [];
  const fallbackStudents = studentsRaw
    .filter(s => s.tenantId === ctx.state.tenantId && s.groupId === groupId)
    .map(s => normalizeStudent(s))
    .sort(compareBySurname);
  const students = fallbackStudents.length
    ? fallbackStudents
    : Array.from(summaryById.values()).sort(compareBySurname);

  ctx.elements.notebookEmpty.style.display = students.length ? "none" : "block";
  ctx.elements.notebookGrid.innerHTML = "";
  ctx.elements.notebookGrid.classList.add("is-cards");
  if (!students.length) return;

  const months = buildMonthOptionsForGroup(ctx, groupId);
  if (!ctx.state.notebookMonth) ctx.state.notebookMonth = months[months.length - 1];
  if (!ctx.state.notebookTerm) ctx.state.notebookTerm = termKeyFromMonthKey(ctx.state.notebookMonth);

  if (ctx.elements.notebookMonth) {
    ctx.elements.notebookMonth.innerHTML = "";
    months.forEach(ym => {
      const opt = document.createElement("option");
      opt.value = ym; opt.textContent = ym;
      ctx.elements.notebookMonth.appendChild(opt);
    });
    ctx.elements.notebookMonth.value = ctx.state.notebookMonth;
  }
  if (ctx.elements.notebookTerm) ctx.elements.notebookTerm.value = ctx.state.notebookTerm;

  const periodValue = (mode === "month") ? ctx.state.notebookMonth : ctx.state.notebookTerm;
  const tasksRaw = Array.isArray(ctx.state.data.tasks) ? ctx.state.data.tasks : [];
  const periodTasks = tasksRaw
    .filter(t => t.groupId === groupId && t.tenantId === ctx.state.tenantId)
    .filter(t => taskMatchesPeriod(t, mode, periodValue));
  const taskTypeMap = new Map(tasksRaw.map(t => [t.id, t.type]));
  const taskTitleMap = new Map(tasksRaw.map(t => [t.id, t.title]));

  // Session stats per student
  const sessions = Array.isArray(ctx.state.data.tutorSessions) ? ctx.state.data.tutorSessions : [];
  const sessionsByStudent = new Map();
  sessions.forEach(s => {
    if (!sessionsByStudent.has(s.student_id)) sessionsByStudent.set(s.student_id, []);
    sessionsByStudent.get(s.student_id).push(s);
  });

  // Grades per student
  const periodGrades = Array.isArray(ctx.state.data.periodGrades) ? ctx.state.data.periodGrades : [];
  const gradesByStudent = new Map();
  periodGrades.forEach(g => {
    if (!gradesByStudent.has(g.student_id)) gradesByStudent.set(g.student_id, []);
    gradesByStudent.get(g.student_id).push({
      ...g,
      _taskType: taskTypeMap.get(g.task_id) || "other",
      _taskTitle: taskTitleMap.get(g.task_id) || "",
    });
  });

  const allTickets = Array.isArray(ctx.state.data.tickets) ? ctx.state.data.tickets : [];

  students.forEach(student => {
    const summaryMatch = summaryById.get(String(student.id || "").trim()) || summaryByName.get(studentNameKey(student));
    let stats = { total: asCount(summaryMatch?.tasks_total), done: asCount(summaryMatch?.tasks_done), needs: asCount(summaryMatch?.tickets_open) };
    if (!summaryMatch) {
      stats = { total: periodTasks.length, done: 0, needs: 0 };
      periodTasks.forEach(task => {
        const status = getStudentTaskStatus(ctx, task.id, student.id);
        if (status === "done") stats.done++;
        else if (status === "needs_teacher") stats.needs++;
      });
    }

    const stuSessions = sessionsByStudent.get(student.id) || [];
    const latestByTask = new Map();
    stuSessions.forEach(s => {
      const prev = latestByTask.get(s.task_id);
      if (!prev || s.created_at > prev.created_at) latestByTask.set(s.task_id, s);
    });
    const sessionDays = new Set(stuSessions.map(s => s.session_date)).size;
    const sessionStats = {
      totalSecs: stuSessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0),
      solvedAlone: [...latestByTask.values()].filter(s => !s.needs_help).length,
      neededHelp: [...latestByTask.values()].filter(s => s.needs_help).length,
      sessionDays,
    };

    const openTickets = allTickets
      .filter(t => t.studentId === student.id && t.status === "open" && t.groupId === groupId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    let estadoInfo;
    if (stats.needs > 0 || openTickets.length > 0) estadoInfo = { type: "needs_help", ticketId: openTickets[0]?.id || "" };
    else if (summaryMatch?.status === "submitted" || (stats.total > 0 && stats.done >= stats.total)) estadoInfo = { type: "al_dia" };
    else estadoInfo = { type: "pending" };

    const card = buildStudentCard(student, stats, sessionStats, gradesByStudent.get(student.id) || [], estadoInfo, groupId);
    ctx.elements.notebookGrid.appendChild(card);
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
