import { resolverAlumnoIdsVisibles } from "./resolverAlumnosVisibles.js";

// Guarda de autorización reutilizada por los endpoints de escritura que
// operan sobre UN alumno concreto (POST /academia/sesiones, POST
// /academia/diario/ausencia-email, /academia/notas-examen): admin
// siempre puede; un profesor solo si el alumno está en su conjunto
// visible (asignado directamente o vía sustitución activa hoy). Deriva
// del mismo único punto de decisión (resolverAlumnoIdsVisibles) — nunca
// repite la regla de qué alumnos puede ver/tocar cada rol.
export async function verificarAlumnoVisible(admin, { tenantId, tenantSlug, userId, role, findProfesorIdFn, alumnoId, hoyISO }) {
  const { alumnoIds, error } = await resolverAlumnoIdsVisibles(admin, { tenantId, tenantSlug, userId, role, findProfesorIdFn, hoyISO });
  if (error) return { ok: false, code: "visibilidad_fetch_failed", error };
  if (alumnoIds === null) return { ok: true }; // admin: sin filtro
  if (!alumnoIds.includes(alumnoId)) return { ok: false, code: "alumno_no_visible" };
  return { ok: true };
}
