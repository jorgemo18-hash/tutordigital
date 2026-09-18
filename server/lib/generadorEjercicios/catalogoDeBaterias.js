import * as sumaResta from "./generadores/sumaResta.js";
import * as producto from "./generadores/producto.js";
import * as potencias from "./generadores/potencias.js";
import * as combinadas from "./generadores/combinadas.js";

// QUÉ BATERÍA SIRVE A QUÉ OBJETIVO, con su dificultad y cuántos apartados
// admite.
//
// Es la pieza que le falta al montador para poder montar una hoja: los quince
// generadores saben hacer su batería pero ninguno sabe a qué objetivo
// pertenece ni cuántos apartados pide su arquetipo.
//
// DÓNDE VIVE LA VERDAD, QUE ES LA DECISIÓN DE FONDO. Los objetivos y los
// arquetipos están en la base de datos (migraciones 120 y 123); los
// generadores son código. Esta tabla une las dos cosas y por tanto PUEDE
// DESINCRONIZARSE: si alguien renombra un arquetipo en la base de datos, aquí
// no pasa nada y la hoja sale igual, pero el nombre impreso deja de
// corresponder a nada.
//
// Por eso hay un test (`catalogoDeBaterias.test.mjs`) que comprueba que cada
// `arquetipo` de cada generador aparece LITERALMENTE en la migración 120. No
// es una comprobación bonita —lee un `.sql` con una expresión regular— pero
// es la única que detecta esa divergencia sin base de datos delante, y el
// caso que evita es real.
//
// EL ORDEN DENTRO DE CADA OBJETIVO ES EL DE LA HOJA: de menos a más difícil.
// No se ordena después por `dificultad` porque a igual dificultad el orden
// también importa —primero sumar del mismo signo y luego de distinto— y eso
// es una secuencia pedagógica, no un número.

// Los rangos de apartados salen de las instrucciones de los arquetipos
// sembrados, no de lo que caiga bien: "de 6 a 9 apartados", "de 3 a 4
// apartados", "de 2 a 4". Cuando el montador tiene que recortar una hoja,
// recorta hasta el mínimo del arquetipo y no por debajo.
export const BATERIAS_POR_OBJETIVO = {
  // 1. Reconocer y ordenar números enteros — todavía sin generadores: son
  //    "ordena de menor a mayor" y "sitúa en la recta", que no son
  //    expresiones, y el de la recta necesita antes el dibujo en SVG.
  1: [],

  // 2. Valor absoluto y opuesto — misma razón: otra forma de ejercicio.
  2: [],

  3: [
    { generador: sumaResta.sumaMismoSigno, dificultad: 1, minimo: 6, maximo: 9 },
    { generador: sumaResta.sumaDistintoSigno, dificultad: 1, minimo: 6, maximo: 8 },
    { generador: sumaResta.restaConParentesis, dificultad: 1, minimo: 6, maximo: 8 },
    { generador: sumaResta.terminoQueFalta, dificultad: 2, minimo: 4, maximo: 6 },
    { generador: sumaResta.cadenaSumasRestas, dificultad: 2, minimo: 3, maximo: 4 },
  ],

  4: [
    { generador: sumaResta.eliminaParentesis, dificultad: 2, minimo: 3, maximo: 4 },
  ],

  5: [
    { generador: producto.multiplicaDosEnteros, dificultad: 1, minimo: 6, maximo: 8 },
    { generador: producto.divideDosEnteros, dificultad: 1, minimo: 6, maximo: 8 },
    { generador: potencias.potenciasDeBaseEntera, dificultad: 2, minimo: 5, maximo: 8 },
    { generador: producto.factorQueFalta, dificultad: 2, minimo: 4, maximo: 6 },
    { generador: producto.cadenaProductosCocientes, dificultad: 2, minimo: 3, maximo: 4 },
    { generador: potencias.paresConYSinParentesis, dificultad: 3, minimo: 4, maximo: 6 },
  ],

  6: [
    { generador: combinadas.combinadaDeUnNivel, dificultad: 2, minimo: 3, maximo: 4 },
    { generador: combinadas.subrayaLaPreferente, dificultad: 2, minimo: 4, maximo: 6 },
    { generador: combinadas.combinadaConCorchetes, dificultad: 3, minimo: 2, maximo: 4 },
  ],
};

export const OBJETIVOS = Object.keys(BATERIAS_POR_OBJETIVO).map(Number).sort((a, b) => a - b);

// Las baterías de un objetivo, y si hace falta las de los anteriores.
//
// UN OBJETIVO PUEDE NO TENER SUFICIENTES BATERÍAS PARA UNA HOJA, y el caso no
// es teórico: el objetivo 4 ("quitar paréntesis y signos") tiene UNA. Una hoja
// de refuerzo con una sola actividad no es una hoja.
//
// La salida es incluir baterías de los objetivos ANTERIORES como calentamiento,
// que además es lo que hace un profesor: antes de quitar paréntesis se repasa
// restar. Las de repaso van primero y marcadas, para que quien monta la hoja
// vea que no son del objetivo que pidió.
export function bateriasPropias(objetivo) {
  return (BATERIAS_POR_OBJETIVO[objetivo] || []).map((b) => ({ ...b, objetivo, esRepaso: false }));
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
export function bateriasDeRepaso(objetivo) {
  return OBJETIVOS
    .filter((n) => n < objetivo)
    .flatMap((n) => (BATERIAS_POR_OBJETIVO[n] || []).map((b) => ({ ...b, objetivo: n, esRepaso: true })))
    .sort((a, b) => a.dificultad - b.dificultad || b.objetivo - a.objetivo);
}

export function bateriasParaObjetivo(objetivo, { conRepaso = true } = {}) {
  const propias = bateriasPropias(objetivo);
  if (!conRepaso) return propias;
  // El repaso va DELANTE y las propias después: la hoja sube de dificultad
  // hacia el objetivo que se practica.
  return [...bateriasDeRepaso(objetivo), ...propias];
}
