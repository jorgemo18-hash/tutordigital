import { compareBySurname, normalizeStudent, formatStudentName } from "./state.js";
import { countLocalDone, fmtTime, calcNotaMedia, formatNota } from "./notebook-utils.js";
import { renderGradeSection } from "./notebook-card-grades.js";
import { escHtml } from "../../shared/js/escHtml.js";

const _progressTasksCache = new Map();
export function getProgressTasksForStudent(studentId) {
  return _progressTasksCache.get(studentId) || null;
}

const _reportStatsCache = new Map();
export function getReportStats(studentId) {
  return _reportStatsCache.get(studentId) || null;
}

// ── Student card ───────────────────────────────────────────────────────────

export function buildStudentCard(student, {
  stats, sessionStats, progressTasks, cardGrades, estadoInfo, groupId,
  periodExamTasks = [], periodWorkTasks = [],
  gradeWeights = [], showNotaMedia = false,
}) {
  const studentId = String(student?.id || "").trim();
  const card = document.createElement("article");
  card.className = "nbStudentCard";
  card.dataset.studentId = studentId;

  const name = formatStudentName(student) || "Sin nombre";
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("");
  const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  // Pick weights: use first subject's weights (or default if no subjects)
  const activeWeights = gradeWeights[0] || { exam_pct: 60, work_pct: 20, homework_pct: 20 };
  const notaMediaVal  = showNotaMedia ? calcNotaMedia(cardGrades, stats, activeWeights) : null;
  const notaStr       = formatNota(notaMediaVal);

  // ── Head: avatar + name/sub + nota media chip (or pct chip) ─────────────
  const head = document.createElement("header");
  head.className = "nbScHead";

  const avatarDiv = document.createElement("div");
  avatarDiv.className = "nbAvatar";
  avatarDiv.textContent = initials;

  const infoDiv = document.createElement("div");
  infoDiv.className = "nbScInfo";
  infoDiv.innerHTML = showNotaMedia
    ? `<div class="nbScName">${escHtml(name)}</div>`
    : `<div class="nbScName">${escHtml(name)}</div><div class="nbScSub">${stats.done} / ${stats.total} tareas · ${pct}%</div>`;

  if (showNotaMedia) {
    const notaChip = document.createElement("div");
    notaChip.className = "nbNotaChip";
    notaChip.innerHTML = `
      <span class="nbNotaVal">${notaStr}</span>
      <span class="nbNotaLbl">Nota media</span>
    `;
    head.appendChild(avatarDiv);
    head.appendChild(infoDiv);
    head.appendChild(notaChip);
  } else {
    head.innerHTML = `
      <div class="nbAvatar">${escHtml(initials)}</div>
      <div class="nbScInfo">
        <div class="nbScName">${escHtml(name)}</div>
        <div class="nbScSub">${stats.done} / ${stats.total} tareas</div>
      </div>
      <div class="nbPctChip">
        <span class="nbPctNum">${pct}%</span>
        <span class="nbPctLbl">Tareas hechas</span>
      </div>
    `;
  }
  card.appendChild(head);

  // ── Stats grid ────────────────────────────────────────────────────────────
  const avgSecs = sessionStats.sessionDays > 0
    ? Math.round(sessionStats.totalSecs / sessionStats.sessionDays) : 0;
  const barPct = stats.total > 0
    ? Math.min(100, Math.round((sessionStats.solvedAlone / stats.total) * 100)) : 0;

  const statsGrid = document.createElement("div");
  if (showNotaMedia) {
    // 2×2 grid including "Tareas hechas"
    statsGrid.className = "nbStatsGrid";
    statsGrid.innerHTML = `
      <div class="nbStatCell">
        <span class="nbStatEye">Resolvió solo</span>
        <span class="nbStatVal">${sessionStats.solvedAlone}<em>/ ${stats.total}</em></span>
        <div class="nbStatBar"><div class="nbStatBarFill" style="width:${barPct}%"></div></div>
      </div>
      <div class="nbStatCell">
        <span class="nbStatEye">Tiempo tutor</span>
        <span class="nbStatVal">${fmtTime(sessionStats.totalSecs)}</span>
      </div>
      <div class="nbStatCell">
        <span class="nbStatEye">Tiempo medio / tarea</span>
        <span class="nbStatVal">${fmtTime(avgSecs)}</span>
      </div>
      <div class="nbStatCell">
        <span class="nbStatEye">Tareas hechas</span>
        <span class="nbStatVal nbStatVal--sm">${stats.done}<em>/ ${stats.total}</em> · ${pct}%</span>
      </div>
    `;
  } else {
    statsGrid.className = "nbStatsGrid";
    statsGrid.innerHTML = `
      <div class="nbStatCell">
        <span class="nbStatEye">Resolvió solo</span>
        <span class="nbStatVal">${sessionStats.solvedAlone}<em>/ ${stats.total}</em></span>
        <div class="nbStatBar"><div class="nbStatBarFill" style="width:${barPct}%"></div></div>
      </div>
      <div class="nbStatCell">
        <span class="nbStatEye">Tiempo tutor</span>
        <span class="nbStatVal">${fmtTime(sessionStats.totalSecs)}</span>
      </div>
      <div class="nbStatCell">
        <span class="nbStatEye">Tiempo medio / tarea</span>
        <span class="nbStatVal">${fmtTime(avgSecs)}</span>
      </div>
      <div class="nbStatCell">
        <span class="nbStatEye">Tareas completadas</span>
        <span class="nbStatVal nbStatVal--sm">${stats.done}<em>/ ${stats.total}</em></span>
      </div>
    `;
  }
  card.appendChild(statsGrid);

  // ── Progress expandable ───────────────────────────────────────────────────
  if (progressTasks.length > 0) {
    if (showNotaMedia) {
      // Term mode: same visual structure as exam/work sections
      const sect = document.createElement("section");
      sect.className = "nbSect nbSect--tasks";

      const sectHead = document.createElement("header");
      sectHead.className = "nbSectHead";

      const leftEl = document.createElement("span");
      leftEl.className = "nbSectLeft";
      leftEl.innerHTML = `<span class="nbSectDot nbSectDot--tareas"></span> Progreso de tareas`;

      const rightEl = document.createElement("div");
      rightEl.className = "nbSectRight";

      const countSpan = document.createElement("span");
      countSpan.className = "nbSectCount";
      countSpan.textContent = `${progressTasks.length} tarea${progressTasks.length !== 1 ? "s" : ""}`;
      rightEl.appendChild(countSpan);

      const verBtn = document.createElement("button");
      verBtn.className = "nbVerBtn";
      verBtn.type = "button";
      verBtn.textContent = "Ver";
      verBtn.dataset.nbAction = "open-task-list";
      verBtn.dataset.studentId = studentId;
      rightEl.appendChild(verBtn);

      sectHead.appendChild(leftEl);
      sectHead.appendChild(rightEl);
      sect.appendChild(sectHead);
      card.appendChild(sect);
    } else {
      // Other modes: inline toggle with original expandRow style
      const expandRow = document.createElement("div");
      expandRow.className = "nbExpandRow";
      expandRow.dataset.nbAction = "toggle-progress";
      expandRow.dataset.studentId = studentId;
      expandRow.setAttribute("role", "button");
      expandRow.setAttribute("tabindex", "0");
      expandRow.innerHTML = `
        <span class="nbExpandTitle"><span class="nbExpandDot"></span> Progreso de tareas</span>
        <span class="nbExpandCount">Ver ${progressTasks.length} tareas <span class="nbNeedsHelpChevron">›</span></span>
      `;
      card.appendChild(expandRow);

      const progList = document.createElement("div");
      progList.className = "nbProgList";
      progList.id = `nbProgress_${studentId}`;
      progList.style.display = "none";

      progressTasks.forEach(pt => {
        const item = document.createElement("div");
        item.className = "nbProgItem";
        const statusCls = pt.status === "resolved" ? "resolved" : pt.status === "help" ? "help" : "pend";
        item.innerHTML = `
          <span class="nbProgStatus nbProgStatus--${statusCls}"></span>
          <span class="nbProgTitle">${escHtml(pt.taskTitle)}</span>
          <span class="nbProgDate">${escHtml(pt.sessionDate || "")}</span>
        `;
        const btn = document.createElement("button");
        btn.className = "btn ghost nbBtn";
        btn.type = "button";
        btn.textContent = "Ver";
        btn.dataset.nbAction = "view-conversation";
        btn.dataset.studentId = studentId;
        btn.dataset.dayKey = pt.sessionDate;
        btn.dataset.taskTitle = pt.taskTitle;
        btn.dataset.taskId = pt.taskId;
        btn.dataset.sessionId    = pt.sessionId || "";
        btn.dataset.sessionCount = pt.sessionCount || 1;
        item.appendChild(btn);
        progList.appendChild(item);
      });
      card.appendChild(progList);
    }
  }

  // ── Grades (exam + work) ──────────────────────────────────────────────────
  ["exam", "work"].forEach(type => {
    const sect = renderGradeSection(type, { 
      cardGrades, 
      typePeriodTasks: type === "exam" ? periodExamTasks : periodWorkTasks, 
      studentId, showNotaMedia 
    });
    card.appendChild(sect);
  });

  // ── AI report block ────────────────────────────────────────────────────────
  const reportArea = document.createElement("div");
  reportArea.id = `nbReport_${studentId}`;
  reportArea.className = "nbAiBlock";

  if (showNotaMedia) {
    const examIds = new Set(periodExamTasks.map(t => t.id));
    const workIds = new Set(periodWorkTasks.map(t => t.id));
    const hwTasks = progressTasks.filter(pt => !examIds.has(pt.taskId) && !workIds.has(pt.taskId));
    _reportStatsCache.set(studentId, {
      notaMediaVal, cardGrades, stats, sessionStats,
      hwDone: hwTasks.filter(pt => pt.status === "resolved").length,
      hwTotal: hwTasks.length,
    });
    reportArea.innerHTML = `
      <div class="nbAiContent">
        <button class="nbAiBtn" type="button"
          data-nb-action="open-report-drawer"
          data-student-id="${studentId}"
          data-group-id="${groupId}">✦ Ver estadísticas e informe</button>
      </div>`;
  } else {
    reportArea.innerHTML = `
      <div class="nbAiContent">
        <div>
          <div class="nbAiTitle">Resumen narrativo</div>
          <div class="nbAiSub">La IA escribe un informe a partir de estos datos</div>
        </div>
        <button class="nbAiBtn" type="button"
          data-nb-action="generate-report"
          data-student-id="${studentId}"
          data-group-id="${groupId}">✦ Generar informe IA</button>
      </div>`;
  }
  card.appendChild(reportArea);

  return card;
}

