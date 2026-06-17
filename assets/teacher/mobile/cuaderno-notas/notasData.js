// notasData.js — API calls for the mobile "Poner notas" (bulk grading) flow.
// Mirrors exactly the endpoints used by desktop's task-picker-drawer.js and
// bulk-grade-drawer.js. No new endpoints. All functions receive apiFetch
// as an explicit parameter.

export async function mtFetchGradableTasks(apiFetch, groupId) {
  const url  = `/api/v1/tasks?group_id=${encodeURIComponent(groupId)}&history=true&limit=500&offset=0`;
  const res  = await apiFetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return [];
  return (body?.data?.items || []).filter(t => t.type === "exam" || t.type === "work");
}

export async function mtFetchGradesForTask(apiFetch, taskId) {
  const res  = await apiFetch(`/api/v1/grades?task_id=${encodeURIComponent(taskId)}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return [];
  return body?.data || [];
}

export async function mtSaveBulkGrades(apiFetch, taskId, grades) {
  const res = await apiFetch("/api/v1/grades/bulk", {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ task_id: taskId, grades }),
  });
  return res.ok;
}
