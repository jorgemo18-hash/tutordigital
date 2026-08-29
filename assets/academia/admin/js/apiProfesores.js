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

// Solo nombre/dirección/teléfono/NIF-DNI/fecha de alta desde el drawer de
// profesor — el mismo PATCH admite más campos (email, grupos…) para
// instituto, aquí solo se envían los que expone la UI de academia.
export async function updateProfesor(id, { display_name, telefono, direccion, nif_dni, fecha_alta }) {
  return callJson(`/api/v1/admin/teachers/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_name, telefono, direccion, nif_dni, fecha_alta }),
  });
}

// Dar de baja / reactivar. Es el MISMO PATCH de arriba con un solo campo:
// se separa porque son acciones distintas de editar la ficha y así el
// llamador no tiene que saber que `is_active` viaja por ahí.
export async function setProfesorActivo(id, activo) {
  return callJson(`/api/v1/admin/teachers/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_active: Boolean(activo) }),
  });
}

// Eliminar de la plantilla. El servidor lo rechaza (409) si el profesor
// tiene cualquier rastro —alumnos, diario, horario, fichajes,
// sustituciones— y devuelve en el mensaje qué es lo que lo impide.
export async function eliminarProfesor(id) {
  return callJson(`/api/v1/admin/teachers/${id}`, { method: "DELETE" });
}
