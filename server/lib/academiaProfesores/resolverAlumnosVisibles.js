import { fetchAlumnoIdsDeProfesor } from "./asignaciones.js";
import { fetchProfesoresSustituidosHoy } from "../academiaSustituciones/consultas.js";
import { fetchAlumnoIdsDeFranjasDeProfesor } from "./franjasDeProfesor.js";

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
// `ambitoProfesor`: el usuario pide ver el conjunto de un PROFESOR aunque su
// rol sea admin — lo usa la sección "Dar clase" del panel de admin, donde el
// admin lleva el sombrero de profesor y necesita ver sus alumnos asignados,
// no los del centro entero (que es lo correcto gestionando, y ruido inútil
// dando clase en una academia con varios profesores).
//
// Es imposible que amplíe nada: solo puede convertir "sin filtro" (admin) en
// "filtrado por asignaciones", nunca al revés. Un `teacher` sigue siendo
// `teacher` pase lo que pase en este parámetro, así que la regla de abajo
// —un profesor sin asignaciones nunca cae a "sin filtro"— queda intacta.
export async function resolverAlumnoIdsVisibles(admin, {
  tenantId, tenantSlug, userId, role, findProfesorIdFn, hoyISO: hoyOverride, ambitoProfesor = false,
}) {
  const rolEfectivo = ambitoProfesor ? "teacher" : role;
  if (rolEfectivo !== "teacher") return { alumnoIds: null };

  const profesorId = await findProfesorIdFn(admin, tenantSlug, userId);
  if (!profesorId) return { alumnoIds: [] };

  const hoy = hoyOverride || hoyISO();

  const [propios, sustituidosHoy] = await Promise.all([
    fetchAlumnoIdsDeProfesor(admin, tenantId, profesorId),
    fetchProfesoresSustituidosHoy(admin, { tenantId, profesorSustitutoId: profesorId, hoyISO: hoy }),
  ]);
  if (propios.error) return { error: propios.error };
  if (sustituidosHoy.error) return { error: sustituidosHoy.error };

  // Tercera fuente, desde el paso 3 del horario por profesor: los alumnos
  // de las franjas que IMPARTE (las suyas y las de quien sustituye hoy).
  // Un profesor puede impartir la franja de un alumno que no tiene
  // asignado —"a Marta la lleva María los martes y Pedro los jueves"— y sin
  // esto Pedro vería esa clase en su horario pero no podría escribir su
  // parte, que es peor que no verla. Ver franjasDeProfesor.js.
  const profesorIdsPropios = [profesorId, ...sustituidosHoy.profesorIds];
  const deFranjas = await fetchAlumnoIdsDeFranjasDeProfesor(admin, tenantId, profesorIdsPropios);
  if (deFranjas.error) return { error: deFranjas.error };

  // Los ASIGNADOS (propios + los del profesor al que sustituye hoy) se
  // guardan aparte de los que entran por impartir su franja: una franja SIN
  // profesor la ve quien tiene al alumno asignado, no quien resulta darle
  // otra clase distinta. Ver franjaVisibleParaProfesor.
  const alumnoIdsAsignados = [...(propios.alumnoIds || [])];
  let alumnoIds = [...(propios.alumnoIds || []), ...(deFranjas.alumnoIds || [])];
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
      alumnoIdsAsignados.push(...(resultado.alumnoIds || []));
    }
  }

  // `profesorIdsPropios` viaja con el resultado para que horario y diario
  // puedan además descartar las franjas que imparte OTRO profesor de un
  // alumno que sí es visible (ver filtrarFranjasDeProfesor). Este módulo
  // decide QUÉ alumnos se ven; cuáles de sus franjas, se decide con esto.
  const result = {
    alumnoIds: [...new Set(alumnoIds)],
    // El ámbito de franjas: con qué criterio se decide, franja a franja,
    // cuáles de las de esos alumnos son suyas.
    ambitoFranjas: { profesorIds: profesorIdsPropios, alumnoIdsAsignados: [...new Set(alumnoIdsAsignados)] },
  };
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
