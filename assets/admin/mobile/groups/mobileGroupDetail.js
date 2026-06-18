// mobileGroupDetail.js — Group detail screen (Nivel 4 desktop equivalent):
// authorized students + assigned teachers for one group. Navigated to in
// place within the Grupos tab (not a sheet) — back arrow returns to the list.

import { fetchGroupStudents, resendStudentInvite, revokeStudent, deleteGroup } from "../mobileAdminData.js";

function _esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function _studentStatusLabel(status) {
  if (status === "pending") return "pendiente";
  if (status === "used")    return "registrado";
  if (status === "revoked") return "revocado";
  return String(status || "");
}

function _studentRowHtml(s) {
  const canResend = s.status === "pending";
  const canRevoke = s.status === "pending" || s.status === "used";
  return `
    <div class="ad-row-card">
      <div class="ad-row-card-main">
        <span class="ad-row-card-name">${_esc(s.email)}</span>
        <span class="ad-status-badge ad-status--${s.status}">${_studentStatusLabel(s.status)}</span>
      </div>
      <div class="ad-row-card-actions">
        ${canResend ? `<button class="ad-link-btn" type="button" data-resend="${_esc(s.id)}">Reenviar</button>` : ""}
        ${canRevoke ? `<button class="ad-link-btn ad-link-btn--danger" type="button" data-revoke="${_esc(s.id)}">Revocar</button>` : ""}
      </div>
    </div>`;
}

function _teacherRowHtml(t, groupId) {
  const entry = (t.groups || []).find(g => g.id === groupId);
  const subjects = entry?.subjects?.length ? entry.subjects.join(" · ") : "Sin asignaturas";
  const tutorBadge = entry?.is_tutor ? ` <span class="ad-tutor-badge">Tutor</span>` : "";
  return `
    <div class="ad-row-card">
      <div class="ad-row-card-main">
        <span class="ad-row-card-name">${_esc(t.display_name || t.email)}${tutorBadge}</span>
      </div>
      <span class="ad-row-card-sub">${_esc(subjects)}</span>
    </div>`;
}

export async function renderGroupDetail({ containerEl, fetchJSON, group, teachers, onBack, onDeleted }) {
  containerEl.innerHTML = `
    <div class="ad-detail-header">
      <button class="ad-back-btn" type="button" id="adGdBack">← Volver</button>
      <h2 class="ad-detail-title">${_esc(group.name)}</h2>
      <button class="ad-link-btn ad-link-btn--danger" type="button" id="adGdDelete">Eliminar grupo</button>
    </div>
    <div class="ad-detail-section">
      <h3 class="ad-detail-subtitle">Alumnos autorizados</h3>
      <div id="adGdStudents"><p class="ad-loading">Cargando…</p></div>
    </div>
    <div class="ad-detail-section">
      <h3 class="ad-detail-subtitle">Docentes asignados</h3>
      <div id="adGdTeachers"></div>
    </div>`;

  containerEl.querySelector("#adGdBack").addEventListener("click", onBack);
  containerEl.querySelector("#adGdDelete").addEventListener("click", () => _handleDelete());

  const teachersEl = containerEl.querySelector("#adGdTeachers");
  const assigned = teachers.filter(t => (t.groups || []).some(g => g.id === group.id));
  teachersEl.innerHTML = assigned.length
    ? assigned.map(t => _teacherRowHtml(t, group.id)).join("")
    : `<p class="ad-empty">No hay docentes asignados a este grupo todavía.</p>`;

  async function _loadStudents() {
    const studentsEl = containerEl.querySelector("#adGdStudents");
    try {
      const data = await fetchGroupStudents(fetchJSON, group.id);
      const items = (data?.items || []).filter(s => s.status !== "revoked");
      studentsEl.innerHTML = items.length
        ? items.map(_studentRowHtml).join("")
        : `<p class="ad-empty">No hay alumnos invitados todavía.</p>`;
      studentsEl.querySelectorAll("[data-resend]").forEach(btn => btn.addEventListener("click", () => _handleResend(btn)));
      studentsEl.querySelectorAll("[data-revoke]").forEach(btn => btn.addEventListener("click", () => _handleRevoke(btn)));
    } catch (err) {
      studentsEl.innerHTML = `<p class="ad-empty">${_esc(err?.message || "No se pudo cargar la lista de alumnos.")}</p>`;
    }
  }

  async function _handleResend(btn) {
    btn.disabled = true;
    btn.textContent = "Reenviando…";
    try {
      await resendStudentInvite(fetchJSON, group.id, btn.dataset.resend);
      await _loadStudents();
    } catch {
      btn.disabled = false;
      btn.textContent = "Reenviar";
    }
  }

  async function _handleRevoke(btn) {
    if (!confirm("¿Revocar el acceso de este alumno?")) return;
    try {
      await revokeStudent(fetchJSON, group.id, btn.dataset.revoke);
      await _loadStudents();
    } catch (err) {
      alert(err?.message || "No se pudo revocar el acceso.");
    }
  }

  async function _handleDelete() {
    if (!confirm(`¿Eliminar el grupo "${group.name}"? Esta acción no se puede deshacer.`)) return;
    const btn = containerEl.querySelector("#adGdDelete");
    btn.disabled = true;
    btn.textContent = "Eliminando…";
    try {
      await deleteGroup(fetchJSON, group.id);
      onDeleted(group.id);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Eliminar grupo";
      alert(err?.message || "No se pudo eliminar el grupo.");
    }
  }

  await _loadStudents();
}
