import { apiFetch } from "../../../shared/js/auth.js";

export async function loadSubjectsForGroup(ctx, groupId) {
  const { elements, state } = ctx;
  if (!elements.subjectSelect || !groupId) return;

  try {
    const res = await apiFetch(`/api/v1/subjects?group_id=${encodeURIComponent(groupId)}`);
    if (!res.ok) return;
    const body = await res.json().catch(() => ({}));
    const subjects = body?.data || [];

    // Reset filter on group change
    state.currentSubjectFilter = "";

    // Populate header selector
    elements.subjectSelect.innerHTML = `<option value="">Todas las asignaturas</option>`;
    subjects.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.name;
      opt.textContent = s.name;
      elements.subjectSelect.appendChild(opt);
    });
    elements.subjectSelect.value = "";
    if (elements.subjectSelectWrap) {
      elements.subjectSelectWrap.style.display = subjects.length ? "" : "none";
    }

    // Populate task form subject selector to match teacher's subjects for this group
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
