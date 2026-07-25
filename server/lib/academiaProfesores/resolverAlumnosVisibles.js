import { fetchAlumnoIdsDeProfesor } from "./asignaciones.js";

// Único punto de decisión de "qué alumnos puede ver este usuario" —
// compartido por las vistas de horario y diario del profesor (ver
// academia.horario.routes.js / academia.sesiones.routes.js) para no
// repetir la misma regla de seguridad en dos sitios.
//
// admin -> alumnoIds: null ("sin filtro", ve todo el tenant).
// teacher -> alumnoIds: array, NUNCA null — puede estar vacío si el
// profesor no tiene ninguna asignación todavía. Un profesor sin
// alumnoIds nunca debe caer a "sin filtro": es exactamente el
// antipatrón que causó el bug de aislamiento de datos en
// GET /api/v1/tasks (ausencia de filtro tratada como "no filtrar").
//
// `findProfesorIdFn` se recibe como dependencia explícita en vez de
// importarse aquí: cada route file ya tiene su propia copia de
// findProfesorId (duplicada a propósito, ver academia.sesiones.routes.js)
// y este módulo no debe forzar cuál es la canónica.
export async function resolverAlumnoIdsVisibles(admin, { tenantId, tenantSlug, userId, role, findProfesorIdFn }) {
  if (role !== "teacher") return { alumnoIds: null };

  const profesorId = await findProfesorIdFn(admin, tenantSlug, userId);
  if (!profesorId) return { alumnoIds: [] };

  const { alumnoIds, error } = await fetchAlumnoIdsDeProfesor(admin, tenantId, profesorId);
  if (error) return { error };
  return { alumnoIds: alumnoIds || [] };
}
