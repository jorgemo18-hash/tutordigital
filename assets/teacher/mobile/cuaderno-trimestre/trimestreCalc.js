// trimestreCalc.js — Pure data transforms for the mobile Trimestre view.
// Ported 1:1 from assets/teacher/js/notebook-utils.js and notebook-cards.js
// so the numbers match desktop exactly. No DOM, no fetch — every function
// receives its inputs as explicit parameters.

export function calcNotaMedia(cardGrades, stats, weights) {
  const w = weights || { exam_pct: 60, work_pct: 20, homework_pct: 20 };

  const examScores = cardGrades
    .filter(g => g._taskType === "exam")
    .map(g => parseFloat(String(g.score || "").replace(",", ".")))
    .filter(n => Number.isFinite(n) && n >= 0 && n <= 10);

  const workScores = cardGrades
    .filter(g => g._taskType === "work")
    .map(g => parseFloat(String(g.score || "").replace(",", ".")))
    .filter(n => Number.isFinite(n) && n >= 0 && n <= 10);

  const hwScore = stats.total > 0 ? (stats.done / stats.total) * 10 : null;

  const parts = [];
  if (examScores.length > 0) {
    parts.push({ score: examScores.reduce((a, b) => a + b, 0) / examScores.length, weight: Number(w.exam_pct) });
  }
  if (workScores.length > 0) {
    parts.push({ score: workScores.reduce((a, b) => a + b, 0) / workScores.length, weight: Number(w.work_pct) });
  }
  if (hwScore !== null) {
    parts.push({ score: hwScore, weight: Number(w.homework_pct) });
  }

  if (!parts.length) return null;
  const totalWeight = parts.reduce((a, p) => a + p.weight, 0);
  if (totalWeight === 0) return null;
  return parts.reduce((a, p) => a + p.score * p.weight, 0) / totalWeight;
}

export function formatNota(value) {
  if (value === null || value === undefined) return "—";
  return value % 1 === 0 ? String(value) : value.toFixed(1).replace(".", ",");
}

// Best-guess trimester for "today" when the teacher hasn't picked one yet —
// matches the academic-year ranges the server falls back to in term-dates.routes.js.
export function defaultTrimester() {
  const m = new Date().getMonth() + 1;
  if (m >= 9) return 1;
  if (m <= 3) return 2;
  return 3;
}

export function buildPeriodTasks(allTasks, from, to) {
  return allTasks.filter(t => {
    const due = t.due_date || t.dueDate || "";
    return due >= from && due <= to;
  });
}

export function buildTaskMaps(periodTasks) {
  const taskTypeMap  = new Map(periodTasks.map(t => [t.id, t.type]));
  const taskTitleMap = new Map(periodTasks.map(t => [t.id, t.title || "Tarea"]));
  return { taskTypeMap, taskTitleMap };
}

export function tagGradesByType(grades, taskTypeMap, taskTitleMap) {
  return grades.map(g => ({
    ...g,
    _taskType:  taskTypeMap.get(g.task_id) || "other",
    _taskTitle: taskTitleMap.get(g.task_id) || "",
  }));
}

// One row per period task for a single student: latest session outcome,
// when it happened, and whether it's already been reviewed by the teacher.
export function buildProgressTasks(periodTasks, studentSessions, taskTitleMap) {
  const latestByTask   = new Map();
  const sessionsByTask = new Map();
  studentSessions.forEach(s => {
    const prev = latestByTask.get(s.task_id);
    if (!prev || (s.created_at || "") > (prev.created_at || "")) latestByTask.set(s.task_id, s);
    if (!sessionsByTask.has(s.task_id)) sessionsByTask.set(s.task_id, []);
    sessionsByTask.get(s.task_id).push(s);
  });

  return periodTasks.map(task => {
    const latestSession = latestByTask.get(task.id);
    const taskSessions  = sessionsByTask.get(task.id) || [];
    const status = !latestSession ? "pending"
      : latestSession.needs_help ? "help"
      : latestSession.outcome === "completed" ? "resolved"
      : "pending";
    return {
      taskId:       task.id,
      taskTitle:    taskTitleMap.get(task.id) || task.title || "Tarea",
      sessionDate:  latestSession?.session_date || "",
      sessionId:    latestSession?.id || null,
      sessionCount: taskSessions.length,
      isReviewed:   latestSession?.teacher_reviewed || false,
      status,
    };
  });
}

export function buildSessionStats(studentSessions, progressTasks, periodTaskIds) {
  const latestByTask = new Map();
  studentSessions.forEach(s => {
    const prev = latestByTask.get(s.task_id);
    if (!prev || (s.created_at || "") > (prev.created_at || "")) latestByTask.set(s.task_id, s);
  });
  return {
    totalSecs:   studentSessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0),
    solvedAlone: [...latestByTask.entries()].filter(([taskId, s]) => periodTaskIds.has(taskId) && !s.needs_help).length,
    neededHelp:  progressTasks.filter(t => t.status === "help").length,
    sessionDays: new Set(studentSessions.map(s => s.session_date)).size,
  };
}

// Combines everything above for ONE student into the exact shape the
// detail sheet and the report sheet need.
export function buildStudentTrimestreData({ student, summary, periodTasks, taskTitleMap, sessions, grades, weights }) {
  const studentSessions = sessions.filter(s => s.student_id === student.id);
  const periodTaskIds   = new Set(periodTasks.map(t => t.id));

  const stats = {
    total: periodTasks.length,
    done:  summary?.tasks_done || 0,
  };

  const cardGrades   = grades.filter(g => g.student_id === student.id);
  const progressTasks = buildProgressTasks(periodTasks, studentSessions, taskTitleMap);
  const sessionStats  = buildSessionStats(studentSessions, progressTasks, periodTaskIds);
  const notaMediaVal  = calcNotaMedia(cardGrades, stats, weights);

  const examIds = new Set(periodTasks.filter(t => t.type === "exam").map(t => t.id));
  const workIds = new Set(periodTasks.filter(t => t.type === "work").map(t => t.id));
  const hwTasks = progressTasks.filter(pt => !examIds.has(pt.taskId) && !workIds.has(pt.taskId));

  return {
    stats, sessionStats, progressTasks, cardGrades, notaMediaVal,
    examGrades: cardGrades.filter(g => g._taskType === "exam"),
    workGrades: cardGrades.filter(g => g._taskType === "work"),
    hwDone: hwTasks.filter(pt => pt.status === "resolved").length,
    hwTotal: hwTasks.length,
  };
}
