import { resolverGrupoIdsVisibles } from "../instituto/alumnosVisibles.js";

// QUÉ TAREAS PUEDE TOCAR UN PROFESOR: las de SUS grupos.
//
// Hasta ahora /api/v1/tasks solo comprobaba que el grupo o la tarea fueran
// del centro. Un profesor podía listar las tareas de cualquier grupo del
// instituto (bastaba con pasar su id), crear tareas en un grupo que no es
// suyo, y borrar o cambiar las de otro profesor. Es el mismo agujero que se
// cerró el 08-09/09 en cuaderno, notas y sesiones, que aquí quedaba abierto.
//
// La regla es la de alumnosVisibles.js: admin → sin filtro (null);
// profesor → lista de sus grupos (vacía si no tiene ninguno), NUNCA null.
// Un error al consultarlo es un error (500), no "sin filtro".
export async function gruposVisiblesDe(admin, auth) {
  return resolverGrupoIdsVisibles(admin, {
    role: auth.membership.role,
    tenantSlug: auth.tenant.slug,
    userId: auth.user.id,
    email: auth.user.email || "",
  });
}

export function puedeVerGrupo(grupoIds, groupId) {
  if (grupoIds === null) return true;
  return Boolean(groupId) && grupoIds.includes(groupId);
}

// El grupo de una tarea: el suyo, o el del alumno si es una tarea personal
// (sesión libre, `student_id`). `null` si la tarea no existe en el centro.
export async function grupoDeLaTarea(admin, { tenantId, taskId }) {
  const { data: tarea, error } = await admin
    .from("tasks")
    .select("id, group_id, student_id")
    .eq("tenant_id", tenantId)
    .eq("id", taskId)
    .maybeSingle();
  if (error) return { error };
  if (!tarea) return { tarea: null };
  if (tarea.group_id || !tarea.student_id) return { tarea, grupoId: tarea.group_id || null };
  const { data: alumno, error: e2 } = await admin
    .from("students")
    .select("group_id")
    .eq("tenant_id", tenantId)
    .eq("id", tarea.student_id)
    .maybeSingle();
  if (e2) return { error: e2 };
  return { tarea, grupoId: alumno?.group_id || null };
}

// Para PATCH y DELETE de un profesor: la tarea existe y es de uno de sus
// grupos. Devuelve { ok } o { status, code, message } para responder.
export async function autorizaTareaDelProfesor(admin, auth, taskId) {
  if (auth.membership.role !== "teacher") return { ok: true };
  const vis = await gruposVisiblesDe(admin, auth);
  if (vis.error) return { status: 500, code: "visibilidad_fetch_failed", message: "No se pudo comprobar el acceso" };
  const r = await grupoDeLaTarea(admin, { tenantId: auth.tenant.id, taskId });
  if (r.error) return { status: 500, code: "task_fetch_failed", message: "No se pudo comprobar la tarea" };
  // Tarea de otro grupo o inexistente: 404 en los dos casos, para no
  // confirmar que existe.
  if (!r.tarea || !puedeVerGrupo(vis.grupoIds, r.grupoId)) return { status: 404, code: "task_not_found", message: "Task not found" };
  return { ok: true };
}
