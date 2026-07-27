import { fetchAlumnoIdsDeProfesor } from "./asignaciones.js";
import { fetchProfesoresSustituidosHoy } from "../academiaSustituciones/consultas.js";

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

// Único punto de decisión de "qué alumnos puede ver este usuario" —
// compartido por las vistas de horario y diario del profesor, y por
// POST /academia/sesiones, POST /academia/diario/ausencia-email y
// /academia/notas-examen (filtrado estricto por asignación) — para no
// repetir la misma regla de seguridad en varios sitios.
//
// admin -> alumnoIds: null ("sin filtro", ve todo el tenant).
// teacher -> alumnoIds: array, NUNCA null — puede estar vacío si el
// profesor no tiene ninguna asignación ni sustitución activa hoy. Un
// profesor sin alumnoIds nunca debe caer a "sin filtro": es exactamente
// el antipatrón que causó el bug de aislamiento de datos en
// GET /api/v1/tasks (ausencia de filtro tratada como "no filtrar").
//
// Los alumnos visibles son la UNIÓN de dos fuentes — sus propios
// asignados (academia_profesor_alumnos) MÁS los de cualquier profesor al
// que sustituya HOY (academia_sustituciones, migración 097) — nunca es
// "cambiar" de identidad ni de alumnos, solo AMPLIAR temporalmente el
// conjunto. `hoyISO` como parámetro explícito (no `new Date()` cerrado
// dentro) para que los tests controlen la fecha sin mockear el reloj.
//
// `findProfesorIdFn` se recibe como dependencia explícita en vez de
// importarse aquí: cada route file ya tiene su propia copia de
// findProfesorId (duplicada a propósito, ver academia.sesiones.routes.js)
// y este módulo no debe forzar cuál es la canónica.
export async function resolverAlumnoIdsVisibles(admin, {
  tenantId, tenantSlug, userId, role, findProfesorIdFn, hoyISO: hoyOverride,
}) {
  if (role !== "teacher") return { alumnoIds: null };

  const profesorId = await findProfesorIdFn(admin, tenantSlug, userId);
  if (!profesorId) return { alumnoIds: [] };

  const hoy = hoyOverride || hoyISO();

  const [propios, sustituidosHoy] = await Promise.all([
    fetchAlumnoIdsDeProfesor(admin, tenantId, profesorId),
    fetchProfesoresSustituidosHoy(admin, { tenantId, profesorSustitutoId: profesorId, hoyISO: hoy }),
  ]);
  if (propios.error) return { error: propios.error };
  if (sustituidosHoy.error) return { error: sustituidosHoy.error };

  let alumnoIds = propios.alumnoIds || [];
  // De qué profesor sustituido viene cada alumno "extra" (nunca de los
  // propios, ver más abajo) — para que horario/diario puedan marcarlo
  // visualmente como "vía sustitución" y decir de quién, sin que este
  // módulo (que solo decide QUÉ alumnos ve, no cómo pintarlos) resuelva
  // nombres: eso es cosa de la ruta que llama, con fetchNombresDeProfesores.
  const profesorSustituidoIdPorAlumnoId = {};
  if (sustituidosHoy.profesorIds.length) {
    const porSustituido = await Promise.all(
      sustituidosHoy.profesorIds.map((pid) => fetchAlumnoIdsDeProfesor(admin, tenantId, pid))
    );
    for (let i = 0; i < porSustituido.length; i++) {
      const resultado = porSustituido[i];
      if (resultado.error) return { error: resultado.error };
      const profesorSustituidoId = sustituidosHoy.profesorIds[i];
      for (const alumnoId of resultado.alumnoIds || []) {
        if (!(alumnoId in profesorSustituidoIdPorAlumnoId)) {
          profesorSustituidoIdPorAlumnoId[alumnoId] = profesorSustituidoId;
        }
      }
      alumnoIds = alumnoIds.concat(resultado.alumnoIds || []);
    }
  }

  const result = { alumnoIds: [...new Set(alumnoIds)] };
  // Un alumno con asignación DIRECTA nunca se marca como "vía sustitución",
  // aunque por coincidencia también esté asignado al profesor sustituido
  // (alumno compartido entre dos profesores) — la asignación propia manda.
  const propiosSet = new Set(propios.alumnoIds || []);
  const sustitucionPorAlumnoId = Object.fromEntries(
    Object.entries(profesorSustituidoIdPorAlumnoId).filter(([alumnoId]) => !propiosSet.has(alumnoId))
  );
  if (Object.keys(sustitucionPorAlumnoId).length) {
    result.sustitucionPorAlumnoId = sustitucionPorAlumnoId;
  }
  return result;
}
