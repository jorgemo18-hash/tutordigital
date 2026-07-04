import { escHtml } from "../adminUtils.js";

// Lista de docentes asignados a un grupo — solo lectura, se muestra en el
// panel lateral del nivel 4 (Grupos → grupo → Alumnos).

export function renderGroupTeachers(state, groupId) {
  const el = document.getElementById("groupTeachersList");
  if (!el) return;
  const items = (state.teachers || []).filter((t) => (t.groups || []).some((g) => g.id === groupId));
  if (!items.length) { el.innerHTML = '<p class="emptyState">No hay docentes asignados a este grupo todavía.</p>'; return; }
  el.innerHTML = items.map((t) => {
    const subjects = t.subjects?.length
      ? t.subjects.map((s) => `<span class="chip">${escHtml(s)}</span>`).join("")
      : '<span class="teacherMeta">Sin materias</span>';
    const groupEntry = (t.groups || []).find((g) => g.id === groupId);
    const tutorBadge = groupEntry?.is_tutor ? ' <span class="chip">tutoría</span>' : "";
    return `
      <article class="teacherCard">
        <div class="teacherTop">
          <div>
            <div class="teacherName">${escHtml(t.display_name || "Docente")}</div>
            <div class="teacherMeta">${escHtml(t.email || "")}</div>
          </div>
        </div>
        <div class="chips">${subjects}${tutorBadge}</div>
      </article>`;
  }).join("");
}
