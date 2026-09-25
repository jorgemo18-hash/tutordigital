import * as expresiones from "../generadores/algebra/expresiones.js";
import * as secuencias from "../generadores/algebra/secuencias.js";
import * as ecuaciones from "../generadores/algebra/ecuaciones.js";
import * as problemas from "../generadores/algebra/problemas.js";

// EL TEMA «ÁLGEBRA» DE 1.º ESO (migración 138).
//
// Ecuaciones con solución entera y pequeña (sin calculadora en 1.º) y
// ejemplos por transposición, que es lo que enseña Jorge. El alcance lo
// elige el profesor por objetivos, de menos a más: ver la cabecera de la
// migración.

const TITULO_DE_OBJETIVO = {
  1: "Usar el lenguaje algebraico y el valor numérico",
  2: "Reducir expresiones algebraicas",
  3: "Encontrar la regla de una secuencia",
  4: "Resolver ecuaciones de un paso",
  5: "Resolver ecuaciones de primer grado",
  6: "Resolver problemas con ecuaciones",
};

const B = (generador, clave, concepto, dificultad, minimo, maximo) => ({ generador, clave, concepto, dificultad, minimo, maximo });

const BATERIAS_POR_OBJETIVO = {
  1: [
    B(expresiones.traduceEnunciado, "traduce_enunciado", 1, 1, 6, 8),
    B(expresiones.valorNumerico, "valor_numerico", 2, 1, 6, 8),
  ],
  2: [
    B(expresiones.reduceSemejantes, "reduce_semejantes", 3, 1, 5, 7),
    B(expresiones.reduceConParentesis, "reduce_con_parentesis", 3, 2, 4, 6),
  ],
  3: [
    B(secuencias.siguientesTerminos, "siguientes_terminos", 4, 1, 4, 6),
    B(secuencias.terminoLejano, "termino_lejano", 4, 2, 3, 4),
    B(secuencias.terminoGeneral, "termino_general", 4, 3, 3, 4),
  ],
  4: [
    B(ecuaciones.compruebaSolucion, "comprueba_solucion", 5, 1, 5, 7),
    B(ecuaciones.ecuacionSumaResta, "ecuacion_suma_resta", 5, 1, 6, 8),
    B(ecuaciones.ecuacionProductoCociente, "ecuacion_producto_cociente", 5, 1, 6, 8),
  ],
  5: [
    B(ecuaciones.ecuacionDosPasos, "ecuacion_dos_pasos", 6, 2, 5, 7),
    B(ecuaciones.ecuacionXDosLados, "ecuacion_x_dos_lados", 6, 2, 4, 6),
    B(ecuaciones.ecuacionConParentesis, "ecuacion_con_parentesis", 7, 3, 3, 4),
  ],
  6: [
    B(problemas.problemasDeNumeros, "problemas_ecuacion_numeros", 8, 2, 2, 3),
    B(problemas.problemasDeRepartos, "problemas_ecuacion_repartos", 8, 3, 2, 3),
  ],
};

const CONCEPTOS = {
  1: "Lenguaje algebraico",
  2: "Valor numérico de una expresión",
  3: "Reducir expresiones algebraicas",
  4: "Secuencias y su regla",
  5: "Ecuaciones de un paso",
  6: "Ecuaciones de primer grado",
  7: "Ecuaciones con paréntesis",
  8: "Problemas con ecuaciones",
};

const SABERES = { 1: "D.2", 2: "D.3", 3: "D.4", 4: "D.1", 5: "D.4", 6: "D.4", 7: "D.4", 8: "D.2" };

export const ALGEBRA_1ESO = {
  id: "c0000000-0000-4000-8000-000000000005",
  curso: "1.º ESO",
  materia: "Matemáticas",
  nombre: "Álgebra",
  titulos: TITULO_DE_OBJETIVO,
  baterias: BATERIAS_POR_OBJETIVO,
  conceptos: CONCEPTOS,
  saberes: SABERES,
  idDeConcepto: (n) => `c1000000-0000-4000-8000-0000000005${String(n).padStart(2, "0")}`,
  modulos: [expresiones, secuencias, ecuaciones, problemas],
  migraciones: {
    objetivos: ["138_semilla_algebra_1eso.sql"],
    arquetipos: ["138_semilla_algebra_1eso.sql"],
    conceptos: ["138_semilla_algebra_1eso.sql"],
  },
};
