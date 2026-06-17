// trimestreData.js — API calls for the mobile Trimestre view.
// Mirrors exactly the endpoints used by the desktop notebook term view
// (assets/teacher/js/features/notebook.js, report-drawer.js). No new
// endpoints. All functions receive apiFetch as an explicit parameter.

export async function mtFetchTermDates(apiFetch) {
  const res  = await apiFetch("/api/v1/term-dates");
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return [];
  return Array.isArray(body?.data) ? body.data : [];
}

export async function mtFetchNotebookSummary(apiFetch, groupId, from, to) {
  const url  = `/api/v1/notebook/summary?group_id=${encodeURIComponent(groupId)}&from=${from}&to=${to}`;
  const res  = await apiFetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { students: [] };
  return body?.data || { students: [] };
}

export async function mtFetchGradesRange(apiFetch, groupId, from, to) {
  const url  = `/api/v1/grades?group_id=${encodeURIComponent(groupId)}&from=${from}&to=${to}`;
  const res  = await apiFetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return [];
  return body?.data || [];
}

export async function mtFetchGradeWeights(apiFetch, groupId, trimester) {
  const url  = `/api/v1/grade-weights?group_id=${encodeURIComponent(groupId)}&trimester=${trimester}`;
  const res  = await apiFetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return [];
  return body?.data || [];
}

export async function mtFetchTrimesterReport(apiFetch, { studentId, trimester, subjectName }) {
  const qs  = new URLSearchParams({ studentId, trimester: String(trimester), subjectName: subjectName || "" });
  const res = await apiFetch(`/api/v1/reports/trimester?${qs}`);
  if (!res.ok) return null;
  const body = await res.json().catch(() => ({}));
  return body?.data?.narrative || null;
}

export async function mtSaveTrimesterReport(apiFetch, { studentId, trimester, subjectName, narrative }) {
  await apiFetch("/api/v1/reports/trimester", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ student_id: studentId, trimester, subject_name: subjectName || "", narrative }),
  }).catch(() => {});
}

export async function mtGenerateTrimesterReport(apiFetch, { studentId, groupId, from, to }) {
  const res  = await apiFetch("/api/v1/reports/generate", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ student_id: studentId, group_id: groupId, from, to }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  return body?.data?.narrative || null;
}
