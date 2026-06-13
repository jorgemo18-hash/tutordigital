import { escHtml } from "./adminUtils.js";

function teacherInitials(name, email) {
  const words = String(name || email || "?").trim().split(/\s+/).filter(Boolean);
  return words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : String(words[0] || "?").slice(0, 2).toUpperCase();
}

function teacherStatusBadge(invite) {
  const s = String(invite?.status || "").toLowerCase();
  if (s === "used")    return `<span class="av-status ok"><span class="dot"></span>Activo</span>`;
  if (s === "pending") return `<span class="av-status pending"><span class="dot"></span>Pendiente</span>`;
  if (s === "revoked") return `<span class="av-status"><span class="dot"></span>Revocada</span>`;
  return `<span></span>`;
}

function groupBySubject(item) {
  const map = new Map();
  for (const g of (item.groups || [])) {
    for (const s of (g.subjects || [])) {
      if (!s) continue;
      const list = map.get(s) || [];
      list.push(g.name);
      map.set(s, list);
    }
  }
  return map;
}

export function renderTeacherList({ container, teachers, expandedTeachers, pendingInviteUrls }) {
  if (!container) return;
  if (!teachers?.length) {
    container.innerHTML = '<p class="emptyState">No hay docentes creados todavía.</p>';
    return;
  }

  container.innerHTML = teachers.map(item => {
    const invite     = item.invite || null;
    const isPending  = invite?.status === "pending";
    const initials   = teacherInitials(item.display_name, item.email);
    const teacherKey = item.id || item.email;
    const isExpanded = expandedTeachers.has(teacherKey);

    const verGruposBtn = `<button class="btn ghost small" data-ver-grupos="${escHtml(teacherKey)}" type="button">${isExpanded ? "Ocultar" : "Ver grupos"}</button>`;

    let expandHtml = "";
    if (isExpanded) {
      const copyLinkBtn = (isPending && pendingInviteUrls.has(item.email))
        ? `<button class="btn ghost small copyInviteLinkBtn" data-copy-invite-email="${escHtml(item.email)}" type="button">Copiar enlace</button>`
        : "";
      const revokeBtn = isPending && invite?.id
        ? `<button class="btn ghost small" data-revoke-id="${invite.id}" type="button">Revocar</button>`
        : "";
      const actionsHtml = (revokeBtn || copyLinkBtn)
        ? `<div class="av-doc-actions">${revokeBtn}${copyLinkBtn}</div>` : "";

      const bySubject = groupBySubject(item);
      const subjectRowsHtml = bySubject.size
        ? [...bySubject.entries()].map(([subject, groups]) => `
            <div class="av-subject-row">
              <span class="av-subject-name">${escHtml(subject)}</span>
              <div class="av-subject-groups">${groups.map(g => `<span class="av-chip">${escHtml(g)}</span>`).join("")}</div>
            </div>`).join("")
        : `<p class="av-no-assign">Sin asignaciones configuradas</p>`;

      expandHtml = `<div class="av-doc-expand">${subjectRowsHtml}${actionsHtml}</div>`;
    }

    return `
      <div class="av-doc-entry${isExpanded ? " expanded" : ""}" data-teacher-key="${escHtml(teacherKey)}">
        <div class="av-doc-row${isPending ? " pending" : ""}">
          <div class="av-avatar">${escHtml(initials)}</div>
          <div>
            <div class="av-cell-name">${escHtml(item.display_name || "Docente")}</div>
            <div class="av-cell-sub">${escHtml(item.email || "")}</div>
          </div>
          ${teacherStatusBadge(invite)}
          ${verGruposBtn}
        </div>
        ${expandHtml}
      </div>`;
  }).join("");
}
