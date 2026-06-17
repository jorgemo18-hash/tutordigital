// subjectPrefs.js — localStorage persistence for the mobile teacher panel's
// last-selected group and per-group subject filter.

const GROUP_KEY = "mt_selected_group";
const subjectKey = groupId => `mt_selected_subject_${groupId}`;

export function getSavedGroupId() {
  try { return localStorage.getItem(GROUP_KEY) || null; } catch { return null; }
}

export function saveGroupId(groupId) {
  try { localStorage.setItem(GROUP_KEY, groupId); } catch {}
}

export function getSavedSubjectName(groupId) {
  try { return localStorage.getItem(subjectKey(groupId)) || ""; } catch { return ""; }
}

export function saveSubjectName(groupId, subjectName) {
  try { localStorage.setItem(subjectKey(groupId), subjectName || ""); } catch {}
}
