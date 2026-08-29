// Selector de "quién imparte estas clases" en la ficha del alumno.
//
// La columna `profesor_id` es POR FRANJA (migración 109): un alumno puede
// tener el martes con María y el jueves con Pedro. Este selector, en cambio,
// es UNO para todo el horario del alumno, a propósito:
//
//   - lo normal, con diferencia, es que todas las clases de un alumno las dé
//     la misma persona; poner un desplegable en cada casilla serían hasta 30
//     desplegables en una rejilla de 5 días x 6 horas, y el alta pasaría de
//     dos clics a treinta;
//   - el caso de "cada día con uno" se resuelve donde de verdad se planifica,
//     que es la vista de Horario del centro, no rellenando la ficha de un
//     alumno.
//
// EL CASO PELIGROSO es el alumno que YA tiene franjas con profesores
// distintos: si el selector mostrara uno solo y el admin guardara, aplanaría
// en silencio lo que alguien cuadró en la vista del centro. Por eso existe
// la opción "(varios)": mientras siga elegida, cada franja conserva SU
// profesor. Solo al elegir un nombre concreto se aplica a todas.

export const VALOR_VARIOS = "__varios__";
export const VALOR_SIN_ASIGNAR = "";

// Qué valor inicial le corresponde al selector según lo que ya tenga el
// alumno: el profesor común si todas las franjas coinciden, "(varios)" si no.
//
// CON UN SOLO PROFESOR EN EL CENTRO se preselecciona ese, en vez de dejar
// "Sin asignar": no hay ambigüedad posible —solo puede darla él— y obligar
// a elegirlo en cada alta es papeleo puro. En cuanto hay dos o más, se
// vuelve a "Sin asignar": ahí sí hay que decidir, y elegir por el admin
// sería inventarse el dato.
//
// No se toca lo que el alumno YA tenga: si sus franjas dicen otro profesor
// (uno dado de baja, por ejemplo), manda lo que hay guardado.
export function valorInicial(horarioActual = [], profesores = []) {
  const ids = [...new Set((horarioActual || []).map((h) => h.profesor_id ?? null))];
  if (ids.length > 1) return VALOR_VARIOS;
  const actual = ids[0] ?? VALOR_SIN_ASIGNAR;
  if (actual !== VALOR_SIN_ASIGNAR) return actual;
  return profesores.length === 1 ? profesores[0].id : VALOR_SIN_ASIGNAR;
}

// El profesor que le toca a una franja concreta al guardar. `original` es el
// profesor que esa franja tenía antes (null si es nueva o no tenía).
export function profesorDeFranja(seleccion, original) {
  if (seleccion === VALOR_VARIOS) return original ?? null;
  return seleccion || null;
}

export function buildProfesorSelector({ profesores = [], horarioActual = [] } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-field";

  const label = document.createElement("label");
  label.className = "ac-label";
  label.textContent = "Imparte";
  wrap.appendChild(label);

  const select = document.createElement("select");
  select.className = "ac-select";

  const inicial = valorInicial(horarioActual, profesores);

  // Las opciones se deciden y se añaden YA EN ORDEN, en vez de insertar
  // "(varios)" al principio después: leer `select.firstChild` revienta bajo
  // happy-dom cuando pdf-parse ya ha parcheado Object.defineProperty global
  // (se ve solo en la suite, no en el navegador). Construir la lista de una
  // vez es además más fácil de seguir.
  const opciones = [
    // "(varios)" solo existe si de verdad hay varios: ofrecerla siempre
    // invita a elegirla sin saber qué significa.
    ...(inicial === VALOR_VARIOS
      ? [{ value: VALOR_VARIOS, label: "(varios — se mantiene el de cada franja)" }]
      : []),
    { value: VALOR_SIN_ASIGNAR, label: "Sin asignar" },
    ...profesores.map((p) => ({ value: p.id, label: p.display_name || p.email || "Profesor" })),
  ];
  for (const { value, label: texto } of opciones) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = texto;
    select.appendChild(opt);
  }
  select.value = inicial;

  wrap.appendChild(select);
  return { wrap, select, getValue: () => select.value };
}
