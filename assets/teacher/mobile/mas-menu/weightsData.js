// weightsData.js — Saves grade weights from the mobile "Configurar pesos"
// sheet. Same endpoint as desktop's notebook-weight-popover.js. Fetching
// subjects/weights reuses the existing mtFetchSubjects
// (../mobileTeacherData.js) and mtFetchGradeWeights
// (../cuaderno-trimestre/trimestreData.js) — this file only adds the
// missing PATCH.

export async function mtSaveGradeWeights(apiFetch, { subjectId, trimester, examPct, workPct, homeworkPct }) {
  const res = await apiFetch("/api/v1/grade-weights", {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      subject_id: subjectId, trimester,
      exam_pct: examPct, work_pct: workPct, homework_pct: homeworkPct,
    }),
  });
  return res.ok;
}
