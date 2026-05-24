import { compareBySurname, normalizeStudent, formatStudentName } from "./state.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function countLocalDone(ctx, studentId, periodTasks) {
  const statuses = ctx.state.data.taskStatus?.[ctx.state.currentTeacherId] || {};
  return periodTasks.filter(t => statuses[t.id]?.[studentId] === "done").length;
}

export function fmtTime(secs) {
  if (!secs) return "—";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}min`;
  return `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? ` ${mins % 60}min` : ""}`.trim();
}

function badgeEl(estadoInfo) {
  if (estadoInfo.type === "needs_help") return null;
  const b = document.createElement("span");
  b.className = `nb-ticket-badge ${estadoInfo.type === "al_dia" ? "al-dia" : "pending"}`;
  b.textContent = estadoInfo.type === "al_dia" ? "Al día" : "Pendiente";
  return b;
}

// ── Student card ───────────────────────────────────────────────────────────

export function buildStudentCard(student, { stats, sessionStats, progressTasks, cardGrades, estadoInfo, groupId }) {
  const studentId = String(student?.id || "").trim();
  const card = document.createElement("article");
  card.className = "nbStudentCard";
  card.dataset.studentId = studentId;

  // ── Head: avatar + name/sub + pct chip ───────────────────────────────────
  const name = formatStudentName(student) || "Sin nombre";
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("");
  const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  const head = document.createElement("header");
  head.className = "nbScHead";
  head.innerHTML = `
    <div class="nbAvatar">${initials}</div>
    <div class="nbScInfo">
      <div class="nbScName">${name}</div>
      <div class="nbScSub">${stats.done} / ${stats.total} tareas</div>
    </div>
    <div class="nbPctChip">
      <span class="nbPctNum">${pct}%</span>
      <span class="nbPctLbl">Tareas hechas</span>
    </div>
  `;
  card.appendChild(head);

  // ── Stats 2×2 ─────────────────────────────────────────────────────────────
  const avgSecs = sessionStats.sessionDays > 0
    ? Math.round(sessionStats.totalSecs / sessionStats.sessionDays) : 0;
  const barPct = stats.total > 0
    ? Math.min(100, Math.round((sessionStats.solvedAlone / stats.total) * 100)) : 0;

  const statsGrid = document.createElement("div");
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
  card.appendChild(statsGrid);

  // ── Progress expandable ───────────────────────────────────────────────────
  if (progressTasks.length > 0) {
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
        <span class="nbProgTitle">${pt.taskTitle}</span>
        <span class="nbProgDate">${pt.sessionDate || ""}</span>
      `;
      if (pt.status === "help") {
        const btn = document.createElement("button");
        btn.className = "btn ghost nbBtn";
        btn.type = "button";
        btn.textContent = "Ver";
        btn.dataset.nbAction = "view-conversation";
        btn.dataset.studentId = studentId;
        btn.dataset.dayKey = pt.sessionDate;
        btn.dataset.taskTitle = pt.taskTitle;
        item.appendChild(btn);
      }
      progList.appendChild(item);
    });
    card.appendChild(progList);
  }

  // ── Grades (exam + work) ──────────────────────────────────────────────────
  ["exam", "work"].forEach(type => {
    const label = type === "exam" ? "Exámenes" : "Trabajos";
    const dotCls = type === "exam" ? "nbSectDot--examenes" : "nbSectDot--trabajos";
    const typeGrades = cardGrades.filter(g => g._taskType === type);

    const sect = document.createElement("section");
    sect.className = `nbSect nbSect--${type}`;

    const sectHead = document.createElement("header");
    sectHead.className = "nbSectHead";
    sectHead.innerHTML = `
      <span class="nbSectLeft"><span class="nbSectDot ${dotCls}"></span> ${label}</span>
      <span>${typeGrades.length}</span>
    `;
    sect.appendChild(sectHead);

    if (!typeGrades.length) {
      const empty = document.createElement("div");
      empty.className = "nbSectEmpty";
      empty.textContent = "Sin notas en el periodo";
      sect.appendChild(empty);
    } else {
      typeGrades.forEach(g => {
        const row = document.createElement("div");
        row.className = "nbGradeRow";
        row.innerHTML = `
          <div class="nbGradeLabel">
            ${g._taskTitle || g.title || "—"}
            <span class="nbGradeSub">${g.due_date || ""}</span>
          </div>
          <div class="nbGradeScore">${g.score}</div>
        `;
        sect.appendChild(row);
      });
    }
    card.appendChild(sect);
  });

  // ── AI report block (CTA inicial; modals.js reemplaza innerHTML al generar) ─
  const reportArea = document.createElement("div");
  reportArea.id = `nbReport_${studentId}`;
  reportArea.className = "nbAiBlock";
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
    </div>
  `;
  card.appendChild(reportArea);

  return card;
}

// ── Class aggregated card ──────────────────────────────────────────────────

export function buildClassCard({ students, allStats, allSessions, periodGrades, periodTasks, groupName }) {
  let totalAssigned = 0;
  let totalDone = 0;
  let totalSecs = 0;
  const needsCount = new Map(); // studentId → count of needs_help sessions

  students.forEach(s => {
    const stats = allStats.get(s.id) || { total: 0, done: 0 };
    totalAssigned += stats.total;
    totalDone += stats.done;

    const sessions = allSessions.get(s.id) || [];
    const stuSecs = sessions.reduce((acc, sess) => acc + (sess.duration_seconds || 0), 0);
    totalSecs += stuSecs;

    const helpCount = sessions.filter(sess => sess.needs_help).length;
    if (helpCount > 0) needsCount.set(s.id, helpCount);
  });

  const avgSecs = students.length > 0 ? Math.round(totalSecs / students.length) : 0;
  const pct = totalAssigned > 0 ? Math.round((totalDone / totalAssigned) * 100) : 0;

  // Top 3 needs help
  const top3 = [...needsCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => {
      const s = students.find(st => st.id === id);
      return { name: s ? formatStudentName(s) : id, count };
    });

  // Grade average (numeric scores only, exam tasks)
  const examGrades = periodGrades.filter(g => {
    const task = periodTasks.find(t => t.id === g.task_id);
    return task?.type === "exam";
  });
  const numericScores = examGrades
    .map(g => parseFloat(String(g.score || "").replace(",", ".")))
    .filter(n => Number.isFinite(n) && n >= 0 && n <= 10);
  const gradeAvg = numericScores.length > 0
    ? (numericScores.reduce((a, b) => a + b, 0) / numericScores.length).toFixed(1)
    : null;

  const card = document.createElement("div");
  card.className = "nbClassCard";

  card.innerHTML = `
    <div class="nbClassCardHead">
      <span class="nbStudentName">${groupName || "Clase"}</span>
      <span class="nb-ticket-badge al-dia">${students.length} alumnos</span>
    </div>
    <div class="nbStudentCardStats nbStudentCardStats--class">
      <div class="nbStatItem">
        <span class="nbStatLabel">Tareas completadas</span>
        <span class="nbStatValue">${totalDone}/${totalAssigned} (${pct}%)</span>
      </div>
      <div class="nbStatItem">
        <span class="nbStatLabel">Tiempo medio/alumno</span>
        <span class="nbStatValue">${fmtTime(avgSecs)}</span>
      </div>
      ${gradeAvg ? `
      <div class="nbStatItem">
        <span class="nbStatLabel">Media exámenes</span>
        <span class="nbStatValue">${gradeAvg}</span>
      </div>` : ""}
    </div>
    ${top3.length ? `
    <div class="nbGradeBlock">
      <span class="nbGradeBlockLabel">Más necesitaron ayuda</span>
      <div class="nbHelpRanking">
        ${top3.map((item, i) => `
          <div class="nbHelpRankItem">
            <span class="nbHelpRankPos">${i + 1}</span>
            <span class="nbHelpRankName">${item.name}</span>
            <span class="nbGradeTag">${item.count} sesiones</span>
          </div>`).join("")}
      </div>
    </div>` : ""}
  `;
  return card;
}

// ── Period rendering (student or class view) ───────────────────────────────

export function renderPeriodStudentView(ctx, {
  students, summaryById, summaryByName, periodTasks,
  taskTypeMap, taskTitleMap, sessions, periodGrades, allTickets, groupId
}) {
  const asCount = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0; };
  const nameKey = s => String(formatStudentName(normalizeStudent(s)) || "").trim().toLowerCase();

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
    stuSessions.forEach(s => {
      const prev = latestByTask.get(s.task_id);
      if (!prev || s.created_at > prev.created_at) latestByTask.set(s.task_id, s);
    });

    const progressTasks = periodTasks.map(task => {
      const latestSession = latestByTask.get(task.id);
      const status = !latestSession ? "pending" : latestSession.needs_help ? "help" : "resolved";
      return {
        taskId: task.id,
        taskTitle: taskTitleMap.get(task.id) || task.title || "Tarea",
        sessionDate: latestSession?.session_date || "",
        status,
      };
    });

    const sessionDays = new Set(stuSessions.map(s => s.session_date)).size;
    const sessionStats = {
      totalSecs: stuSessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0),
      solvedAlone: [...latestByTask.values()].filter(s => !s.needs_help).length,
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

    const card = buildStudentCard(student, {
      stats, sessionStats, progressTasks,
      cardGrades: gradesByStudent.get(student.id) || [],
      estadoInfo, groupId,
    });
    ctx.elements.notebookGrid.appendChild(card);
  });
}

export function renderPeriodClassView(ctx, {
  students, summaryById, summaryByName, sessions, periodGrades, periodTasks, groupId
}) {
  const asCount = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0; };
  const nameKey = s => String(formatStudentName(normalizeStudent(s)) || "").trim().toLowerCase();

  const allStats = new Map();
  const allSessions = new Map();

  students.forEach(student => {
    const summaryMatch = summaryById.get(String(student.id || "").trim()) || summaryByName.get(nameKey(student));
    allStats.set(student.id, {
      total: asCount(summaryMatch?.tasks_total) || periodTasks.length,
      done: asCount(summaryMatch?.tasks_done) || countLocalDone(ctx, student.id, periodTasks),
    });
  });

  sessions.forEach(s => {
    if (!allSessions.has(s.student_id)) allSessions.set(s.student_id, []);
    allSessions.get(s.student_id).push(s);
  });

  const group = ctx.state.data.groups?.find(g => g.id === groupId);
  const groupName = group?.name || "Clase";

  const card = buildClassCard({ students, allStats, allSessions, periodGrades, periodTasks, groupName });
  ctx.elements.notebookGrid.appendChild(card);
}

export { compareBySurname, normalizeStudent };
