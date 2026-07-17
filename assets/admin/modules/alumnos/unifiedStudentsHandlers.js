import { fetchJSON, copyToClipboard } from "../adminUtils.js";

// Handlers de clic para las acciones de la lista unificada de Alumnos.
// Reutiliza exclusivamente endpoints de escritura ya existentes (ninguno
// nuevo) — ver el mapeo endpoint-por-acción documentado en
// unifiedStudentActions.js. Separado de unifiedStudents.js (carga/render)
// para que ninguno de los dos archivos crezca por encima de 400 líneas.

function errorTextOf(err, fallback) {
  return err?.message || fallback;
}

async function handleApprove(row, { fetchJSON: fj }) {
  await fj(`/api/v1/admin/students/${row.student_id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "approve" }),
  });
}

async function handleReject(row, { fetchJSON: fj }) {
  if (!confirm(`¿Rechazar el acceso de "${row.name || row.email}"?`)) return false;
  const reason = prompt("Motivo (opcional):") || undefined;
  await fj(`/api/v1/admin/students/${row.student_id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reject", reason }),
  });
}

async function handleResend(row, { fetchJSON: fj, pendingInviteUrls }) {
  const data = await fj(`/api/v1/admin/groups/${row.group_id}/students/${row.invite_id}/resend`, { method: "POST" });
  const url = data?.invite?.invite_url;
  if (url) pendingInviteUrls.set(row.invite_id, url);
}

async function handleCopyLink(row, { pendingInviteUrls }) {
  const url = pendingInviteUrls.get(row.invite_id);
  if (url) await copyToClipboard(url, document.getElementById("alumnosError"));
  return false; // no hace falta recargar la lista
}

async function handleRevoke(row, { fetchJSON: fj }) {
  if (!confirm(`¿Revocar la invitación de "${row.name || row.email}"? Dejará de poder registrarse con ese enlace.`)) return false;
  await fj(`/api/v1/admin/groups/${row.group_id}/students/${row.invite_id}`, { method: "DELETE" });
}

async function handleArchive(row, { fetchJSON: fj }) {
  if (!confirm(`¿Archivar a "${row.name || row.email}"? Perderá el acceso hasta que se le restaure.`)) return false;
  await fj(`/api/v1/admin/students/${row.student_id}/archive`, { method: "DELETE" });
}

async function handleRestore(row, { fetchJSON: fj }) {
  await fj(`/api/v1/admin/students/${row.student_id}/restore`, { method: "PUT" });
}

async function handleDelete(row, { fetchJSON: fj }) {
  const confirmed = confirm(
    `¿Eliminar definitivamente a "${row.name || row.email}"?\n\nEsta acción es PERMANENTE: se borran su cuenta, sesiones, notas e historial. No se puede deshacer.`
  );
  if (!confirmed) return false;
  await fj(`/api/v1/admin/students/${row.invite_id}`, { method: "DELETE" });
}

const HANDLERS = {
  approve: handleApprove,
  reject: handleReject,
  resend: handleResend,
  copyLink: handleCopyLink,
  revoke: handleRevoke,
  archive: handleArchive,
  restore: handleRestore,
  delete: handleDelete,
};

export function createUnifiedStudentsHandlers({ pendingInviteUrls, unifiedStudents }) {
  async function handleClick(ev, state) {
    const btn = ev.target.closest("[data-unified-action]");
    if (!btn) return false;

    const action = btn.dataset.unifiedAction;
    const key = btn.dataset.unifiedKey;
    const handler = HANDLERS[action];
    const row = unifiedStudents.findRow(state, key);
    if (!handler || !row) return false;

    const errEl = document.getElementById("alumnosError");
    if (errEl) errEl.textContent = "";
    btn.disabled = true;
    try {
      const result = await handler(row, { fetchJSON, pendingInviteUrls });
      if (result !== false) await unifiedStudents.load(state);
    } catch (err) {
      if (errEl) errEl.textContent = errorTextOf(err, "No se pudo completar la acción.");
    } finally {
      btn.disabled = false;
    }
    return true;
  }

  return { handleClick };
}
