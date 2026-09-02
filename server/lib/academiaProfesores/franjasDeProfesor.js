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

// El día de la semana en ISO (1=lunes … 7=domingo) de un "YYYY-MM-DD".
// Se parsea en UTC a mano: `new Date("2026-09-10")` ya es UTC, pero
// getDay() lo devuelve en la zona del servidor y en Render (UTC) coincide
// por casualidad — en un servidor en otra zona, una fecha se leería como el
// día anterior. Un parte guardado en el día equivocado no da error: se ve
// mal y punto, que es peor.
export function diaSemanaISO(fecha) {
  const [anio, mes, dia] = String(fecha || "").split("-").map(Number);
  if (!anio || !mes || !dia) return null;
  const jsDay = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay(); // 0=domingo
  return jsDay === 0 ? 7 : jsDay;
}

// ¿Ese día, de ese alumno, es de OTRO profesor?
//
// Es el afinado de la frontera de ESCRITURA, y está escrito al revés a
// propósito: no se pregunta "¿me toca a mí?" sino "¿le toca a otro?". La
// diferencia es todo:
//
//   - preguntando "¿me toca?" habría que tener franja ese día para poder
//     escribir, y eso rompe lo más normal del mundo — una RECUPERACIÓN, una
//     clase suelta fuera del horario habitual, un aviso de ausencia de un
//     día que se cambió. Nada de eso tiene franja, y bloquearlo sería
//     inventarse una regla que nadie ha pedido;
//   - preguntando "¿le toca a otro?" solo se bloquea el conflicto real: el
//     martes de Marta es de María, y Pedro no puede escribirlo. Con UN SOLO
//     profesor en el centro no hay "otro" posible, así que esto no se
//     dispara nunca y todo funciona como si no existiera.
//
// Si ese día hay franja suya Y de otro (dos clases el mismo día), manda la
// suya: tiene clase con el alumno, puede escribir el parte.
export async function franjaDeOtroProfesorEseDia(admin, { tenantId, alumnoId, fecha, profesorIds }) {
  const diaSemana = diaSemanaISO(fecha);
  if (!diaSemana) return { deOtro: false };
  const { data, error } = await admin
    .from("academia_horario")
    .select("profesor_id")
    .eq("tenant_id", tenantId)
    .eq("alumno_id", alumnoId)
    .eq("dia_semana", diaSemana)
    .lte("fecha_inicio", fecha)
    .or(`fecha_fin.is.null,fecha_fin.gte.${fecha}`);
  if (error) return { error };

  const franjas = (data || []).filter((f) => f.profesor_id);
  if (!franjas.length) return { deOtro: false }; // día sin dueño: recuperación y demás
  const propios = profesorIds || [];
  if (franjas.some((f) => propios.includes(f.profesor_id))) return { deOtro: false };
  return { deOtro: true };
}
