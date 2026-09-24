import * as multiplosDivisores from "../generadores/divisibilidad/multiplosDivisores.js";
import * as criterios from "../generadores/divisibilidad/criterios.js";
import * as primos from "../generadores/divisibilidad/primos.js";
import * as factorizacion from "../generadores/divisibilidad/factorizacion.js";
import * as mcdMcm from "../generadores/divisibilidad/mcdMcm.js";
import * as problemas from "../generadores/divisibilidad/problemas.js";

// EL TEMA «DIVISIBILIDAD» DE 1.º ESO (migración 135).
//
// El segundo tema con generador. Todo es de un solo saber, A.4 «Relaciones»
// («Factores, múltiplos y divisores. Factorización en números primos para
// resolver problemas»), y todo se resuelve con aritmetica.js: los números
// los elige el generador, la respuesta la calcula el código.
//
// Mismas reglas que enteros (ver enteros1eso.js): el orden dentro de cada
// objetivo es el de la hoja, de menos a más difícil; `minimo` y `maximo`
// salen de las instrucciones del arquetipo sembrado; `concepto` es el número
// del concepto del arquetipo en la migración.

const TITULO_DE_OBJETIVO = {
  1: "Calcular múltiplos y divisores",
  2: "Aplicar los criterios de divisibilidad",
  3: "Distinguir números primos y compuestos",
  4: "Descomponer en factores primos",
  5: "Calcular el m.c.d. y el m.c.m.",
  6: "Resolver problemas de m.c.d. y m.c.m.",
};

const BATERIAS_POR_OBJETIVO = {
  1: [
    { generador: multiplosDivisores.continuaMultiplos, clave: "continua_multiplos", concepto: 1, dificultad: 1, minimo: 4, maximo: 6 },
    { generador: multiplosDivisores.esMultiploODivisor, clave: "es_multiplo_o_divisor", concepto: 2, dificultad: 1, minimo: 6, maximo: 8 },
    { generador: multiplosDivisores.multiplosEntre, clave: "multiplos_entre", concepto: 1, dificultad: 2, minimo: 3, maximo: 4 },
    { generador: multiplosDivisores.todosLosDivisores, clave: "todos_los_divisores", concepto: 2, dificultad: 2, minimo: 3, maximo: 4 },
  ],
  2: [
    { generador: criterios.divisiblePor, clave: "divisible_por", concepto: 3, dificultad: 1, minimo: 5, maximo: 7 },
    { generador: criterios.cifraQueFalta, clave: "cifra_que_falta", concepto: 3, dificultad: 2, minimo: 3, maximo: 4 },
  ],
  3: [
    { generador: primos.primoOCompuesto, clave: "primo_o_compuesto", concepto: 4, dificultad: 1, minimo: 6, maximo: 8 },
    { generador: primos.primosEntreDos, clave: "primos_entre", concepto: 4, dificultad: 2, minimo: 2, maximo: 3 },
  ],
  4: [
    { generador: factorizacion.descomponEnFactores, clave: "descompon_en_factores", concepto: 5, dificultad: 1, minimo: 4, maximo: 6 },
    { generador: factorizacion.numeroDesdeFactores, clave: "numero_desde_factores", concepto: 5, dificultad: 1, minimo: 4, maximo: 6 },
    { generador: factorizacion.esDivisorPorFactores, clave: "es_divisor_por_factores", concepto: 5, dificultad: 3, minimo: 3, maximo: 4 },
  ],
  5: [
    { generador: mcdMcm.mcdDeDos, clave: "mcd_de_dos", concepto: 6, dificultad: 2, minimo: 3, maximo: 5 },
    { generador: mcdMcm.mcmDeDos, clave: "mcm_de_dos", concepto: 7, dificultad: 2, minimo: 3, maximo: 5 },
    { generador: mcdMcm.mcdYMcmDeTres, clave: "mcd_y_mcm_de_tres", concepto: 7, dificultad: 3, minimo: 2, maximo: 3 },
  ],
  6: [
    { generador: problemas.problemasDeMcm, clave: "problemas_mcm", concepto: 8, dificultad: 2, minimo: 2, maximo: 3 },
    { generador: problemas.problemasDeMcd, clave: "problemas_mcd", concepto: 8, dificultad: 2, minimo: 2, maximo: 3 },
    { generador: problemas.problemasMezclados, clave: "problemas_mezclados", concepto: 8, dificultad: 3, minimo: 2, maximo: 3 },
  ],
};

// Literal de la migración 135 (lo comprueba catalogoDeBaterias.test.mjs).
const CONCEPTOS = {
  1: "Múltiplos de un número",
  2: "Divisores de un número",
  3: "Criterios de divisibilidad por 2, 3, 5 y 10",
  4: "Números primos y compuestos",
  5: "Descomposición en factores primos",
  6: "Máximo común divisor",
  7: "Mínimo común múltiplo",
  8: "Problemas de m.c.d. y m.c.m.",
};

const SABERES = { 1: "A.4", 2: "A.4", 3: "A.4", 4: "A.4", 5: "A.4", 6: "A.4", 7: "A.4", 8: "A.4" };

export const DIVISIBILIDAD_1ESO = {
  id: "c0000000-0000-4000-8000-000000000002",
  curso: "1.º ESO",
  materia: "Matemáticas",
  nombre: "Divisibilidad",
  titulos: TITULO_DE_OBJETIVO,
  baterias: BATERIAS_POR_OBJETIVO,
  conceptos: CONCEPTOS,
  saberes: SABERES,
  idDeConcepto: (n) => `c1000000-0000-4000-8000-0000000002${String(n).padStart(2, "0")}`,
  // Sin `aritmetica.js`: son las cuentas, no baterías.
  modulos: [multiplosDivisores, criterios, primos, factorizacion, mcdMcm, problemas],
  migraciones: {
    objetivos: ["135_semilla_divisibilidad_1eso.sql"],
    arquetipos: ["135_semilla_divisibilidad_1eso.sql"],
    conceptos: ["135_semilla_divisibilidad_1eso.sql"],
  },
};
