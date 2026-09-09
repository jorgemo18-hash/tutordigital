import { getTeacherProfileForUser } from "../teacherAssignments.js";

// QUÉ GRUPOS Y QUÉ ALUMNOS PUEDE VER ESTE USUARIO, en el lado instituto.
// Único punto de decisión, como resolverAlumnoIdsVisibles lo es en academia.
//
// EL FALLO QUE CIERRA (auditoría del 08/09/2026, ampliada el 09/09). En el
// instituto el aislamiento era POR CENTRO, no por profesor: once rutas
// —detalle de sesión de tutoría, notas del alumno, cuaderno, calificaciones,
// mapa de la sesión— comprobaban que el dato fuera del tenant y nada más. Un
// profesor autenticado leía la conversación entera de cualquier alumno del
// centro pasando su id en la petición. En una academia con un profesor eso
// no se nota; en un instituto con cuarenta profesores es el primer problema
// del producto, y son conversaciones y notas de menores.
//
// LA REGLA, la misma que en academia y por el mismo motivo:
//
//   admin   -> null  ("sin filtro", ve todo el centro)
//   teacher -> array, NUNCA null. Puede estar VACÍO si no tiene grupos.
//
// Un profesor sin grupos no puede caer nunca a "sin filtro". Es literalmente
// el antipatrón que ya causó el fallo de aislamiento de GET /api/v1/tasks,
// y el helper que había en el instituto lo repetía: getTeacherAssignedGroupIds
// devuelve `null` —que quien lo llama interpreta como "no restringir"— tanto
// cuando el profesor no tiene ficha COMO CUANDO LA CONSULTA FALLA. Es decir,
// un error transitorio de la base de datos abría el centro entero. Aquí un
// error es un error: se devuelve y la ruta responde 500.
//
// EL CAMINO ES profesor -> teacher_groups -> students.group_id. Un alumno
// pertenece a UN grupo (students.group_id, migración 001), así que no hace
// falta tabla puente. Se resuelve por GRUPOS y no por asignatura
// (teacher_group_subjects existe y es más fino) a propósito: el tutor de un
// grupo necesita ver a sus alumnos aunque no les dé ninguna asignatura, y
// afinar por asignatura dejaría fuera justo al que más lo necesita.

// Los grupos que imparte o tutoriza un profesor. Devuelve `{ grupoIds }`
// siempre array para teacher, o `{ error }`. Nunca null para un profesor.
export async function resolverGrupoIdsVisibles(admin, { role, tenantSlug, userId, email = "" }) {
  if (role !== "teacher") return { grupoIds: null };

  const profile = await getTeacherProfileForUser(admin, { tenantSlug, userId, email });
  // Sin ficha de profesor no hay grupos que mirar. VACÍO, no "sin filtro":
  // es el caso de una cuenta con rol teacher a la que aún no se le ha
  // asignado nada, y lo correcto es que no vea a nadie.
  if (!profile?.id) return { grupoIds: [] };

  const { data, error } = await admin
    .from("teacher_groups")
    .select("group_id")
    .eq("teacher_profile_id", profile.id);

  if (error) return { error };
  return { grupoIds: [...new Set((data || []).map((row) => row.group_id).filter(Boolean))] };
}

// Los alumnos de esos grupos. Mismo contrato: null solo para quien no es
// profesor.
export async function resolverAlumnoIdsVisibles(admin, { role, tenantId, tenantSlug, userId, email = "" }) {
  const { grupoIds, error } = await resolverGrupoIdsVisibles(admin, { role, tenantSlug, userId, email });
  if (error) return { error };
  if (grupoIds === null) return { alumnoIds: null, grupoIds: null };
  // Sin grupos no hace falta preguntar por los alumnos: no hay ninguno, y
  // un `.in("group_id", [])` es una consulta de más en cada petición.
  if (!grupoIds.length) return { alumnoIds: [], grupoIds: [] };

  const { data, error: alumnosErr } = await admin
    .from("students")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("group_id", grupoIds);

  if (alumnosErr) return { error: alumnosErr };
  return { alumnoIds: (data || []).map((row) => row.id).filter(Boolean), grupoIds };
}

// Guarda para los endpoints que operan sobre UN alumno concreto. Deriva del
// mismo punto de decisión: nunca se vuelve a escribir aquí la regla de quién
// ve a quién.
export async function verificarAlumnoVisible(admin, { role, tenantId, tenantSlug, userId, email = "", alumnoId }) {
  const { alumnoIds, error } = await resolverAlumnoIdsVisibles(admin, { role, tenantId, tenantSlug, userId, email });
  if (error) return { ok: false, code: "visibilidad_fetch_failed", error };
  if (alumnoIds === null) return { ok: true };
  if (!alumnoId || !alumnoIds.includes(alumnoId)) return { ok: false, code: "alumno_no_visible" };
  return { ok: true };
}

// Y para los que operan sobre UN grupo (el cuaderno, el listado de sesiones
// por grupo). Se comprueba el grupo y no sus alumnos porque la pregunta es
// otra: "¿puede este profesor mirar dentro de 3ºB?".
export async function verificarGrupoVisible(admin, { role, tenantSlug, userId, email = "", grupoId }) {
  const { grupoIds, error } = await resolverGrupoIdsVisibles(admin, { role, tenantSlug, userId, email });
  if (error) return { ok: false, code: "visibilidad_fetch_failed", error };
  if (grupoIds === null) return { ok: true };
  if (!grupoId || !grupoIds.includes(grupoId)) return { ok: false, code: "grupo_no_visible" };
  return { ok: true };
}
