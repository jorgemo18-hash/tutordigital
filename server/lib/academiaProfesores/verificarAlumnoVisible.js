import { resolverAlumnoIdsVisibles } from "./resolverAlumnosVisibles.js";
import { franjaDeOtroProfesorEseDia } from "./franjasDeProfesor.js";

// Guarda de autorización reutilizada por los endpoints de escritura que
// operan sobre UN alumno concreto (POST /academia/sesiones, POST
// /academia/diario/ausencia-email, /academia/notas-examen): admin siempre
// puede; un profesor solo si el alumno está en su conjunto visible. Deriva
// del mismo único punto de decisión (resolverAlumnoIdsVisibles) — nunca
// repite la regla de qué alumnos puede ver/tocar cada rol.
//
// AFINADO POR DÍA (`fecha`): desde el paso 3 del horario por profesor, un
// profesor puede ver a un alumno solo porque le imparte UNA franja — "a
// Marta la lleva María los martes y Pedro los jueves". Sin mirar la fecha,
// Pedro podría escribir el parte del martes, que es de María, y pisárselo:
// solo hay UNA sesión por alumno y día.
//
// Se bloquea únicamente el CONFLICTO: que ese día sea de otro profesor. No
// se exige tener franja ese día, porque eso rompería lo más normal del
// mundo — una recuperación, una clase suelta, un aviso de ausencia de un
// día que se movió. Y con un solo profesor en el centro no hay "otro"
// posible: esta comprobación no se dispara nunca.
//
// Sin `fecha` (notas de examen) se queda en el nivel de alumno de siempre:
// la fecha de un examen no tiene por qué coincidir con un día de clase.
export async function verificarAlumnoVisible(admin, {
  tenantId, tenantSlug, userId, role, findProfesorIdFn, alumnoId, hoyISO, fecha = null,
}) {
  const { alumnoIds, ambitoFranjas, error } = await resolverAlumnoIdsVisibles(admin, {
    tenantId, tenantSlug, userId, role, findProfesorIdFn, hoyISO,
  });
  if (error) return { ok: false, code: "visibilidad_fetch_failed", error };
  if (alumnoIds === null) return { ok: true }; // admin: sin filtro
  if (!alumnoIds.includes(alumnoId)) return { ok: false, code: "alumno_no_visible" };

  if (!fecha) return { ok: true };

  const { deOtro, error: franjaErr } = await franjaDeOtroProfesorEseDia(admin, {
    tenantId, alumnoId, fecha, profesorIds: ambitoFranjas?.profesorIds || [],
  });
  if (franjaErr) return { ok: false, code: "visibilidad_fetch_failed", error: franjaErr };
  if (deOtro) return { ok: false, code: "dia_de_otro_profesor" };
  return { ok: true };
}
