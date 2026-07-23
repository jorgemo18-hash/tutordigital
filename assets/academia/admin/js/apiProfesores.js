// Aparte de api.js a propósito (mismo criterio que apiFichajes.js): estas
// llamadas van contra /api/v1/admin/teachers/*, el mismo endpoint que ya
// usa el panel de instituto (server/routes/v1/admin-teachers/) — no contra
// /api/v1/academia/*, que es el prefijo del resto de este archivo.
import { callJson } from "./apiCore.js";

export async function fetchProfesores() {
  const data = await callJson("/api/v1/admin/teachers");
  return data.teachers || data.items || [];
}

// Solo email + nombre: un profesor de academia no tiene grupos ni
// asignaturas (ver admin-teachers/invite.routes.js, que salta esa
// exigencia para tenant.type === "academia").
export async function invitarProfesor({ email, display_name }) {
  return callJson("/api/v1/admin/teachers/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, display_name }),
  });
}

export async function revocarInvitacionProfesor(inviteId) {
  return callJson(`/api/v1/admin/teachers/teacher-invites/${inviteId}/revoke`, { method: "POST" });
}

// Solo nombre/dirección/teléfono desde el drawer de profesor — el mismo
// PATCH admite más campos (email, grupos…) para instituto, aquí solo se
// envían los tres que expone la UI de academia.
export async function updateProfesor(id, { display_name, telefono, direccion }) {
  return callJson(`/api/v1/admin/teachers/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_name, telefono, direccion }),
  });
}
