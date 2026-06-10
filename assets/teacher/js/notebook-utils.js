import { formatStudentName, normalizeStudent } from "./state.js";

export function countLocalDone(ctx, studentId, periodTasks) {
  const statuses = ctx.state.data.taskStatus?.[ctx.state.currentTeacherId] || {};
  return periodTasks.filter(t => statuses[t.id]?.[studentId] === "done").length;
}

export function fmtTime(secs) {
  if (!secs) return "—";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}min`;
  return `${Math.floor(mins / 60)}h ${mins % 60 > 0 ? ` ${mins % 60}min` : ""}`.trim();
}

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