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

function td(extraClass = "") {
  const el = document.createElement("td");
  el.className = `nbCell${extraClass ? " " + extraClass : ""}`;
  return el;
}

function th(extraClass = "", colspan = 1) {
  const el = document.createElement("th");
  el.className = `nbCell${extraClass ? " " + extraClass : ""}`;
  if (colspan > 1) el.colSpan = colspan;
  return el;
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

  const tableWrap = document.createElement("div");
  tableWrap.className = "nbWeekTableWrap";

  const table = document.createElement("table");
  table.className = "nbWeekTable";

  // ── colgroup: proporciones fijas ─────────────────────────────────────────
  const colgroup = document.createElement("colgroup");
  [15, 6, 6, 6, 6, 6, 7, 7, 6, 6, 6, 6, 11].forEach(w => {
    const col = document.createElement("col");
    col.style.width = `${w}%`;
    colgroup.appendChild(col);
  });
  table.appendChild(colgroup);

  // ── thead ─────────────────────────────────────────────────────────────────
  const thead = document.createElement("thead");

  // Row 1: group label bands
  const tr1 = document.createElement("tr");
  tr1.className = "nbHeadGroup";
  [
    { label: "Alumno",       colspan: 1, cls: "nbName" },
    { label: "Deberes",      colspan: 7, cls: "center nbCellGroup nbCellGroup--deberes" },
    { label: "Exámenes",     colspan: 2, cls: "center nbCellGroup nbCellGroup--examenes nbDivL" },
    { label: "Trabajos",     colspan: 2, cls: "center nbCellGroup nbCellGroup--trabajos nbDivL" },
    { label: "Tiempo Total", colspan: 1, cls: "center nbCellGroup nbCellGroup--total nbDivL" },
  ].forEach(({ label, colspan, cls }) => {
    const c = th(cls, colspan);
    c.textContent = label;
    tr1.appendChild(c);
  });
  thead.appendChild(tr1);

  // Row 2: sub-labels
  const tr2 = document.createElement("tr");
  tr2.className = "nbHeadSub";
  [
    { label: "",                               cls: "nbName" },
    ...DAY_LABELS.map(l => ({ label: l,        cls: "center" })),
    { label: "Total",                          cls: "center" },
    { label: "Tiempo",                         cls: "center" },
    { label: weekExams.length ? "📝" : "—",    cls: "center nbDivL" },
    { label: "Tiempo",                         cls: "center" },
    { label: weekWorks.length ? "📋" : "—",    cls: "center nbDivL" },
    { label: "Tiempo",                         cls: "center" },
    { label: "",                               cls: "center nbDivL" },
  ].forEach(({ label, cls }) => {
    const c = th(cls);
    c.textContent = label;
    tr2.appendChild(c);
  });
  thead.appendChild(tr2);
  table.appendChild(thead);

  // ── tbody ─────────────────────────────────────────────────────────────────
  const tbody = document.createElement("tbody");

  students.forEach(student => {
    const sid = String(student.id || "");
    const row = document.createElement("tr");
    row.dataset.studentId = sid;

    // Col 1: Name
    const nameCell = td("nbName");
    nameCell.textContent = formatStudentName(student) || "Sin nombre";
    row.appendChild(nameCell);

    // Cols 2–6: Homework dots per day
    let hwDone = 0, hwTotal = 0, hwSecs = 0;

    dayKeys.forEach(dayKey => {
      const dayTasks = hwByDay[dayKey];
      if (!dayTasks.length) {
        row.appendChild(td("center nbDayCell nbCell--empty"));
        return;
      }
      hwTotal += dayTasks.length;
      const c = td("center nbDayCell");
      const dots = document.createElement("div");
      const visibleTasks = dayTasks.slice(0, 4);
      dots.className = visibleTasks.length > 1 ? "nbDots nbDots--grid" : "nbDots";

      const dayTicket = allTickets
        .filter(t => t.studentId === student.id && t.status === "open" && t.groupId === groupId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

      visibleTasks.forEach(task => {
        const taskKey = `${sid}::${dayKey}::${task.id}`;
        hwSecs += taskDurationMap.get(taskKey) || 0;

        const latestSession = latestSessionMap.get(taskKey);
        const status = getTaskStatus(ctx, task.id, student.id);
        const dotColor = latestSession
          ? (latestSession.needs_help ? "needs" : "done")
          : (status === "done" ? "done" : status === "needs_teacher" ? "needs" : "pending");
        if (dotColor === "done") hwDone++;

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
        dots.appendChild(dot);
      });
      c.appendChild(dots);
      row.appendChild(c);
    });

    // Col 7: Homework done/total
    const hwTotalCell = hwTotal > 0 ? td("center") : td("center nbCell--empty");
    if (hwTotal > 0) {
      const strong = document.createElement("strong");
      strong.textContent = String(hwDone);
      hwTotalCell.append(strong, `/${hwTotal}`);
    }
    row.appendChild(hwTotalCell);

    // Col 8: Homework session time
    const hwTimeCell = hwSecs > 0 ? td("center nbTimeCell") : td("center nbTimeCell nbCell--empty");
    if (hwSecs > 0) hwTimeCell.textContent = fmtTime(hwSecs);
    row.appendChild(hwTimeCell);

    // Cols 9–10: Exámenes
    let examSecs = 0;
    const examIconCell = td("center nbDayCell nbDivL");
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

    const examTimeCell = examSecs > 0 ? td("center nbTimeCell") : td("center nbTimeCell nbCell--empty");
    if (examSecs > 0) examTimeCell.textContent = fmtTime(examSecs);
    row.appendChild(examTimeCell);

    // Cols 11–12: Trabajos
    let workSecs = 0;
    const workIconCell = td("center nbDayCell nbDivL");
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

    const workTimeCell = workSecs > 0 ? td("center nbTimeCell") : td("center nbTimeCell nbCell--empty");
    if (workSecs > 0) workTimeCell.textContent = fmtTime(workSecs);
    row.appendChild(workTimeCell);

    // Col 13: Tiempo Total
    const totalSecs = hwSecs + examSecs + workSecs;
    const totalTimeCell = totalSecs > 0 ? td("center nbTotalTime nbDivL") : td("center nbTotalTime nbDivL nbCell--empty");
    if (totalSecs > 0) totalTimeCell.textContent = fmtTime(totalSecs);
    row.appendChild(totalTimeCell);

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  tableWrap.appendChild(table);
  ctx.elements.notebookGrid.appendChild(tableWrap);
}
