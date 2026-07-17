import { fetchJSON } from "../adminUtils.js";
import { createGroupSelector } from "./groupSelector.js";

// Panel "+ Invitar alumno" de la vista cross-grupo (pestaña Alumnos). La
// selección de grupo en sí (curso → vía) vive en groupSelector.js —
// compartida con el punto de entrada "Importar lista" (alumnosImportEntry.js)
// — este archivo solo añade los campos propios del alta individual
// (nombre/apellidos/email) y el envío de la invitación.

export function createGroupPicker() {
  const selector = createGroupSelector({
    containerId: "studentGroupPicker",
    onChange: refreshInviteBtn,
  });

  function render(state) {
    selector.render(state);
    const sendBtn = document.getElementById("sendInviteStudentBtn");
    if (sendBtn) {
      const hasEmail = String(document.getElementById("inviteStudentEmail")?.value || "").includes("@");
      sendBtn.disabled = !(hasEmail && selector.getSelectedGroupId());
    }
  }

  function refreshInviteBtn() {
    const email     = String(document.getElementById("inviteStudentEmail")?.value || "").trim();
    const firstName = String(document.getElementById("inviteStudentFirstName")?.value || "").trim();
    const lastName  = String(document.getElementById("inviteStudentLastName")?.value || "").trim();
    const btn       = document.getElementById("sendInviteStudentBtn");
    if (btn) btn.disabled = !(email.includes("@") && firstName && lastName && selector.getSelectedGroupId());
  }

  function closePanel(state) {
    document.getElementById("inviteStudentPanel")?.classList.add("hidden");
    const showBtn = document.getElementById("showInviteStudentBtn");
    if (showBtn) showBtn.textContent = "+ Invitar alumno";
    const fields = ["inviteStudentEmail", "inviteStudentFirstName", "inviteStudentLastName"];
    fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
    selector.reset(state);
    const sendBtn = document.getElementById("sendInviteStudentBtn");
    if (sendBtn) sendBtn.disabled = true;
  }

  async function inviteFromTab(state, { onDone }) {
    const email     = String(document.getElementById("inviteStudentEmail")?.value || "").trim().toLowerCase();
    const firstName = String(document.getElementById("inviteStudentFirstName")?.value || "").trim();
    const lastName  = String(document.getElementById("inviteStudentLastName")?.value || "").trim();
    const errEl     = document.getElementById("alumnosError");
    const btn       = document.getElementById("sendInviteStudentBtn");
    const groupId   = selector.getSelectedGroupId();
    if (errEl) errEl.textContent = "";

    if (!email || !email.includes("@"))  { if (errEl) errEl.textContent = "Introduce un email válido."; return; }
    if (!firstName)                       { if (errEl) errEl.textContent = "Introduce el nombre del alumno."; return; }
    if (!lastName)                        { if (errEl) errEl.textContent = "Introduce los apellidos del alumno."; return; }
    if (!groupId)                         { if (errEl) errEl.textContent = "Elige un grupo."; return; }

    if (btn) { btn.disabled = true; btn.textContent = "Enviando…"; }
    try {
      await fetchJSON(`/api/v1/admin/groups/${groupId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, first_name: firstName, last_name: lastName }),
      });
      closePanel(state);
      await onDone();
    } catch (err) {
      if (errEl) errEl.textContent = err?.message || "No se pudo crear la invitación.";
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Enviar invitación"; }
    }
  }

  function handleClick(ev, state) {
    return selector.handleClick(ev, state);
  }

  function openPanel(state) {
    selector.reset(state);
    document.getElementById("inviteStudentPanel")?.classList.remove("hidden");
    document.getElementById("showInviteStudentBtn").textContent = "× Cancelar";
    render(state);
    document.getElementById("inviteStudentFirstName")?.focus();
  }

  return { render, closePanel, openPanel, refreshInviteBtn, inviteFromTab, handleClick };
}