// ── Period rendering (student or class view) ───────────────────────────────

export function renderPeriodStudentView(ctx, {
  students, summaryById, summaryByName, periodTasks,
  taskTypeMap, taskTitleMap, sessions, periodGrades, allTickets, groupId,
  subjects = [], gradeWeights = [], notebookMode = "week",
}) {
  const asCount = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0; };
  const nameKey = s => String(formatStudentName(normalizeStudent(s)) || "").trim().toLowerCase();
  const periodExamTasks = periodTasks.filter(t => t.type === "exam");
  const periodWorkTasks = periodTasks.filter(t => t.type === "work");

  const showNotaMedia = notebookMode === "term" && subjects.length > 0;

  const sessionsByStudent = new Map();
  sessions.forEach(s => {
    if (!sessionsByStudent.has(s.student_id)) sessionsByStudent.set(s.student_id, []);
    sessionsByStudent.get(s.student_id).push(s);
  });

  const gradesByStudent = new Map();
  periodGrades.forEach(g => {
    if (!gradesByStudent.has(g.student_id)) gradesByStudent.set(g.student_id, []);
    gradesByStudent.get(g.student_id).push({
      ...g,
      _taskType: taskTypeMap.get(g.task_id) || "other",
      _taskTitle: taskTitleMap.get(g.task_id) || "",
    });
  });

  students.forEach(student => {
    const summaryMatch = summaryById.get(String(student.id || "").trim()) || summaryByName.get(nameKey(student));
    let stats = {
      total: asCount(summaryMatch?.tasks_total) || periodTasks.length,
      done: asCount(summaryMatch?.tasks_done) || countLocalDone(ctx, student.id, periodTasks),
      needs: asCount(summaryMatch?.tickets_open),
    };

    const stuSessions = sessionsByStudent.get(student.id) || [];
    const latestByTask = new Map();
    const sessionsByTask = new Map();
    stuSessions.forEach(s => {
      const prev = latestByTask.get(s.task_id);
      if (!prev || s.created_at > prev.created_at) latestByTask.set(s.task_id, s);
      if (!sessionsByTask.has(s.task_id)) sessionsByTask.set(s.task_id, []);
      sessionsByTask.get(s.task_id).push(s);
    });

    const progressTasks = periodTasks.map(task => {
      const latestSession  = latestByTask.get(task.id);
      const taskSessions   = sessionsByTask.get(task.id) || [];
      const _outcome = latestSession?.outcome;
      const status = !latestSession ? "pending"
        : latestSession.needs_help ? "help"
        : _outcome === "completed" ? "resolved"
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

    const sessionDays = new Set(stuSessions.map(s => s.session_date)).size;
    const periodTaskIds = new Set(periodTasks.map(t => t.id));
    const sessionStats = {
      totalSecs: stuSessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0),
      solvedAlone: [...latestByTask.entries()]
        .filter(([taskId, s]) => periodTaskIds.has(taskId) && !s.needs_help).length,
      neededHelp: progressTasks.filter(t => t.status === "help").length,
      sessionDays,
    };

    const openTickets = allTickets
      .filter(t => t.studentId === student.id && t.status === "open" && t.groupId === groupId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    let estadoInfo;
    if (stats.needs > 0 || openTickets.length > 0) estadoInfo = { type: "needs_help", ticketId: openTickets[0]?.id || "" };
    else if (summaryMatch?.status === "submitted" || (stats.total > 0 && stats.done >= stats.total)) estadoInfo = { type: "al_dia" };
    else estadoInfo = { type: "pending" };

    _progressTasksCache.set(student.id, {
      studentName: formatStudentName(normalizeStudent(student)) || "Alumno",
      progressTasks,
    });

    const card = buildStudentCard(student, {
      stats, sessionStats, progressTasks,
      cardGrades: gradesByStudent.get(student.id) || [],
      estadoInfo, groupId,
      periodExamTasks,
      periodWorkTasks,
      gradeWeights,
      showNotaMedia,
    });
    ctx.elements.notebookGrid.appendChild(card);
  });
}

export { compareBySurname, normalizeStudent };
