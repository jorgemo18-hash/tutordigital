import { escHtml, fetchJSON } from "../adminUtils.js";

// Vista cross-grupo de alumnos invitados (pestaña "Alumnos" del panel
// admin), basada en student_invites — no confundir con registeredStudents.js
// (que lee la tabla students real, la única con approval_status/archivado).

export function studentInitials(s) {
  if (s.first_name && s.last_name) return (s.first_name[0] + s.last_name[0]).toUpperCase();
  if (s.first_name) return s.first_name.slice(0, 2).toUpperCase();
  const words = String(s.display_name || s.email || "?").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return words[0]?.slice(0, 2).toUpperCase() || "?";
}

export function studentFullName(s) {
  if (s.first_name || s.last_name) return [s.first_name, s.last_name].filter(Boolean).join(" ");
  return s.display_name || s.email;
}

export function updateAlumnosSubtitle(total, pending) {
  const el = document.getElementById("alumnosSubtitle");
  if (!el) return;
  const parts = [`${total} alumnos`];
  if (pending > 0) parts.push(`${pending} pendientes`);
  el.textContent = parts.join(" · ");
}

export function populateGroupFilter(state) {
  const sel = document.getElementById("alumnosGroupFilter");
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">Todos los grupos</option>';
  const groups = state.adminGroups?.length ? state.adminGroups : (state.allGroups || []);
  groups.forEach(g => {
    const opt = document.createElement("option");
    opt.value = g.id; opt.textContent = g.name;
    sel.appendChild(opt);
  });
  if (current) sel.value = current;
}

export function renderAllStudents(state) {
  const el = document.getElementById("alumnosList");
  if (!el) return;

  const q = String(document.getElementById("alumnosSearch")?.value || "").toLowerCase().trim();
  const groupId = document.getElementById("alumnosGroupFilter")?.value || "";

  const items = (state.allStudents || []).filter(s => {
    if (groupId && s.group_id !== groupId) return false;
    if (q) {
      const name = String(s.display_name || "").toLowerCase();
      const email = String(s.email || "").toLowerCase();
      const group = String(s.group_name || "").toLowerCase();
      if (!name.includes(q) && !email.includes(q) && !group.includes(q)) return false;
    }
    return true;
  });

  if (!items.length) {
    el.innerHTML = '<p class="emptyState">No hay alumnos que coincidan con la búsqueda.</p>';
    return;
  }

  el.innerHTML = items.map(s => {
    const isPending = s.status === "pending";
    const initials  = studentInitials(s);
    const actionBtn = isPending
      ? `<button class="btn ghost small" data-tab-resend-student="${escHtml(s.id)}" data-tab-group-id="${escHtml(s.group_id)}" type="button">Reenviar</button>`
      : `<button class="btn ghost small" data-tab-revoke-student="${escHtml(s.id)}" data-tab-group-id="${escHtml(s.group_id)}" type="button">Revocar</button>`;
    const badge = isPending
      ? `<span class="av-status pending"><span class="dot"></span>Pendiente</span>`
      : `<span class="av-status ok"><span class="dot"></span>Activo</span>`;

    return `
      <div class="av-st-row${isPending ? " pending" : ""}">
        <div class="av-avatar" style="width:32px;height:32px;font-size:11px">${escHtml(initials)}</div>
        <div>
          <div class="av-cell-name">${escHtml(studentFullName(s))}</div>
          <div class="av-cell-sub">${escHtml(s.group_name || "—")}</div>
        </div>
        <div class="av-st-mail">${escHtml(s.email)}</div>
        ${badge}
        <div style="display:flex;gap:6px;align-items:center">
          ${actionBtn}
          <button class="btn ghost small" data-tab-delete-student="${escHtml(s.id)}" data-tab-student-name="${escHtml(studentFullName(s))}" type="button" style="color:var(--danger,#e55)">Eliminar</button>
        </div>
      </div>`;
  }).join("");
}

export async function loadAllStudents(state) {
  const errEl = document.getElementById("alumnosError");
  if (errEl) errEl.textContent = "";
  try {
    const data = await fetchJSON("/api/v1/admin/students");
    state.allStudents = data?.items || [];
    updateAlumnosSubtitle(data?.total ?? state.allStudents.length, data?.pending_count ?? 0);
    populateGroupFilter(state);
    renderAllStudents(state);
  } catch (err) {
    if (errEl) errEl.textContent = err?.message || "No se pudieron cargar los alumnos.";
  }
}

export async function deleteStudentPermanently(state, studentId, studentName) {
  const confirmed = confirm(
    `¿Seguro que quieres eliminar a "${studentName}"?\n\nEsta acción no se puede deshacer y eliminará todos los datos del alumno (sesiones, notas, historial).`
  );
  if (!confirmed) return;
  const errEl = document.getElementById("alumnosError");
  if (errEl) errEl.textContent = "";
  try {
    await fetchJSON(`/api/v1/admin/students/${studentId}`, { method: "DELETE" });
    await loadAllStudents(state);
  } catch (err) {
    if (errEl) errEl.textContent = err?.message || "No se pudo eliminar el alumno.";
  }
}

export async function revokeStudentFromTab(state, studentId, groupId) {
  const errEl = document.getElementById("alumnosError");
  if (errEl) errEl.textContent = "";
  try {
    await fetchJSON(`/api/v1/admin/groups/${groupId}/students/${studentId}`, { method: "DELETE" });
    await loadAllStudents(state);
  } catch (err) {
    if (errEl) errEl.textContent = err?.message || "No se pudo revocar el acceso.";
  }
}

export async function resendStudentFromTab(state, studentId, groupId) {
  const errEl = document.getElementById("alumnosError");
  if (errEl) errEl.textContent = "";
  const btn = document.querySelector(`[data-tab-resend-student="${studentId}"]`);
  if (btn) { btn.disabled = true; btn.textContent = "Reenviando…"; }
  try {
    await fetchJSON(`/api/v1/admin/groups/${groupId}/students/${studentId}/resend`, { method: "POST" });
    await loadAllStudents(state);
  } catch (err) {
    if (errEl) errEl.textContent = err?.message || "No se pudo reenviar la invitación.";
    if (btn) { btn.disabled = false; btn.textContent = "Reenviar"; }
  }
}
