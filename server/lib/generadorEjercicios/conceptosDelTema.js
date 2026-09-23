// LOS NOMBRES DE LOS CONCEPTOS DEL TEMA, para enseñárselos al profesor.
//
// La pantalla de hojas del profesor (diseño de Claude Design, 23/9) dice en
// cada ejercicio qué concepto trabaja ("Resta como suma del opuesto"): es lo
// que le permite ver de un vistazo si la hoja cubre lo que quiere. Cada
// batería lleva el NÚMERO del concepto (catalogoDeBaterias.js); aquí está su
// nombre, copiado LITERAL de la migración 120. Un test comprueba que sigue
// siendo el mismo que en la base de datos, para que la pantalla no llame a
// un concepto de una forma y el resto de la app de otra.
//
// Por tema, porque el número solo tiene sentido dentro de su tema.
//
// EL SABER BÁSICO de cada concepto (A.2, A.3…) es el de la columna `saber`
// de la migración 120, en la notación del anexo de Aragón (ORDEN
// ECD/1172/2022); su nombre y el texto literal están en
// saberesBasicos.js.
export const CONCEPTOS_POR_TEMA = {
  "c0000000-0000-4000-8000-000000000001": {
    1: "Situaciones que piden un número con signo",
    2: "El conjunto Z: positivos, negativos y el cero",
    3: "Valor absoluto",
    4: "Opuesto de un entero",
    5: "Orden y comparación de enteros",
    6: "Representación en la recta numérica",
    7: "Suma de enteros del mismo y de distinto signo",
    8: "Resta como suma del opuesto",
    9: "Eliminación de paréntesis y signos",
    10: "Producto y cociente: la regla de los signos",
    11: "Potencias de base entera",
    12: "Jerarquía de operaciones con enteros",
  },
};

// El saber básico de cada concepto, literal de la migración 120.
export const SABER_POR_CONCEPTO = {
  "c0000000-0000-4000-8000-000000000001": {
    1: "A.2", 2: "A.2", 3: "A.2", 4: "A.2", 5: "A.2", 6: "A.2",
    7: "A.3", 8: "A.3", 9: "A.3", 10: "A.3", 11: "A.3", 12: "A.3",
  },
};

export function nombreDelConcepto(temaId, numero) {
  return CONCEPTOS_POR_TEMA[temaId]?.[numero] || null;
}

export function saberDelConcepto(temaId, numero) {
  return SABER_POR_CONCEPTO[temaId]?.[numero] || null;
}
