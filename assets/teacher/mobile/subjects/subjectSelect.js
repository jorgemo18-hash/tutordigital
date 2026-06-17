// subjectSelect.js — Shared subject-filter logic for the mobile teacher panel:
// fetching (with a per-group cache), populating a <select>, and wiring it up
// to persist the choice. Used by Cuaderno, Agenda, and the new-task sheet.

import { mtFetchSubjects } from "../mobileTeacherData.js";
import { getSavedSubjectName, saveSubjectName } from "./subjectPrefs.js";

// Caches the subjects-per-group lookup on mtState so switching tabs or
// re-running a refresh doesn't re-fetch on every interaction.
export async function ensureSubjectsForGroup(mtState, apiFetch, groupId) {
  if (!groupId) return [];
  mtState.subjectsByGroup = mtState.subjectsByGroup || {};
  if (mtState.subjectsByGroup[groupId]) return mtState.subjectsByGroup[groupId];
  const subjects = await mtFetchSubjects(apiFetch, groupId).catch(() => []);
  mtState.subjectsByGroup[groupId] = subjects;
  return subjects;
}

// Populates selectEl with one <option> per subject and resolves which value
// should end up selected. With includeEmptyOption, adds a blank "no subject"
// choice up front (used by the new-task form); otherwise always resolves to
// a concrete subject (used by the Cuaderno/Agenda filters).
export function renderSubjectOptions(selectEl, subjects, preferredName, { includeEmptyOption = false } = {}) {
  if (!selectEl) return "";
  if (!subjects.length && !includeEmptyOption) {
    selectEl.innerHTML = "";
    selectEl.hidden = true;
    return "";
  }

  selectEl.hidden = false;
  selectEl.innerHTML = "";

  if (includeEmptyOption) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "— Sin asignatura —";
    selectEl.appendChild(empty);
  }

  subjects.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.name;
    opt.textContent = s.name;
    selectEl.appendChild(opt);
  });

  if (!subjects.length) {
    selectEl.value = "";
    return "";
  }

  const resolved = subjects.some(s => s.name === preferredName)
    ? preferredName
    : (includeEmptyOption ? "" : subjects[0].name);
  selectEl.value = resolved;
  return resolved;
}

// Loads + renders the subject filter for a group selector, restoring the
// saved preference and persisting future changes. onChange runs after the
// value updates (typically the page's own refresh()).
export async function wireSubjectFilter({ selectEl, mtState, apiFetch, groupId, onChange }) {
  if (!selectEl || !groupId) return "";
  const subjects = await ensureSubjectsForGroup(mtState, apiFetch, groupId);
  const preferred = mtState.currentSubjectName || getSavedSubjectName(groupId);
  const resolved = renderSubjectOptions(selectEl, subjects, preferred);
  mtState.currentSubjectName = resolved;
  selectEl.addEventListener("change", () => {
    mtState.currentSubjectName = selectEl.value;
    saveSubjectName(groupId, selectEl.value);
    onChange();
  });
  return resolved;
}
