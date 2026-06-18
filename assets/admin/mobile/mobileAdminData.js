// mobileAdminData.js — API calls for the mobile admin panel. Same endpoints
// as the desktop admin modules (assets/admin/modules/). Every function
// receives fetchJSON as an explicit parameter — no shared state, no
// closures over panel scope.

export function fetchDashboard(fetchJSON) {
  return fetchJSON("/api/v1/admin/dashboard");
}

export function fetchGroups(fetchJSON) {
  return fetchJSON("/api/v1/admin/groups");
}

export function createGroup(fetchJSON, { name, stage, year, track }) {
  return fetchJSON("/api/v1/admin/groups", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ name, stage, year, track }),
  });
}

export function deleteGroup(fetchJSON, groupId) {
  return fetchJSON(`/api/v1/admin/groups/${groupId}`, { method: "DELETE" });
}

export function regenerateGroupCode(fetchJSON, groupId) {
  return fetchJSON(`/api/v1/admin/groups/${groupId}/regenerate-code`, { method: "POST" });
}

export function fetchGroupStudents(fetchJSON, groupId) {
  return fetchJSON(`/api/v1/admin/groups/${groupId}/students`);
}

export function fetchTeachers(fetchJSON) {
  return fetchJSON("/api/v1/admin/teachers");
}

export function inviteTeacher(fetchJSON, payload) {
  return fetchJSON("/api/v1/admin/teachers/invite", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });
}

export function fetchAllStudents(fetchJSON) {
  return fetchJSON("/api/v1/admin/students");
}

export function inviteStudent(fetchJSON, groupId, { email, first_name, last_name }) {
  return fetchJSON(`/api/v1/admin/groups/${groupId}/students`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ email, first_name, last_name }),
  });
}

export function importStudents(fetchJSON, groupId, emails) {
  return fetchJSON(`/api/v1/admin/groups/${groupId}/students/import`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ emails }),
  });
}

export function resendStudentInvite(fetchJSON, groupId, studentId) {
  return fetchJSON(`/api/v1/admin/groups/${groupId}/students/${studentId}/resend`, { method: "POST" });
}

export function revokeStudent(fetchJSON, groupId, studentId) {
  return fetchJSON(`/api/v1/admin/groups/${groupId}/students/${studentId}`, { method: "DELETE" });
}

export function deleteStudentPermanently(fetchJSON, studentId) {
  return fetchJSON(`/api/v1/admin/students/${studentId}`, { method: "DELETE" });
}
