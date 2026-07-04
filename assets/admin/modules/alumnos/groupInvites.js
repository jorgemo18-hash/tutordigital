import { escHtml, fetchJSON, toItems, copyToClipboard } from "../adminUtils.js";

// Lista de alumnos invitados dentro de UN grupo (nivel 4 de navegación:
// Grupos → grupo → Alumnos). Distinta de allStudentsTab.js, que es la vista
// cross-grupo. `pendingInviteUrls` la crea y posee adminAlumnos.js (un único
// Map compartido con la vista cross-grupo) y llega aquí como parámetro
// explícito en vez de cerrarse sobre el scope del orquestador.

export function studentStatusLabel(status) {
  if (status === "pending") return "pendiente";
  if (status === "used")    return "registrado";
  if (status === "revoked") return "revocado";
  if (status === "expired") return "expirada";
  return String(status || "");
}

export function renderStudentsList(state, pendingInviteUrls) {
  const el = document.getElementById("studentsList");
  if (!el) return;
  const students = (state.groupStudents || []).filter((s) => s.status !== "revoked");
  if (!students.length) { el.innerHTML = '<p class="emptyState">No hay alumnos invitados todavía.</p>'; return; }
  el.innerHTML = students.map((s) => {
    const canRevoke = s.status === "pending" || s.status === "used";
    const canResend = s.status === "pending";
    const hasCopyLink = canResend && pendingInviteUrls.has(s.id);
    return `
      <div class="studentRow">
        <span class="studentEmail">${escHtml(s.email)}</span>
        <span class="statusBadge status-${s.status}">${studentStatusLabel(s.status)}</span>
        <div class="studentRowActions">
          ${canResend ? `<button class="btn ghost small" data-resend-student="${s.id}" type="button">Reenviar</button>` : ""}
          ${hasCopyLink ? `<button class="btn ghost small" data-copy-student-link="${s.id}" type="button">Copiar enlace</button>` : ""}
          ${canRevoke ? `<button class="btn ghost small" data-revoke-student="${s.id}" type="button">Revocar</button>` : `<span></span>`}
        </div>
      </div>`;
  }).join("");
}

export async function loadStudents(state, pendingInviteUrls) {
  const group = state.activeGroupForStudents;
  if (!group) return;
  const errEl = document.getElementById("alumnosError");
  if (errEl) errEl.textContent = "";
  try {
    const data = await fetchJSON(`/api/v1/admin/groups/${group.id}/students`);
    state.groupStudents = toItems(data, "items");
    renderStudentsList(state, pendingInviteUrls);
  } catch (err) {
    if (errEl) errEl.textContent = err?.message || "No se pudo cargar la lista de alumnos.";
  }
}

export async function addStudent(state, pendingInviteUrls) {
  const email = String(document.getElementById("addStudentEmail")?.value || "").trim().toLowerCase();
  const errEl = document.getElementById("alumnosError");
  if (errEl) errEl.textContent = "";
  if (!email || !email.includes("@")) { if (errEl) errEl.textContent = "Introduce un email válido."; return; }

  const group = state.activeGroupForStudents;
  if (!group) return;

  const btn = document.getElementById("addStudentBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Autorizando…"; }

  try {
    const data = await fetchJSON(`/api/v1/admin/groups/${group.id}/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    document.getElementById("addStudentEmail").value = "";
    const inviteId = data?.invite?.id;
    const inviteUrl = data?.invite?.invite_url;
    if (inviteId && inviteUrl) pendingInviteUrls.set(inviteId, inviteUrl);

    const emailSent = data?.email_sent !== false;
    if (errEl) {
      errEl.textContent = emailSent
        ? `✓ Invitación enviada a ${email}`
        : `✓ Invitación creada para ${email} (email no enviado — usa "Copiar enlace")`;
      errEl.classList.add("is-success");
      setTimeout(() => { if (errEl) { errEl.textContent = ""; errEl.classList.remove("is-success"); } }, 5000);
    }
    await loadStudents(state, pendingInviteUrls);
  } catch (err) {
    if (errEl) errEl.textContent = err?.message || "No se pudo invitar al alumno.";
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Invitar alumno"; }
  }
}

export async function importStudents(state, pendingInviteUrls) {
  const raw   = String(document.getElementById("importEmailsText")?.value || "");
  const errEl = document.getElementById("importError");
  if (errEl) errEl.textContent = "";

  const emails = raw.split(/[\n,;]+/).map((s) => s.trim().toLowerCase()).filter((s) => s.includes("@") && s.includes("."));
  if (!emails.length) { if (errEl) errEl.textContent = "No se encontraron emails válidos en el texto pegado."; return; }

  const group = state.activeGroupForStudents;
  if (!group) return;

  const btn = document.getElementById("importStudentsBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Importando…"; }

  try {
    const data = await fetchJSON(`/api/v1/admin/groups/${group.id}/students/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails }),
    });
    document.getElementById("importEmailsText").value = "";
    document.getElementById("importForm")?.classList.add("hidden");
    document.getElementById("toggleImportBtn").textContent = "Importar lista";
    const alumnosErr = document.getElementById("alumnosError");
    if (alumnosErr) alumnosErr.textContent = `✓ ${data.imported ?? emails.length} email(s) importados correctamente.`;
    await loadStudents(state, pendingInviteUrls);
  } catch (err) {
    if (errEl) errEl.textContent = err?.message || "No se pudo importar la lista.";
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Importar"; }
  }
}

export async function revokeStudent(state, studentId, pendingInviteUrls) {
  const group = state.activeGroupForStudents;
  if (!group) return;
  const errEl = document.getElementById("alumnosError");
  if (errEl) errEl.textContent = "";
  try {
    await fetchJSON(`/api/v1/admin/groups/${group.id}/students/${studentId}`, { method: "DELETE" });
    pendingInviteUrls.delete(studentId);
    await loadStudents(state, pendingInviteUrls);
  } catch (err) {
    if (errEl) errEl.textContent = err?.message || "No se pudo revocar el acceso.";
  }
}

export async function resendStudentInvite(state, studentId, pendingInviteUrls) {
  const group = state.activeGroupForStudents;
  if (!group) return;
  const errEl = document.getElementById("alumnosError");
  if (errEl) errEl.textContent = "";
  const btn = document.querySelector(`[data-resend-student="${studentId}"]`);
  if (btn) { btn.disabled = true; btn.textContent = "Reenviando…"; }
  try {
    const data = await fetchJSON(`/api/v1/admin/groups/${group.id}/students/${studentId}/resend`, { method: "POST" });
    const inviteUrl = data?.invite?.invite_url;
    if (inviteUrl) pendingInviteUrls.set(studentId, inviteUrl);
    const emailSent = data?.email_sent !== false;
    if (errEl) {
      errEl.textContent = emailSent ? "✓ Invitación reenviada" : "✓ Enlace regenerado (email no enviado — usa Copiar enlace)";
      errEl.classList.add("is-success");
      setTimeout(() => { if (errEl) { errEl.textContent = ""; errEl.classList.remove("is-success"); } }, 4000);
    }
    renderStudentsList(state, pendingInviteUrls);
  } catch (err) {
    if (errEl) errEl.textContent = err?.message || "No se pudo reenviar la invitación.";
    if (btn) { btn.disabled = false; btn.textContent = "Reenviar"; }
  }
}

export { copyToClipboard };
