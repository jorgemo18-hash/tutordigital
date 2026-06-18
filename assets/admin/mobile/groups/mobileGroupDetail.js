// mobileGroupDetail.js — Group detail drill-in overlay: join-code bar,
// authorized students (whitelist), assigned teachers. Structure/classes
// match the reference design's AdminGrupoDetalle exactly.

import {
  fetchGroupStudents, resendStudentInvite, revokeStudent, deleteGroup,
  regenerateGroupCode, inviteStudent,
} from "../mobileAdminData.js";
import { icon } from "../mobileAdminIcons.js";

function _esc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function _initials(name, email) {
  const words = String(name || email || "?").trim().split(/\s+/).filter(Boolean);
  return words.length >= 2 ? (words[0][0] + words[1][0]).toUpperCase() : String(words[0] || "?").slice(0, 2).toUpperCase();
}

function _studentRowHtml(s) {
  const isUsed = s.status === "used";
  const statusCls = isUsed ? "status-ok" : "status-pend";
  const statusTxt = isUsed ? "registrado" : "pendiente";
  return `
    <div class="prow-person" data-student-id="${_esc(s.id)}">
      <div class="pav">${_esc(_initials(s.display_name, s.email))}</div>
      <div class="pinfo">
        <span class="pname">${_esc(s.display_name || s.email)}</span>
        <span class="pmail">${_esc(s.email)}</span>
      </div>
      <span class="${statusCls}"><span class="dot"></span>${statusTxt}</span>
      ${!isUsed ? `<button type="button" class="doc-ver" data-resend="${_esc(s.id)}">Reenviar</button>` : ""}
      <button type="button" class="doc-ver" data-revoke="${_esc(s.id)}">Revocar</button>
    </div>`;
}

