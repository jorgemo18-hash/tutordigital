// gradesData.js — API calls shared by every read-only grades list in the
// mobile teacher panel (Trimestre's Exámenes/Trabajos → Ver, Semana's
// "Notas" button). Same endpoints as desktop's grade-drawer.js.

export async function mtPatchGrade(apiFetch, gradeId, score) {
  const res = await apiFetch(`/api/v1/grades/${encodeURIComponent(gradeId)}`, {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ score }),
  });
  return res.ok;
}

export async function mtDeleteGrade(apiFetch, gradeId) {
  const res = await apiFetch(`/api/v1/grades/${encodeURIComponent(gradeId)}`, { method: "DELETE" });
  return res.ok;
}
