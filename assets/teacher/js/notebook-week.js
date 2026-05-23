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

export function renderNotebookWeek(ctx) {
  const groupId = ctx.state.currentGroupId;
  const offset = ctx.state.notebookWeekOffset || 0;
  const days = getWeekDays(offset);
  const dayKeys = days.map(formatYMDLocal);
  const DAY_LABELS = ["L", "M", "X", "J", "V"];

  if (ctx.elements.notebookWeekLabel) {
    const from = days[0];
    const to = days[4];
    ctx.elements.notebookWeekLabel.textContent =
      `${from.getDate()} ${from.toLocaleDateString("es-ES", { month: "short" })} – ${to.getDate()} ${to.toLocaleDateString("es-ES", { month: "short" })}`;
  }

  const tasksRaw = Array.isArray(ctx.state.data.tasks) ? ctx.state.data.tasks : [];
  const subjectFilter = ctx.state.currentSubjectFilter || "";
  const tasksByDay = Object.fromEntries(dayKeys.map(k => [k, []]));
  tasksRaw.forEach(task => {
    if (task.groupId !== groupId || task.tenantId !== ctx.state.tenantId) return;
    if (subjectFilter && (task.subjectName || "") !== subjectFilter) return;
    if (tasksByDay[task.dueDate]) tasksByDay[task.dueDate].push(task);
  });

  const hasExamWork = dayKeys.some(dk => (tasksByDay[dk] || []).some(t => t.type === "exam" || t.type === "work"));
  const periodGrades = Array.isArray(ctx.state.data.periodGrades) ? ctx.state.data.periodGrades : [];
  const gradeByStudentTask = new Map();
  periodGrades.forEach(g => gradeByStudentTask.set(`${g.student_id}::${g.task_id}`, g.score));

  const sessions = Array.isArray(ctx.state.data.tutorSessions) ? ctx.state.data.tutorSessions : [];
  const sessionMap = new Map();
  const taskDurationMap = new Map();
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

  const head = document.createElement("div");
  head.className = "nbRow nbHead nbRowWeek";
  ["Alumno", ...DAY_LABELS, "Total", "Tutor"].forEach((label, i) => {
    const cell = document.createElement("div");
    cell.className = `nbCell${i === 0 ? " nbName" : " center"}`;
    cell.textContent = label;
    head.appendChild(cell);
  });
  ctx.elements.notebookGrid.appendChild(head);

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
          const status = getTaskStatus(ctx, task.id, student.id);
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
        weekSessionSecs += sessionMap.get(`${student.id}::${dayKey}`) || 0;
      }
      row.appendChild(cell);
    });

    const totalCell = document.createElement("div");
    totalCell.className = "nbCell center";
    const strong = document.createElement("strong");
    strong.textContent = String(weekDone);
    totalCell.append(strong, `/${weekTotal}`);
    row.appendChild(totalCell);

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

    if (hasExamWork) {
      const examRow = document.createElement("div");
      examRow.className = "nbRow nbRowWeek nbRowExam";

      const labelCell = document.createElement("div");
      labelCell.className = "nbCell nbName";
      examRow.appendChild(labelCell);

      dayKeys.forEach(dayKey => {
        const cell = document.createElement("div");
        cell.className = "nbCell center";
        const examTasks = (tasksByDay[dayKey] || []).filter(t => t.type === "exam" || t.type === "work");
        examTasks.forEach(task => {
          const wrapper = document.createElement("div");
          wrapper.className = "nbExamCell";
          wrapper.dataset.nbAction = "open-task-grade";
          wrapper.dataset.taskId = task.id;
          const icon = document.createElement("span");
          icon.textContent = task.type === "exam" ? "📝" : "📋";
          icon.title = task.title;
          wrapper.appendChild(icon);
          const score = gradeByStudentTask.get(`${student.id}::${task.id}`);
          if (score !== undefined && score !== null) {
            const scoreEl = document.createElement("span");
            scoreEl.className = "nbExamScore";
            scoreEl.textContent = score;
            wrapper.appendChild(scoreEl);
          }
          cell.appendChild(wrapper);
        });
        examRow.appendChild(cell);
      });

      const emptyTotal = document.createElement("div");
      emptyTotal.className = "nbCell center";
      examRow.appendChild(emptyTotal);
      const emptyTutor = document.createElement("div");
      emptyTutor.className = "nbCell center";
      examRow.appendChild(emptyTutor);

      ctx.elements.notebookGrid.appendChild(examRow);
    }
  });
}
