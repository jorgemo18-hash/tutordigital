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

export function nombreDelConcepto(temaId, numero) {
  return CONCEPTOS_POR_TEMA[temaId]?.[numero] || null;
}
