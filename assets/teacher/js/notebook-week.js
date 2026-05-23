import { compareBySurname, normalizeStudent, formatStudentName } from "./state.js";

function getTaskStatus(ctx, taskId, studentId) {
  const map = ctx.state.data.taskStatus?.[ctx.state.currentTeacherId]?.[taskId];
  return map?.[studentId] || "pending";
}

export function formatYMDLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getWeekDays(offsetWeeks) {
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

function fmtTime(secs) {
  if (!secs) return "—";
  const mins = Math.round(secs / 60);
  if (mins < 1) return "< 1m";
  return mins >= 60
    ? `${Math.floor(mins / 60)}h${mins % 60 > 0 ? ` ${mins % 60}m` : ""}`.trim()
    : `${mins}m`;
}

function cell(extraClass = "") {
  const d = document.createElement("div");
  d.className = `nbCell${extraClass ? " " + extraClass : ""}`;
  return d;
}

export function renderNotebookWeek(ctx) {
  const groupId = ctx.state.currentGroupId;
  const offset = ctx.state.notebookWeekOffset || 0;
  const days = getWeekDays(offset);
  const dayKeys = days.map(formatYMDLocal);
  const dayKeySet = new Set(dayKeys);
  const DAY_LABELS = ["L", "M", "X", "J", "V"];

  if (ctx.elements.notebookWeekLabel) {
    const from = days[0], to = days[4];
    ctx.elements.notebookWeekLabel.textContent =
      `${from.getDate()} ${from.toLocaleDateString("es-ES", { month: "short" })} – ${to.getDate()} ${to.toLocaleDateString("es-ES", { month: "short" })}`;
  }

  const tasksRaw = Array.isArray(ctx.state.data.tasks) ? ctx.state.data.tasks : [];
  const subjectFilter = ctx.state.currentSubjectFilter || "";

  // Partition tasks this week by type
  const hwByDay = Object.fromEntries(dayKeys.map(k => [k, []]));
  const weekExams = [];
  const weekWorks = [];

  tasksRaw.forEach(task => {
    if (task.groupId !== groupId || task.tenantId !== ctx.state.tenantId) return;
    if (subjectFilter && (task.subjectName || "") !== subjectFilter) return;
    if (!dayKeySet.has(task.dueDate)) return;
    if (task.type === "exam") weekExams.push(task);
    else if (task.type === "work") weekWorks.push(task);
    else hwByDay[task.dueDate].push(task);
  });

  const periodGrades = Array.isArray(ctx.state.data.periodGrades) ? ctx.state.data.periodGrades : [];
  const gradeByStudentTask = new Map();
  periodGrades.forEach(g => gradeByStudentTask.set(`${g.student_id}::${g.task_id}`, g.score));

  const sessions = Array.isArray(ctx.state.data.tutorSessions) ? ctx.state.data.tutorSessions : [];
  const taskDurationMap = new Map();
  const latestSessionMap = new Map();
  sessions.forEach(s => {
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

  // ── Header row 1: block labels (after partition so icons are dynamic) ────
  const head1 = document.createElement("div");
  head1.className = "nbRow nbHeadGroup nbRowWeek";
  [
    { label: "Alumno",       span: 1, extra: "nbName" },
    { label: "Deberes",      span: 7, extra: "center nbCellGroup" },
    { label: "Exámenes",     span: 2, extra: "center nbCellGroup" },
    { label: "Trabajos",     span: 2, extra: "center nbCellGroup" },
    { label: "Tiempo Total", span: 1, extra: "center nbCellGroup" },
  ].forEach(({ label, span, extra }) => {
    const c = cell(extra);
    if (span > 1) c.style.gridColumn = `span ${span}`;
    c.textContent = label;
    head1.appendChild(c);
  });
  ctx.elements.notebookGrid.appendChild(head1);

  // ── Header row 2: sub-labels — icons conditional on week content ─────────
  const head2 = document.createElement("div");
  head2.className = "nbRow nbHeadSub nbRowWeek";
  const subLabels = [
    "", ...DAY_LABELS, "Total", "Tiempo",
    weekExams.length ? "📝" : "—",
    "Tiempo",
    weekWorks.length ? "📋" : "—",
    "Tiempo",
    "",
  ];
  subLabels.forEach((label, i) => {
    const c = cell(i === 0 ? "nbName" : "center");
    c.textContent = label;
    head2.appendChild(c);
  });
  ctx.elements.notebookGrid.appendChild(head2);

  // ── Student rows ──────────────────────────────────────────────────────────
  students.forEach(student => {
    const sid = String(student.id || "");
    const row = document.createElement("div");
    row.className = "nbRow nbRowWeek";
    row.dataset.studentId = sid;

    // Col 1: Name
    const nameCell = cell("nbName");
    nameCell.textContent = formatStudentName(student) || "Sin nombre";
    row.appendChild(nameCell);

    // Cols 2–6: Homework dots per day + accumulate hw time
    let hwDone = 0, hwTotal = 0, hwSecs = 0;

    dayKeys.forEach(dayKey => {
      const dayTasks = hwByDay[dayKey];
      if (!dayTasks.length) {
        row.appendChild(cell("center nbDayCell nbCell--empty"));
        return;
      }
      hwTotal += dayTasks.length;
      const c = cell("center nbDayCell");
      const dots = document.createElement("div");
      dots.className = "nbDots";

      const dayTicket = allTickets
        .filter(t => t.studentId === student.id && t.status === "open" && t.groupId === groupId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

      dayTasks.forEach(task => {
        const taskKey = `${sid}::${dayKey}::${task.id}`;
        hwSecs += taskDurationMap.get(taskKey) || 0;

        const latestSession = latestSessionMap.get(taskKey);
        const status = getTaskStatus(ctx, task.id, student.id);
        const dotColor = latestSession
          ? (latestSession.needs_help ? "needs" : "done")
          : (status === "done" ? "done" : status === "needs_teacher" ? "needs" : "pending");
        if (dotColor === "done") hwDone++;

        const dotRow = document.createElement("div");
        dotRow.className = "nbDotRow";
        const dot = document.createElement("span");
        dot.className = `nbDot nbDot--${dotColor}`;
        dot.title = task.title;
        if (dotColor === "needs" || dotColor === "done") {
          dot.classList.add("nbDot--clickable");
          dot.dataset.studentId = sid;
          dot.dataset.dayKey = dayKey;
          dot.dataset.taskTitle = task.title || "";
          if (dotColor === "done") dot.dataset.mode = "readonly";
          if (dayTicket) dot.dataset.ticketId = dayTicket.id;
        }
        dotRow.appendChild(dot);
        dots.appendChild(dotRow);
      });
      c.appendChild(dots);
      row.appendChild(c);
    });

    // Col 7: Homework done/total
    const hwTotalCell = hwTotal > 0 ? cell("center") : cell("center nbCell--empty");
    if (hwTotal > 0) {
      const strong = document.createElement("strong");
      strong.textContent = String(hwDone);
      hwTotalCell.append(strong, `/${hwTotal}`);
    }
    row.appendChild(hwTotalCell);

    // Col 8: Homework session time
    const hwTimeCell = hwSecs > 0 ? cell("center nbTimeCell") : cell("center nbTimeCell nbCell--empty");
    if (hwSecs > 0) hwTimeCell.textContent = fmtTime(hwSecs);
    row.appendChild(hwTimeCell);

    // Cols 9–10: Exámenes icon + time
    let examSecs = 0;
    const examIconCell = cell("center nbDayCell");
    if (weekExams.length) {
      const wrap = document.createElement("div");
      wrap.className = "nbDots";
      weekExams.forEach(task => {
        examSecs += taskDurationMap.get(`${sid}::${task.dueDate}::${task.id}`) || 0;
        const examCell = document.createElement("div");
        examCell.className = "nbExamCell";
        examCell.dataset.nbAction = "open-task-grade";
        examCell.dataset.taskId = task.id;
        const icon = document.createElement("span");
        icon.textContent = "📝";
        icon.title = task.title;
        examCell.appendChild(icon);
        const score = gradeByStudentTask.get(`${sid}::${task.id}`);
        if (score !== undefined && score !== null) {
          const scoreEl = document.createElement("span");
          scoreEl.className = "nbExamScore";
          scoreEl.textContent = score;
          examCell.appendChild(scoreEl);
        }
        wrap.appendChild(examCell);
      });
      examIconCell.appendChild(wrap);
    } else {
      examIconCell.classList.add("nbCell--empty");
    }
    row.appendChild(examIconCell);

    const examTimeCell = examSecs > 0 ? cell("center nbTimeCell") : cell("center nbTimeCell nbCell--empty");
    if (examSecs > 0) examTimeCell.textContent = fmtTime(examSecs);
    row.appendChild(examTimeCell);

    // Cols 11–12: Trabajos icon + time
    let workSecs = 0;
    const workIconCell = cell("center nbDayCell");
    if (weekWorks.length) {
      const wrap = document.createElement("div");
      wrap.className = "nbDots";
      weekWorks.forEach(task => {
        workSecs += taskDurationMap.get(`${sid}::${task.dueDate}::${task.id}`) || 0;
        const workCell = document.createElement("div");
        workCell.className = "nbExamCell";
        workCell.dataset.nbAction = "open-task-grade";
        workCell.dataset.taskId = task.id;
        const icon = document.createElement("span");
        icon.textContent = "📋";
        icon.title = task.title;
        workCell.appendChild(icon);
        const score = gradeByStudentTask.get(`${sid}::${task.id}`);
        if (score !== undefined && score !== null) {
          const scoreEl = document.createElement("span");
          scoreEl.className = "nbExamScore";
          scoreEl.textContent = score;
          workCell.appendChild(scoreEl);
        }
        wrap.appendChild(workCell);
      });
      workIconCell.appendChild(wrap);
    } else {
      workIconCell.classList.add("nbCell--empty");
    }
    row.appendChild(workIconCell);

    const workTimeCell = workSecs > 0 ? cell("center nbTimeCell") : cell("center nbTimeCell nbCell--empty");
    if (workSecs > 0) workTimeCell.textContent = fmtTime(workSecs);
    row.appendChild(workTimeCell);

    // Col 13: Tiempo Total
    const totalSecs = hwSecs + examSecs + workSecs;
    const totalTimeCell = totalSecs > 0 ? cell("center nbTotalTime") : cell("center nbTotalTime nbCell--empty");
    if (totalSecs > 0) totalTimeCell.textContent = fmtTime(totalSecs);
    row.appendChild(totalTimeCell);

    ctx.elements.notebookGrid.appendChild(row);
  });
}
