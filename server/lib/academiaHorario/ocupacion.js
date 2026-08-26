// Cuántos alumnos ocupan cada franja del horario del centro.
//
// El admin asignaba franjas a ciegas: la rejilla del drawer marca casillas
// pero no dice cuántos alumnos hay ya en cada una, así que no había forma de
// saber si una franja estaba llena sin salir a mirar otra pantalla — y la
// decisión se toma justo ahí, rellenando la ficha.
//
// Deliberadamente NO hay concepto de capacidad ni de "lleno": el sistema no
// sabe cuántas plazas tiene una franja (no existe esa columna en ninguna
// tabla) y un límite inventado estorbaría más de lo que ayuda. Se informa
// del número real y decide el admin. Cuando el centro quiera fijar un
// máximo, se compara contra estos mismos conteos sin cambiar nada de aquí.
//
// La clave (`dia|HH:MM`) es la misma que usa horarioSection.js para marcar
// las casillas, para que ambos lados hablen el mismo idioma sin traducir.

export function claveFranja(diaSemana, horaInicio) {
  return `${Number(diaSemana)}|${String(horaInicio || "").slice(0, 5)}`;
}

// `franjas`: filas vigentes tal y como las devuelve GET /academia/horario
// (con `alumno` embebido). `excluirAlumnoId`: el alumno cuya ficha se está
// editando — sus propias marcas no cuentan como ocupación ajena, porque lo
// que el admin necesita saber es "cuántos OTROS hay ya aquí".
export function contarOcupacion(franjas, { excluirAlumnoId = null } = {}) {
  const porFranja = new Map();
  // Array.isArray y no un valor por defecto: `= []` solo cubre undefined, y
  // una respuesta de API puede llegar como null perfectamente.
  if (!Array.isArray(franjas)) return porFranja;
  for (const f of franjas) {
    const alumnoId = f?.alumno?.id ?? f?.alumno_id ?? null;
    if (excluirAlumnoId && alumnoId === excluirAlumnoId) continue;
    const clave = claveFranja(f?.dia_semana, f?.hora_inicio);
    porFranja.set(clave, (porFranja.get(clave) || 0) + 1);
  }
  return porFranja;
}

// Alumnos activos que no tienen ninguna franja vigente. Es el caso normal de
// un alta en la que todavía no se ha cuadrado el horario ("empieza en
// octubre"): sin esta lista, esos alumnos quedan guardados y fuera de la
// vista, y no hay ningún sitio donde se vea que les falta algo.
export function alumnosSinHorario(alumnos, franjas) {
  const listaAlumnos = Array.isArray(alumnos) ? alumnos : [];
  const conFranja = new Set(
    (Array.isArray(franjas) ? franjas : [])
      .map((f) => f?.alumno?.id ?? f?.alumno_id)
      .filter(Boolean)
  );
  return listaAlumnos.filter((a) => a?.activo !== false && !conFranja.has(a.id));
}

// Estado de una franja frente al máximo de plazas del centro
// (academia_config.max_alumnos_por_franja, migración 106).
//
// `maximo` null/0 = el centro no ha fijado plazas: la franja nunca está
// "llena" porque nadie ha dicho cuántas caben. Se sigue informando de la
// ocupación, solo que sin comparar.
//
// "excedido" existe además de "lleno" porque superar el máximo es posible a
// propósito: el límite avisa y no bloquea, así que hay que poder pintar el
// caso de "aquí ya hay uno de más" en vez de fingir que no pasa.
export function estadoFranja(ocupados, maximo) {
  const n = Number(ocupados) || 0;
  const max = Number(maximo) || 0;
  if (max <= 0) return n > 0 ? "ocupada" : "libre";
  if (n > max) return "excedido";
  if (n >= max) return "lleno";
  return n > 0 ? "ocupada" : "libre";
}
