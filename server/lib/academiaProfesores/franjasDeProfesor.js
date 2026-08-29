// Qué franjas del horario le tocan a un profesor (paso 3 del horario por
// profesor, migración 109).
//
// LA REGLA, decidida por Jorge el 29/08 con su caso real delante:
//
//   - Si la franja dice quién la imparte, MANDA ESO. Marta puede llevar el
//     martes con María y el jueves con Pedro: el jueves es de Pedro, y
//     María no lo ve en su horario ni en su diario. Es lo que evita que dos
//     profesores escriban el mismo parte (solo hay UNA sesión por alumno y
//     día) y se pisen sin enterarse.
//   - Si la franja NO dice quién la imparte, se cae a lo de siempre: la ven
//     los profesores a los que está asignado el alumno. Una academia que
//     nunca rellene el campo funciona EXACTAMENTE igual que antes — cero
//     regresión, que es la condición con la que se aceptó este cambio.
//   - La SUSTITUCIÓN suma, no sustituye: si María falta y Pedro la cubre,
//     Pedro ve además las franjas de María ese día. Eso ya funcionaba por
//     alumnos (ver resolverAlumnosVisibles.js) y aquí sigue funcionando
//     porque el sustituido entra en la lista de "profesores propios".
//
// Consecuencia que hay que tener presente: un profesor puede impartir la
// franja de un alumno que NO tiene asignado. Por eso el conjunto de alumnos
// visibles se amplía con los de sus propias franjas — si no, Pedro vería la
// clase del jueves y no podría escribir el parte, que es peor que no verla.

// Los alumnos de las franjas VIGENTES que imparte cualquiera de estos
// profesores (el propio y los que sustituye hoy).
export async function fetchAlumnoIdsDeFranjasDeProfesor(admin, tenantId, profesorIds) {
  if (!profesorIds?.length) return { alumnoIds: [] };
  const { data, error } = await admin
    .from("academia_horario")
    .select("alumno_id")
    .eq("tenant_id", tenantId)
    .is("fecha_fin", null)
    .in("profesor_id", profesorIds);
  if (error) return { error };
  return { alumnoIds: [...new Set((data || []).map((f) => f.alumno_id).filter(Boolean))] };
}

// ¿Esta franja concreta le toca a este profesor?
//
// `ambito` null/undefined = no hay ámbito de profesor (un admin
// gestionando): no se filtra nada. El corte de seguridad de "profesor sin
// nada" vive donde siempre, en resolverAlumnoIdsVisibles, y no se duplica
// aquí.
//
// `ambito.alumnoIdsAsignados` son los alumnos que este profesor tiene
// ASIGNADOS (más los del profesor al que sustituye hoy), que NO es lo mismo
// que los alumnos que puede ver: ver también incluye a los de sus propias
// franjas. La diferencia importa exactamente en el caso de abajo — una
// franja sin profesor de un alumno que no es suyo. Pedro imparte el jueves
// de Marta, que está asignada a María; el viernes de Marta está sin asignar,
// y ese viernes es de María, no de Pedro.
export function franjaVisibleParaProfesor(franja, ambito) {
  if (!ambito) return true;
  const imparte = franja?.profesor_id ?? null;
  if (imparte !== null) return (ambito.profesorIds || []).includes(imparte);
  // Sin asignar: manda la asignación del alumno, como antes de la 109.
  return (ambito.alumnoIdsAsignados || []).includes(franja?.alumno_id ?? franja?.alumno?.id);
}

export function filtrarFranjasDeProfesor(franjas, ambito) {
  if (!ambito) return franjas || [];
  return (franjas || []).filter((f) => franjaVisibleParaProfesor(f, ambito));
}
