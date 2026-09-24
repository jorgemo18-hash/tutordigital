// QUÉ BATERÍA SIRVE A QUÉ OBJETIVO DE UN TEMA, y cómo se recorre.
//
// Cada tema es un archivo de temas/ (enteros1eso.js, divisibilidad1eso.js…)
// con sus objetivos, sus baterías y sus conceptos. Aquí están las reglas
// para recorrerlo, que son las mismas para todos: qué baterías son de un
// objetivo, cuáles sirven de repaso y en qué orden.
//
// EL TEMA VA SIEMPRE COMO PARÁMETRO. Los objetivos se numeran dentro de su
// tema: el objetivo 3 de enteros es "sumar y restar" y el 3 de
// divisibilidad es otro. Una función que recibiera solo el número tendría
// que suponer el tema, y suponerlo mal da una hoja de otro tema sin ningún
// error. Hasta el 25/9 había un único tema y estas funciones lo suponían.
//
// DÓNDE VIVE LA VERDAD, QUE ES LA DECISIÓN DE FONDO. Los objetivos y los
// arquetipos están en la base de datos (las migraciones que cada tema declara en `migraciones`); los
// generadores son código. Esta tabla une las dos cosas y por tanto PUEDE
// DESINCRONIZARSE: si alguien renombra un arquetipo en la base de datos, aquí
// no pasa nada y la hoja sale igual, pero el nombre impreso deja de
// corresponder a nada.
//
// Por eso hay un test (`catalogoDeBaterias.test.mjs`) que comprueba que cada
// `arquetipo` de cada generador aparece LITERALMENTE en las migraciones de su tema. No
// es una comprobación bonita —lee un `.sql` con una expresión regular— pero
// es la única que detecta esa divergencia sin base de datos delante, y el
// caso que evita es real.
//
// EL ORDEN DENTRO DE CADA OBJETIVO ES EL DE LA HOJA: de menos a más difícil.
// No se ordena después por `dificultad` porque a igual dificultad el orden
// también importa —primero sumar del mismo signo y luego de distinto— y eso
// es una secuencia pedagógica, no un número.


// Los números de objetivo del tema, en orden.
export function objetivosDe(tema) {
  return Object.keys(tema.baterias).map(Number).sort((a, b) => a - b);
}

export function tituloDeObjetivo(tema, objetivo) {
  return tema.titulos[objetivo] || null;
}

// Todas las baterías del tema, cada una con su objetivo. Para los tests y
// los scripts que recorren el catálogo entero.
export function todasLasBaterias(tema) {
  return objetivosDe(tema).flatMap((objetivo) => tema.baterias[objetivo].map((b) => ({ ...b, objetivo })));
}

// Las baterías de un objetivo, y si hace falta las de los anteriores.
//
// UN OBJETIVO PUEDE NO TENER SUFICIENTES BATERÍAS PARA UNA HOJA, y el caso no
// es teórico: el objetivo 4 de enteros ("quitar paréntesis y signos") tiene
// UNA. Una hoja de refuerzo con una sola actividad no es una hoja.
//
// La salida es incluir baterías de los objetivos ANTERIORES como calentamiento,
// que además es lo que hace un profesor: antes de quitar paréntesis se repasa
// restar. Las de repaso van primero y marcadas, para que quien monta la hoja
// vea que no son del objetivo que pidió.
export function bateriasPropias(tema, objetivo) {
  return (tema.baterias[objetivo] || []).map((b) => ({ ...b, objetivo, esRepaso: false }));
}

// Las de los objetivos anteriores, ORDENADAS PARA CALENTAR: primero las más
// fáciles, y a igual dificultad las del objetivo más cercano.
//
// El orden importa y la primera versión lo tenía al revés. Pidiendo una
// batería de repaso para una hoja de operaciones combinadas salía
// `paresConYSinParentesis` —distinguir `(-3)^2` de `-3^2`, dificultad 3— de
// calentamiento antes de la jerarquía. Un calentamiento con la batería más
// difícil del tema no calienta: desanima. Lo que hace falta antes de las
// combinadas es la regla de los signos, que es dificultad 1.
export function bateriasDeRepaso(tema, objetivo) {
  return objetivosDe(tema)
    .filter((n) => n < objetivo)
    .flatMap((n) => tema.baterias[n].map((b) => ({ ...b, objetivo: n, esRepaso: true })))
    .sort((a, b) => a.dificultad - b.dificultad || b.objetivo - a.objetivo);
}

export function bateriasParaObjetivo(tema, objetivo, { conRepaso = true } = {}) {
  const propias = bateriasPropias(tema, objetivo);
  if (!conRepaso) return propias;
  // El repaso va DELANTE y las propias después: la hoja sube de dificultad
  // hacia el objetivo que se practica.
  return [...bateriasDeRepaso(tema, objetivo), ...propias];
}
