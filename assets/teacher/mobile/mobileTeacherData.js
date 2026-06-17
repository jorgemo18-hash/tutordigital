// mobileTeacherData.js — API calls for mobile teacher panel.
// All functions receive apiFetch as an explicit parameter.

import { getWeekDays, formatYMDLocal } from "../js/notebook-week.js";

export async function mtFetchGroups(apiFetch) {
  const res  = await apiFetch("/api/v1/groups?limit=50&offset=0");
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return [];
  return (body?.data?.items || []).map(g => ({
    id: g.id,
    name: g.name || "Grupo",
    level: g.level || null,
    subject_name: g.subject_name || null,
    student_count: g.student_count || 0,
  }));
}

export async function mtFetchStudents(apiFetch, groupId) {
  const url  = `/api/v1/students?group_id=${encodeURIComponent(groupId)}&approval_status=approved&limit=200&offset=0`;
  const res  = await apiFetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return [];
  return (body?.data?.items || []).map(s => ({
    id:      s.id,
    name:    String(s.display_name || s.name || "Alumno").trim(),
    groupId: s.group_id || groupId,
  }));
}

export async function mtFetchSessionsRange(apiFetch, groupId, from, to) {
  const url  = `/api/v1/tutor-sessions?group_id=${encodeURIComponent(groupId)}&from=${from}&to=${to}`;
  const res  = await apiFetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return [];
  return body?.data || [];
}

export async function mtFetchSessionsForWeek(apiFetch, groupId, weekOffset) {
  const days = getWeekDays(weekOffset);
  const from = formatYMDLocal(days[0]);
  const to   = formatYMDLocal(days[4]);
  return mtFetchSessionsRange(apiFetch, groupId, from, to);
}

export async function mtFetchTasks(apiFetch, groupId, limit = 100) {
  const url  = `/api/v1/tasks?groupId=${encodeURIComponent(groupId)}&limit=${limit}`;
  const res  = await apiFetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return [];
  return body?.data?.items || [];
}

export async function mtFetchSubjects(apiFetch, groupId) {
  const url  = `/api/v1/subjects?group_id=${encodeURIComponent(groupId)}`;
  const res  = await apiFetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return [];
  return body?.data || [];
}

export async function mtFetchSessionDetail(apiFetch, sessionId) {
  const res  = await apiFetch(`/api/v1/session/${encodeURIComponent(sessionId)}/detail`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return body?.data || {};
}

export async function mtCreateTask(apiFetch, payload) {
  const res  = await apiFetch("/api/v1/tasks", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || `HTTP ${res.status}`);
  return body?.data;
}

export async function mtDeleteTask(apiFetch, taskId) {
  const res = await apiFetch("/api/v1/tasks", {
    method:  "DELETE",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ id: taskId }),
  });
  return res.ok;
}

export async function mtUploadAttachment(apiFetch, taskId, file) {
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const res = await apiFetch("/api/v1/attachments", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ task_id: taskId, file_name: file.name, mime: file.type, data }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || `HTTP ${res.status}`);
  return body?.data;
}

export async function mtMarkReviewed(apiFetch, sessionId) {
  const res = await apiFetch(
    `/api/v1/tutor-sessions/${encodeURIComponent(sessionId)}/review`,
    { method: "PATCH" }
  );
  return res.ok;
}
