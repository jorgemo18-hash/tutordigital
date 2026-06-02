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
  const day = now.getDay(); // 0=Sun, 1=Mon … 6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const base = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + diffToMonday + offsetWeeks * 7
  );
  return Array.from({ length: 5 }, (_, i) =>
    new Date(base.getFullYear(), base.getMonth(), base.getDate() + i)
  );
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

// Nota cell: 0 grades → + | 1 grade → value in copper | 2+ → notebook icon chip
// gradesByStudentTask: Map<"sid::taskId", string[]>
function buildNoteCell(tasks, sid, gradesByStudentTask, extraCls = "") {
  const cell = td(`center ${extraCls}`.trim());

  if (!tasks.length) {
    const dash = document.createElement("span");
    dash.className = "nbNoteDash";
    dash.textContent = "—";
    cell.appendChild(dash);
    return cell;
  }

  const allScores = tasks.flatMap(t => gradesByStudentTask.get(`${sid}::${t.id}`) || []);

  const taskIdsStr = tasks.map(t => t.id).join(",");

  if (allScores.length === 0) {
    const btn = document.createElement("button");
    btn.className = "nbAddNoteBtn";
    btn.type = "button";
    btn.textContent = "+";
    btn.dataset.nbAction = "open-task-grade";
    btn.dataset.taskId = tasks[0].id;
    btn.dataset.taskIds = taskIdsStr;
    btn.dataset.studentId = sid;
    cell.appendChild(btn);
  } else if (allScores.length === 1) {
    const gradeEl = document.createElement("span");
    gradeEl.className = "nbNoteVal";
    gradeEl.textContent = allScores[0];
    gradeEl.dataset.nbAction = "open-task-grade";
    gradeEl.dataset.taskId = tasks[0].id;
    gradeEl.dataset.taskIds = taskIdsStr;
    gradeEl.dataset.studentId = sid;
    cell.appendChild(gradeEl);
  } else {
    const chip = document.createElement("span");
    chip.className = "nbNoteIconChip";
    chip.innerHTML = `<svg width="12" height="13" viewBox="0 0 12 13" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="0.5" width="10" height="12" rx="1.5" stroke="currentColor" stroke-width="1.3"/><line x1="3.5" y1="4" x2="8.5" y2="4" stroke="currentColor" stroke-width="1" stroke-linecap="round"/><line x1="3.5" y1="7" x2="8.5" y2="7" stroke="currentColor" stroke-width="1" stroke-linecap="round"/><line x1="3.5" y1="10" x2="6.5" y2="10" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>`;
    chip.dataset.nbAction = "open-task-grade";
    chip.dataset.taskId = tasks[0].id;
    chip.dataset.taskIds = taskIdsStr;
    chip.dataset.studentId = sid;
    cell.appendChild(chip);
  }
  return cell;
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

  // weekTasks is fetched for the exact notebook week; fall back to planner tasks
  const tasksRaw = Array.isArray(ctx.state.data.weekTasks)
    ? ctx.state.data.weekTasks
    : Array.isArray(ctx.state.data.tasks) ? ctx.state.data.tasks : [];
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
  ctx.state.currentWeekGradableTaskIds = [...weekExams, ...weekWorks].map(t => t.id);

  // Build grade map: key → array of scores (supports multiple grades per task+student)
  const periodGrades = Array.isArray(ctx.state.data.periodGrades) ? ctx.state.data.periodGrades : [];
  const gradesByStudentTask = new Map();
  periodGrades.forEach(g => {
    const key = `${g.student_id}::${g.task_id}`;
    if (!gradesByStudentTask.has(key)) gradesByStudentTask.set(key, []);
    gradesByStudentTask.get(key).push(g.score);
  });

  const sessions = Array.isArray(ctx.state.data.tutorSessions) ? ctx.state.data.tutorSessions : [];
  const taskDurationMap  = new Map();
  // completedMap: la "end session" más reciente (duration>0) — determina color del dot
  // aiSessionMap: la AI session más reciente (duration=0) — para abrir el drawer
  const completedMap  = new Map();
  const aiSessionMap  = new Map();

  sessions.forEach(s => {
    const taskKey = `${s.student_id}::${s.session_date}::${s.task_id}`;
    // Acumular duración solo de end sessions (AI sessions tienen duration=0)
    taskDurationMap.set(taskKey, (taskDurationMap.get(taskKey) || 0) + s.duration_seconds);

    if (s.duration_seconds > 0) {
      // End session: usada para el color del dot (verde/cobre)
      const prev = completedMap.get(taskKey);
      if (!prev || (s.created_at && s.created_at > prev.created_at)) {
        completedMap.set(taskKey, { needs_help: s.needs_help, created_at: s.created_at || "", teacher_reviewed: s.teacher_reviewed || false });
      }
    } else {
      // AI session: usada para el drawer (tiene tutor_session_maps)
      const prev = aiSessionMap.get(taskKey);
      if (!prev || (s.created_at && s.created_at > prev.created_at)) {
        aiSessionMap.set(taskKey, { id: s.id, created_at: s.created_at || "" });
      }
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
    { label: "Deberes",      colspan: 7, cls: "center nbCellGroup nbCellGroup--deberes nbDivL" },
    { label: "Exámenes",     colspan: 2, cls: "center nbCellGroup nbCellGroup--examenes nbDivL" },
    { label: "Trabajos",     colspan: 2, cls: "center nbCellGroup nbCellGroup--trabajos nbDivL" },
    { label: "Tiempo Total", colspan: 1, cls: "center nbCellGroup nbCellGroup--total nbDivL" },
  ].forEach(({ label, colspan, cls }) => {
    const c = th(cls, colspan);
    c.textContent = label;
    tr1.appendChild(c);
  });
  thead.appendChild(tr1);

  // Row 2: sub-labels — first day column (L) gets nbDivL to open the Deberes block
  const tr2 = document.createElement("tr");
  tr2.className = "nbHeadSub";
  [
    { label: "",       cls: "nbName" },
    ...DAY_LABELS.map((l, i) => ({ label: l, cls: i === 0 ? "center nbDivL" : "center" })),
    { label: "Total",  cls: "center" },
    { label: "Tiempo", cls: "center nbDivR" },
    { label: "Nota",   cls: "center nbDivL" },
    { label: "Tiempo", cls: "center nbDivR" },
    { label: "Nota",   cls: "center nbDivL" },
    { label: "Tiempo", cls: "center nbDivR" },
    { label: "",       cls: "center nbDivL" },
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

    // Cols 2–6: Homework dots per day (col 2 = Monday gets nbDivL)
    let hwDone = 0, hwTotal = 0, hwSecs = 0;

    dayKeys.forEach((dayKey, dayIdx) => {
      const dayTasks = hwByDay[dayKey];
      const divCls = dayIdx === 0 ? " nbDivL" : "";
      if (!dayTasks.length) {
        const emptyCell = td(`center nbDayCell nbCell--empty${divCls}`);
        const dash = document.createElement("span");
        dash.className = "nbNoteDash";
        dash.textContent = "—";
        emptyCell.appendChild(dash);
        row.appendChild(emptyCell);
        return;
      }
      hwTotal += dayTasks.length;
      const c = td(`center nbDayCell${divCls}`);
      const dots = document.createElement("div");
      const visibleTasks = dayTasks.slice(0, 4);
      dots.className = visibleTasks.length > 1 ? "nbDots nbDots--grid" : "nbDots";

      const dayTicket = allTickets
        .filter(t => t.studentId === student.id && t.status === "open" && t.groupId === groupId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

      visibleTasks.forEach(task => {
        const taskKey = `${sid}::${dayKey}::${task.id}`;
        hwSecs += taskDurationMap.get(taskKey) || 0;

        const completedSess = completedMap.get(taskKey);
        const aiSess        = aiSessionMap.get(taskKey);
        const status        = getTaskStatus(ctx, task.id, student.id);

        // Color del dot: basado en la end session más reciente (duration>0)
        // Si no hay end session, usar el estado de la tarea en el planificador
        const dotColor = completedSess
          ? (completedSess.needs_help ? "needs" : "done")
          : (status === "done" ? "done" : status === "needs_teacher" ? "needs" : "pending");
        if (dotColor === "done") hwDone++;

        // Todos los dots son clicables
        const dot = document.createElement("span");
        dot.className = `nbDot nbDot--${dotColor} nbDot--clickable`;
        dot.title = task.title;
        dot.dataset.studentId  = sid;
        dot.dataset.dayKey     = dayKey;
        dot.dataset.taskTitle  = task.title || "";
        dot.dataset.taskId     = task.id   || "";
        if (dayTicket) dot.dataset.ticketId = dayTicket.id;

        // sessionId para el drawer: usar la AI session (tiene tutor_session_maps)
        if (aiSess?.id) dot.dataset.sessionId = aiSess.id;

        // Indicador de nota: cruzar por student_id + task_id
        const taskNotes = (ctx.state.data.studentNotes || []).filter(
          n => n.student_id === sid && n.task_id === task.id
        );
        const hasUnreadNote  = taskNotes.some(n => !n.is_read);
        const notesReviewed  = taskNotes.length > 0 && taskNotes.every(n => n.is_read);
        const isReviewed     = notesReviewed || (completedSess?.teacher_reviewed === true);

        // Tick cobre: sesión completada Y (nota revisada O marcada como revisada)
        if (completedSess && isReviewed) dot.classList.add("nbDot--reviewed");

        if (hasUnreadNote) {
          const wrap = document.createElement("span");
          wrap.className = "nbDot-wrap";
          wrap.dataset.studentId = sid;
          wrap.dataset.taskId    = task.id;
          wrap.appendChild(dot);
          const badge = document.createElement("span");
          badge.className = "nbDot-unread";
          badge.title = "Nota del alumno sin leer";
          wrap.appendChild(badge);
          dots.appendChild(wrap);
        } else {
          dots.appendChild(dot);
        }
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

    // Col 8: Homework session time  [right separator]
    const hwTimeCell = hwSecs > 0 ? td("center nbTimeCell nbDivR") : td("center nbTimeCell nbDivR nbCell--empty");
    if (hwSecs > 0) hwTimeCell.textContent = fmtTime(hwSecs);
    row.appendChild(hwTimeCell);

    // Col 9: Nota examen  |  Col 10: Tiempo examen  [right separator]
    let examSecs = 0;
    weekExams.forEach(t => {
      examSecs += taskDurationMap.get(`${sid}::${t.dueDate}::${t.id}`) || 0;
    });
    row.appendChild(buildNoteCell(weekExams, sid, gradesByStudentTask, "nbDivL"));
    const examTimeCell = examSecs > 0 ? td("center nbTimeCell nbDivR") : td("center nbTimeCell nbDivR nbCell--empty");
    if (examSecs > 0) examTimeCell.textContent = fmtTime(examSecs);
    row.appendChild(examTimeCell);

    // Col 11: Nota trabajo  |  Col 12: Tiempo trabajo  [right separator]
    let workSecs = 0;
    weekWorks.forEach(t => {
      workSecs += taskDurationMap.get(`${sid}::${t.dueDate}::${t.id}`) || 0;
    });
    row.appendChild(buildNoteCell(weekWorks, sid, gradesByStudentTask, "nbDivL"));
    const workTimeCell = workSecs > 0 ? td("center nbTimeCell nbDivR") : td("center nbTimeCell nbDivR nbCell--empty");
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
