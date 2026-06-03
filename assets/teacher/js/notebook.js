import { compareBySurname, normalizeStudent, formatStudentName, TYPE_LABELS } from "./state.js";
import { formatDate, escapeHtml } from "./utils.js";
import { setOverlay } from "./dom.js";
import { renderPeriodStudentView, renderPeriodClassView } from "./notebook-cards.js";
import { renderNotebookWeek, getWeekDays, formatYMDLocal } from "./notebook-week.js";

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
    set.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
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
  return map?.[studentId] || "pending";
}

export function setStudentTaskStatus(ctx, taskId, studentId, status) {
  ctx.state.data.taskStatus = ctx.state.data.taskStatus || {};
  ctx.state.data.taskStatus[ctx.state.currentTeacherId] = ctx.state.data.taskStatus[ctx.state.currentTeacherId] || {};
  ctx.state.data.taskStatus[ctx.state.currentTeacherId][taskId] = ctx.state.data.taskStatus[ctx.state.currentTeacherId][taskId] || {};
  ctx.state.data.taskStatus[ctx.state.currentTeacherId][taskId][studentId] = status;
}

function updateNotebookControls(ctx, mode) {
  const el = ctx.elements;
  if (el.notebookMode) el.notebookMode.value = mode;
  if (el.notebookMonthWrap) el.notebookMonthWrap.style.display = mode === "month" ? "flex" : "none";
  if (el.notebookTermWrap) el.notebookTermWrap.style.display = mode === "term" ? "flex" : "none";
  if (el.notebookWeekNav) el.notebookWeekNav.style.display = mode === "week" ? "flex" : "none";
  if (el.notebookCustomWrap) el.notebookCustomWrap.style.display = mode === "custom" ? "flex" : "none";
  if (el.notebookViewWrap) el.notebookViewWrap.style.display = mode !== "week" ? "flex" : "none";
}

export function renderNotebook(ctx) {
  if (!ctx.elements.notebookGrid) return;

  const mode = ctx.state.notebookMode || "week";
  updateNotebookControls(ctx, mode);

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
  summaryRows.forEach(s => {
    if (!s || typeof s !== "object") return;
    const sid = String(s.student_id || s.studentId || s.id || "").trim();
    const norm = normalizeStudent({ id: sid, name: String(s.name || s.display_name || s.student_name || "").trim(),
      tasks_total: s.tasks_total, tasks_done: s.tasks_done,
      tickets_open: s.tickets_open, tickets_closed: s.tickets_closed, status: s.status || "ok" });
    if (sid) summaryById.set(sid, norm);
    const key = String(formatStudentName(norm) || "").trim().toLowerCase();
    if (key) summaryByName.set(key, norm);
  });

  const studentsRaw = Array.isArray(ctx.state.data.students) ? ctx.state.data.students : [];
  const allStudents = studentsRaw
    .filter(s => s.tenantId === ctx.state.tenantId && s.groupId === groupId)
    .map(s => normalizeStudent(s))
    .sort(compareBySurname);
  const students = allStudents.length
    ? allStudents
    : Array.from(summaryById.values()).sort(compareBySurname);

  ctx.elements.notebookEmpty.style.display = students.length ? "none" : "block";
  ctx.elements.notebookGrid.innerHTML = "";
  ctx.elements.notebookGrid.classList.add("is-cards");
  if (!students.length) return;

  if (mode === "month") {
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
  }
  if (mode === "term" && ctx.elements.notebookTerm) {
    ctx.elements.notebookTerm.value = ctx.state.notebookTerm;
  }

  const tasksRaw = Array.isArray(ctx.state.data.tasks) ? ctx.state.data.tasks : [];
  const subjectFilter = ctx.state.currentSubjectFilter || "";
  const groupTasks = tasksRaw
    .filter(t => t.groupId === groupId && t.tenantId === ctx.state.tenantId)
    .filter(t => !subjectFilter || (t.subjectName || "") === subjectFilter);
  let periodTasks;
  if (mode === "custom") {
    const { notebookCustomFrom: from, notebookCustomTo: to } = ctx.state;
    periodTasks = groupTasks.filter(t => t.dueDate >= from && t.dueDate <= to);
  } else {
    const periodValue = mode === "month" ? ctx.state.notebookMonth : ctx.state.notebookTerm;
    periodTasks = groupTasks.filter(t => taskMatchesPeriod(t, mode, periodValue));
  }

  const taskTypeMap = new Map(tasksRaw.map(t => [t.id, t.type]));
  const taskTitleMap = new Map(tasksRaw.map(t => [t.id, t.title]));
  const sessions = Array.isArray(ctx.state.data.tutorSessions) ? ctx.state.data.tutorSessions : [];
  const periodGrades = Array.isArray(ctx.state.data.periodGrades) ? ctx.state.data.periodGrades : [];
  const allTickets = Array.isArray(ctx.state.data.tickets) ? ctx.state.data.tickets : [];

  const viewMode = ctx.state.notebookViewMode || "student";
  if (ctx.elements.notebookViewMode) ctx.elements.notebookViewMode.value = viewMode;

  const shared = { students, summaryById, summaryByName, periodTasks, taskTypeMap, taskTitleMap, sessions, periodGrades, allTickets, groupId };
  if (viewMode === "class") {
    renderPeriodClassView(ctx, shared);
  } else {
    renderPeriodStudentView(ctx, shared);
  }
}