export async function renderGroupDetail({ hostEl, fetchJSON, group, teachers, onBack, onDeleted }) {
  let joinCode = group._freshJoinCode || null;

  function _codebarHtml() {
    return `
      <div class="codebar">
        <div class="codebar-top">
          <div>
            <div class="codebar-key">Código de acceso</div>
            <div class="codebar-val">${joinCode ? _esc(joinCode) : `${_esc(group.join_code_hint || "····")}····`}</div>
          </div>
          <span class="status-ok"><span class="dot"></span>activo</span>
        </div>
        <div class="codebar-actions">
          <button type="button" class="act" id="adGdCopy"${joinCode ? "" : " disabled"}>${icon("copy", { size: 14 })} Copiar</button>
          <button type="button" class="act" id="adGdRegen">${icon("refresh", { size: 14 })} Nuevo</button>
          <button type="button" class="act danger" id="adGdDelete">${icon("trash", { size: 14 })} Eliminar</button>
        </div>
      </div>`;
  }

  function _draw() {
    const assigned = teachers.filter(t => (t.groups || []).some(g => g.id === group.id));
    const subtitle = [group.stage ? group.stage[0].toUpperCase() + group.stage.slice(1) : "", group.year ? `${group.year}º` : ""].filter(Boolean).join(" · ");

    hostEl.innerHTML = `
      <div class="drill">
        <header class="drill-head">
          <button type="button" class="iconbtn bordered" id="adGdBack" aria-label="Volver">${icon("arrowL", { size: 20 })}</button>
          <div class="drill-head-info">
            <div class="drill-head-pill">${_esc(subtitle)}</div>
            <div class="drill-head-title">${_esc(group.name)}</div>
          </div>
        </header>
        <div class="drill-body">
          ${_codebarHtml()}

          <div class="gblock">
            <div class="gblock-head">
              <div class="gblock-title">Alumnos autorizados</div>
              <span class="gblock-sub">Whitelist · ${group.student_count ?? 0}</span>
            </div>
            <div class="inviterow">
              <input class="ginput" id="adGdEmail" type="email" placeholder="alumno@email.com">
              <button type="button" class="btn btn-primary btn-sm" id="adGdAdd" style="flex-shrink:0">${icon("plus", { size: 15, sw: 2.4 })}</button>
            </div>
            <div id="adGdStudents"><p class="dcard-empty">Cargando…</p></div>
          </div>

          <div class="gblock">
            <div class="gblock-head">
              <div class="gblock-title">Docentes asignados</div>
              <span class="gblock-sub">${assigned.length} docente${assigned.length !== 1 ? "s" : ""}</span>
            </div>
            ${assigned.length ? assigned.map(t => _teacherBlockHtml(t, group.id)).join("") : `<div class="dcard-empty">Sin docentes asignados a este grupo.</div>`}
          </div>
        </div>
      </div>`;

    hostEl.querySelector("#adGdBack").addEventListener("click", onBack);
    hostEl.querySelector("#adGdDelete").addEventListener("click", () => _handleDelete());
    hostEl.querySelector("#adGdRegen").addEventListener("click", () => _handleRegen());
    hostEl.querySelector("#adGdCopy")?.addEventListener("click", () => _handleCopy());
    hostEl.querySelector("#adGdAdd").addEventListener("click", () => _handleAdd());
  }

  function _teacherBlockHtml(t, groupId) {
    const entry = (t.groups || []).find(g => g.id === groupId);
    const subjects = entry?.subjects || [];
    return `
      <div class="doc-head">
        <div class="pav lg">${_esc(_initials(t.display_name, t.email))}</div>
        <div class="pinfo">
          <span class="pname">${_esc(t.display_name || t.email)}</span>
          <span class="pmail">${_esc(t.email)}</span>
        </div>
        <span class="status-ok"><span class="dot"></span>activo</span>
      </div>
      <div class="doc-chips">
        ${subjects.length ? subjects.map(s => `<span class="schip">${_esc(s)}</span>`).join("") : `<span class="schip plain">Sin asignaturas</span>`}
      </div>`;
  }

  async function _loadStudents() {
    const studentsEl = hostEl.querySelector("#adGdStudents");
    try {
      const data = await fetchGroupStudents(fetchJSON, group.id);
      const items = (data?.items || []).filter(s => s.status !== "revoked");
      studentsEl.innerHTML = items.length ? items.map(_studentRowHtml).join("") : `<div class="dcard-empty">Aún no hay alumnos autorizados.</div>`;
      studentsEl.querySelectorAll("[data-resend]").forEach(btn => btn.addEventListener("click", () => _handleResend(btn)));
      studentsEl.querySelectorAll("[data-revoke]").forEach(btn => btn.addEventListener("click", () => _handleRevoke(btn)));
    } catch (err) {
      studentsEl.innerHTML = `<div class="dcard-empty">${_esc(err?.message || "No se pudo cargar la lista de alumnos.")}</div>`;
    }
  }

  async function _handleResend(btn) {
    btn.disabled = true;
    try { await resendStudentInvite(fetchJSON, group.id, btn.dataset.resend); await _loadStudents(); }
    catch { btn.disabled = false; }
  }

  async function _handleRevoke(btn) {
    if (!confirm("¿Revocar el acceso de este alumno?")) return;
    try { await revokeStudent(fetchJSON, group.id, btn.dataset.revoke); await _loadStudents(); }
    catch (err) { alert(err?.message || "No se pudo revocar el acceso."); }
  }

  async function _handleAdd() {
    const emailInput = hostEl.querySelector("#adGdEmail");
    const email = emailInput.value.trim().toLowerCase();
    if (!email.includes("@")) return;
    const fullName = window.prompt("Nombre completo del alumno:", "");
    if (!fullName || !fullName.trim()) return;
    const parts = fullName.trim().split(/\s+/);
    const first_name = parts[0];
    const last_name  = parts.slice(1).join(" ") || parts[0];

    const addBtn = hostEl.querySelector("#adGdAdd");
    addBtn.disabled = true;
    try {
      await inviteStudent(fetchJSON, group.id, { email, first_name, last_name });
      emailInput.value = "";
      group.student_count = (group.student_count || 0) + 1;
      await _loadStudents();
    } catch (err) {
      alert(err?.message || "No se pudo invitar al alumno.");
    } finally {
      addBtn.disabled = false;
    }
  }

  async function _handleCopy() {
    if (!joinCode) return;
    try { await navigator.clipboard.writeText(joinCode); } catch { /* ignore */ }
  }

  async function _handleRegen() {
    if (!confirm("¿Generar un nuevo código de acceso? El código anterior dejará de funcionar.")) return;
    const btn = hostEl.querySelector("#adGdRegen");
    btn.disabled = true;
    try {
      const res = await regenerateGroupCode(fetchJSON, group.id);
      joinCode = res?.join_code || null;
      group.join_code_hint = res?.group?.join_code_hint || group.join_code_hint;
      _draw();
      await _loadStudents();
    } catch (err) {
      alert(err?.message || "No se pudo generar un nuevo código.");
      btn.disabled = false;
    }
  }

  async function _handleDelete() {
    if (!confirm(`¿Eliminar el grupo "${group.name}"? Esta acción no se puede deshacer.`)) return;
    const btn = hostEl.querySelector("#adGdDelete");
    btn.disabled = true;
    try { await deleteGroup(fetchJSON, group.id); onDeleted(group.id); }
    catch (err) { btn.disabled = false; alert(err?.message || "No se pudo eliminar el grupo."); }
  }

  _draw();
  await _loadStudents();
}
