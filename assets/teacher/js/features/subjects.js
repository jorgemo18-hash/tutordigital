import { apiFetch } from "../../../shared/js/auth.js";

export async function loadSubjectsForGroup(ctx, groupId) {
  const { elements, state } = ctx;
  if (!elements.subjectSelect || !groupId) return;

  try {
    const res = await apiFetch(`/api/v1/subjects?group_id=${encodeURIComponent(groupId)}`);
    if (!res.ok) return;
    const body = await res.json().catch(() => ({}));
    const subjects = body?.data || [];

    state.currentSubjectFilter = "";

    if (!subjects.length) {
      if (elements.subjectSelectWrap) elements.subjectSelectWrap.style.display = "none";
      return;
    }

    if (subjects.length === 1) {
      // Single subject: auto-filter, show name only (no dropdown)
      state.currentSubjectFilter = subjects[0].name;
      elements.subjectSelect.style.display = "none";
      if (elements.subjectSingleName) {
        elements.subjectSingleName.textContent = subjects[0].name;
        elements.subjectSingleName.style.display = "";
      }
      if (elements.subjectSelectWrap) elements.subjectSelectWrap.style.display = "";
    } else {
      // Multiple subjects: show select with teacher's subjects, no "Todas las asignaturas"
      elements.subjectSelect.style.display = "";
      if (elements.subjectSingleName) elements.subjectSingleName.style.display = "none";
      elements.subjectSelect.innerHTML = subjects.map(s => {
        const opt = document.createElement("option");
        opt.value = s.name;
        opt.textContent = s.name;
        return opt.outerHTML;
      }).join("");
      elements.subjectSelect.value = subjects[0].name;
      state.currentSubjectFilter = subjects[0].name;
      if (elements.subjectSelectWrap) elements.subjectSelectWrap.style.display = "";
    }

    // Populate task form subject selector
    if (elements.taskSubject) {
      elements.taskSubject.innerHTML = `<option value="">— Sin asignatura —</option>`;
      subjects.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.name;
        opt.textContent = s.name;
        elements.taskSubject.appendChild(opt);
      });
    }
  } catch {
    // subjects are optional — silent fail
  }
}
