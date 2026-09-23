import * as sumaResta from "./generadores/sumaResta.js";
import * as producto from "./generadores/producto.js";
import * as potencias from "./generadores/potencias.js";
import * as combinadas from "./generadores/combinadas.js";
import * as reconocer from "./generadores/reconocer.js";
import * as absolutoOpuesto from "./generadores/absolutoOpuesto.js";
import * as recta from "./generadores/recta.js";

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

// EL TÍTULO DE CADA OBJETIVO, para encabezar su bloque en la hoja.
//
// Está aquí y no inventado en la plantilla porque es CONTENIDO: sale de los
// objetivos sembrados en la migración 123, palabra por palabra. Es la misma
// costura que los arquetipos y tiene el mismo guardián: un test comprueba que
// cada uno de estos títulos aparece LITERALMENTE en esa migración, para que
// renombrar un objetivo en la base de datos no deje la hoja titulando algo
// que ya no existe.
export const TITULO_DE_OBJETIVO = {
  1: "Reconocer y ordenar números enteros",
  2: "Valor absoluto y opuesto",
  3: "Sumar y restar enteros",
  4: "Quitar paréntesis y signos",
  5: "Multiplicar, dividir y elevar a potencias",
  6: "Resolver operaciones combinadas",
};

// LA `clave` ESTÁ DUPLICADA A PROPÓSITO. La escribe el generador dentro de
// cada ejercicio, y aquí se repite porque hay dos sitios que la necesitan SIN
// generar nada: la tabla de alturas medidas (`alturasMedidas.js`, indexada
// por clave) y el montador, que tiene que estimar cuánto ocupa una batería
// antes de armarla. Un test comprueba que la clave del catálogo es la misma
// que escribe el generador.

// Los rangos de apartados salen de las instrucciones de los arquetipos
// sembrados, no de lo que caiga bien: "de 6 a 9 apartados", "de 3 a 4
// apartados", "de 2 a 4". Cuando el montador tiene que recortar una hoja,
// recorta hasta el mínimo del arquetipo y no por debajo.
export const BATERIAS_POR_OBJETIVO = {
  // 1. Reconocer y ordenar números enteros. Falta el verdadero/falso
  //    justificado (la respuesta es un razonamiento escrito, no algo que se
  //    pueda corregir comparando; ver generadores/reconocer.js).
  //    "Ordena" cuenta LISTAS: dos o tres listas de seis o siete números.
  //    Las de la recta cuentan RECTAS: dos o tres, cada una con su dibujo.
  1: [
    {
      generador: reconocer.asociaEnteroASituacion,
      clave: "asocia_entero_situacion",
      dificultad: 1, minimo: 6, maximo: 8,
    },
    {
      generador: recta.representaEnRecta,
      clave: "representa_en_recta",
      dificultad: 1, minimo: 2, maximo: 3,
    },
    {
      generador: recta.leeLaRecta,
      clave: "lee_la_recta",
      dificultad: 1, minimo: 2, maximo: 3,
    },
    {
      generador: reconocer.comparaEnteros,
      clave: "compara_enteros",
      dificultad: 1, minimo: 6, maximo: 8,
    },
    {
      generador: reconocer.ordenaLista,
      clave: "ordena_lista",
      dificultad: 1, minimo: 2, maximo: 3,
    },
    {
      generador: recta.leeLaRectaGraduada,
      clave: "lee_la_recta_graduada",
      dificultad: 2, minimo: 2, maximo: 3,
    },
    {
      generador: recta.representaEnRectaGraduada,
      clave: "representa_en_recta_graduada",
      dificultad: 2, minimo: 2, maximo: 3,
    },
    {
      generador: reconocer.seriesNumericas,
      clave: "series_numericas",
      dificultad: 2, minimo: 4, maximo: 5,
    },
  ],

  // 2. Valor absoluto y opuesto.
  2: [
    {
      generador: absolutoOpuesto.valorAbsoluto,
      clave: "valor_absoluto",
      dificultad: 1, minimo: 6, maximo: 8,
    },
    {
      generador: absolutoOpuesto.escribeOpuesto,
      clave: "escribe_opuesto",
      dificultad: 1, minimo: 6, maximo: 8,
    },
    {
      generador: absolutoOpuesto.encadenadosOpuestoAbsoluto,
      clave: "encadenados_opuesto_absoluto",
      dificultad: 2, minimo: 4, maximo: 6,
    },
  ],

  3: [
    {
      generador: sumaResta.sumaMismoSigno,
      clave: "suma_mismo_signo",
      dificultad: 1, minimo: 6, maximo: 9,
    },
    {
      generador: sumaResta.sumaDistintoSigno,
      clave: "suma_distinto_signo",
      dificultad: 1, minimo: 6, maximo: 8,
    },
    {
      generador: sumaResta.restaConParentesis,
      clave: "resta_con_parentesis",
      dificultad: 1, minimo: 6, maximo: 8,
    },
    {
      generador: sumaResta.terminoQueFalta,
      clave: "termino_que_falta",
      dificultad: 2, minimo: 4, maximo: 6,
    },
    {
      generador: sumaResta.cadenaSumasRestas,
      clave: "cadena_sumas_restas",
      dificultad: 2, minimo: 3, maximo: 4,
    },
  ],

  4: [
    {
      generador: sumaResta.eliminaParentesis,
      clave: "elimina_parentesis",
      dificultad: 2, minimo: 3, maximo: 4,
    },
  ],

  5: [
    {
      generador: producto.multiplicaDosEnteros,
      clave: "multiplica_dos_enteros",
      dificultad: 1, minimo: 6, maximo: 8,
    },
    {
      generador: producto.divideDosEnteros,
      clave: "divide_dos_enteros",
      dificultad: 1, minimo: 6, maximo: 8,
    },
    {
      generador: potencias.potenciasDeBaseEntera,
      clave: "potencias_base_entera",
      dificultad: 2, minimo: 5, maximo: 8,
    },
    {
      generador: producto.factorQueFalta,
      clave: "factor_que_falta",
      dificultad: 2, minimo: 4, maximo: 6,
    },
    {
      generador: producto.cadenaProductosCocientes,
      clave: "cadena_productos_cocientes",
      dificultad: 2, minimo: 3, maximo: 4,
    },
    {
      generador: potencias.paresConYSinParentesis,
      clave: "pares_con_y_sin_parentesis",
      dificultad: 3, minimo: 4, maximo: 6,
    },
  ],

  6: [
    {
      generador: combinadas.combinadaDeUnNivel,
      clave: "combinada_un_nivel",
      dificultad: 2, minimo: 3, maximo: 4,
    },
    {
      generador: combinadas.subrayaLaPreferente,
      clave: "subraya_la_preferente",
      dificultad: 2, minimo: 4, maximo: 6,
    },
    {
      generador: combinadas.combinadaConCorchetes,
      clave: "combinada_con_corchetes",
      dificultad: 3, minimo: 2, maximo: 4,
    },
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