export function openNotebookDetail(ctx, studentId) {
  const student = normalizeStudent(ctx.state.data.students?.find(item => item.id === studentId));
  if (!student) return;

  const mode = ctx.state.notebookMode || "week";
  const groupId = ctx.state.currentGroupId;
  const tasksRaw = Array.isArray(ctx.state.data.tasks) ? ctx.state.data.tasks : [];
  const groupTasks = tasksRaw.filter(t => t.groupId === groupId && t.tenantId === ctx.state.tenantId);

  let periodTasks;
  if (mode === "custom") {
    const { notebookCustomFrom: from, notebookCustomTo: to } = ctx.state;
    periodTasks = groupTasks.filter(t => t.dueDate >= from && t.dueDate <= to);
  } else if (mode === "week") {
    const days = getWeekDays(ctx.state.notebookWeekOffset || 0);
    const dayKeys = new Set(days.map(formatYMDLocal));
    periodTasks = groupTasks.filter(t => dayKeys.has(t.dueDate));
  } else {
    const periodValue = mode === "month" ? ctx.state.notebookMonth : ctx.state.notebookTerm;
    periodTasks = groupTasks.filter(t => taskMatchesPeriod(t, mode, periodValue));
  }
  periodTasks = periodTasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const sessions = Array.isArray(ctx.state.data.tutorSessions) ? ctx.state.data.tutorSessions : [];
  const latestByTask = new Map();
  sessions.filter(s => s.student_id === studentId).forEach(s => {
    const prev = latestByTask.get(s.task_id);
    if (!prev || s.created_at > prev.created_at) latestByTask.set(s.task_id, s);
  });

  ctx.elements.notebookDetailTitle.textContent = `${formatStudentName(student)} · ${buildPeriodLabel(mode, ctx.state)}`;

  if (!periodTasks.length) {
    ctx.elements.notebookDetailBody.innerHTML = "<div>No hay tareas en este periodo.</div>";
    setOverlay(ctx.elements.notebookDetailModal, true);
    ctx.state.activeNotebookStudentId = studentId;
    return;
  }

  const resolved = [], failed = [], exams = [], works = [];
  periodTasks.forEach(task => {
    const sess = latestByTask.get(task.id);
    if (task.type === "exam") { exams.push({ task, sess }); return; }
    if (task.type === "work") { works.push({ task, sess }); return; }
    if (sess) {
      (sess.needs_help ? failed : resolved).push({ task, sess });
    } else {
      const status = getStudentTaskStatus(ctx, task.id, studentId);
      (status === "done" ? resolved : failed).push({ task, sess: null });
    }
  });

  ctx.elements.notebookDetailBody.innerHTML =
    detailSection("Resueltas", resolved, "✓", ctx, studentId) +
    detailSection("No pudo / Pendiente", failed, "✗", ctx, studentId) +
    detailSection("Exámenes", exams, "📋", ctx, studentId) +
    detailSection("Trabajos", works, "📝", ctx, studentId);

  setOverlay(ctx.elements.notebookDetailModal, true);
  ctx.state.activeNotebookStudentId = studentId;
}

function detailSection(title, items, icon, ctx, studentId) {
  if (!items.length) return "";
  const rows = items.map(({ task, sess }) => {
    const status = getStudentTaskStatus(ctx, task.id, studentId);
    const opts = [
      { v: "pending", label: "Pendiente" },
      { v: "done", label: "Hecha" },
      { v: "needs_teacher", label: "Necesita profesor" }
    ].map(o => `<option value="${o.v}" ${o.v === status ? "selected" : ""}>${o.label}</option>`).join("");
    const meta = sess ? ` · ${sess.session_date}${sess.duration_seconds ? ` · ${Math.round(sess.duration_seconds / 60)}min` : ""}` : "";
    return `<div class="nbTaskRow">
      <div class="nbTaskInfo">
        <div class="nbTaskTitle">${escapeHtml(task.title)}</div>
        <div class="nbTaskMeta">${escapeHtml(task.dueDate)} · ${escapeHtml(TYPE_LABELS[task.type] || "Tarea")}${escapeHtml(meta)}</div>
      </div>
      <select class="nbTaskSelect" data-task-id="${task.id}">${opts}</select>
    </div>`;
  }).join("");
  return `<div class="nbDetailSection"><div class="nbDetailSectionHead">${icon} ${title}</div><div class="nbTaskList">${rows}</div></div>`;
}

function buildPeriodLabel(mode, state) {
  if (mode === "week") return "Semana actual";
  if (mode === "month") return `Mes ${state.notebookMonth}`;
  if (mode === "term") return `Trimestre ${String(state.notebookTerm).toUpperCase()}`;
  if (mode === "custom") return `${state.notebookCustomFrom} – ${state.notebookCustomTo}`;
  return "";
}

export function closeNotebookDetail(ctx) {
  setOverlay(ctx.elements.notebookDetailModal, false);
  ctx.state.activeNotebookStudentId = null;
}

export function openGradesModal(ctx, studentId) {
  const student = normalizeStudent(ctx.state.data.students?.find(item => item.id === studentId));
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
        <div class="attachmentName">${escapeHtml(grade.title)} · ${escapeHtml(grade.score)}</div>
        <div class="attachmentMeta">${escapeHtml(grade.date)}</div>
      </div>
      <button class="btn ghost" data-grade-id="${grade.id}" type="button">Borrar</button>
    `;
    ctx.elements.gradeList.appendChild(li);
  });
  ctx.elements.gradeEmpty.style.display = list.length ? "none" : "block";
}
