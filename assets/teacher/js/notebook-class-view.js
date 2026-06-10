import { formatStudentName, normalizeStudent } from "./state.js";
import { countLocalDone, fmtTime } from "./notebook-utils.js";

export function buildClassCard({ students, allStats, allSessions, periodGrades, periodTasks, groupName }) {
  let totalAssigned = 0;
  let totalDone = 0;
  let totalSecs = 0;
  const needsCount = new Map();

  students.forEach(s => {
    const stats = allStats.get(s.id) || { total: 0, done: 0 };
    totalAssigned += stats.total;
    totalDone += stats.done;

    const sessions = allSessions.get(s.id) || [];
    totalSecs += sessions.reduce((acc, sess) => acc + (sess.duration_seconds || 0), 0);

    const helpCount = sessions.filter(sess => sess.needs_help).length;
    if (helpCount > 0) needsCount.set(s.id, helpCount);
  });

  const avgSecs = students.length > 0 ? Math.round(totalSecs / students.length) : 0;
  const pct = totalAssigned > 0 ? Math.round((totalDone / totalAssigned) * 100) : 0;

  const top3 = [...needsCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => {
      const s = students.find(st => st.id === id);
      return { name: s ? formatStudentName(s) : id, count };
    });

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
