import * as lectura from "../generadores/decimales/lectura.js";
import * as orden from "../generadores/decimales/orden.js";
import * as sumaResta from "../generadores/decimales/sumaResta.js";
import * as productoCociente from "../generadores/decimales/productoCociente.js";
import * as problemas from "../generadores/decimales/problemas.js";

// EL TEMA «NÚMEROS DECIMALES» DE 1.º ESO (migración 140).
//
// La aritmética es exacta (generadores/decimales/decimal.js: el número sin
// coma y cuántas cifras decimales tiene, nunca la coma flotante de
// JavaScript). Lo que se queda fuera, y por qué, está en la cabecera de la
// migración.

const TITULO_DE_OBJETIVO = {
  1: "Leer, escribir y descomponer números decimales",
  2: "Comparar, ordenar y redondear números decimales",
  3: "Sumar y restar números decimales",
  4: "Multiplicar y dividir números decimales",
  5: "Resolver problemas con números decimales",
};

const B = (generador, clave, concepto, dificultad, minimo, maximo) => ({ generador, clave, concepto, dificultad, minimo, maximo });

const BATERIAS_POR_OBJETIVO = {
  1: [
    B(lectura.valorPosicional, "valor_posicional_decimal", 1, 1, 6, 8),
    B(lectura.escribeConCifras, "escribe_decimal_con_cifras", 1, 1, 4, 6),
    B(lectura.descomponDecimal, "descompon_decimal", 1, 2, 4, 6),
    B(lectura.fraccionYDecimal, "fraccion_a_decimal", 2, 2, 6, 8),
  ],
  2: [
    B(orden.comparaDecimales, "compara_decimales", 3, 1, 6, 8),
    B(orden.ordenaDecimales, "ordena_decimales", 3, 2, 2, 3),
    B(orden.redondeaDecimal, "redondea_decimal", 4, 2, 5, 7),
  ],
  3: [
    B(sumaResta.sumaDecimales, "suma_decimales", 5, 1, 6, 8),
    B(sumaResta.restaDecimales, "resta_decimales", 5, 2, 6, 8),
  ],
  4: [
    B(productoCociente.porPotenciaDeDiez, "por_potencia_de_diez", 6, 1, 6, 8),
    B(productoCociente.multiplicaDecimales, "multiplica_decimales", 6, 2, 5, 7),
    B(productoCociente.divideDecimales, "divide_decimales", 6, 2, 5, 7),
    B(productoCociente.efectoDeOperar, "efecto_de_operar", 7, 2, 6, 8),
  ],
  5: [
    B(problemas.problemasCompras, "problemas_decimales_compras", 8, 2, 3, 4),
    B(problemas.problemasRepartos, "problemas_decimales_repartos", 8, 3, 3, 4),
  ],
};

const CONCEPTOS = {
  1: "Valor posicional de los decimales",
  2: "Fracciones y decimales",
  3: "Comparar y ordenar decimales",
  4: "Aproximar y redondear",
  5: "Sumar y restar decimales",
  6: "Multiplicar y dividir decimales",
  7: "El efecto de multiplicar y dividir",
  8: "Problemas con decimales",
};

const SABERES = { 1: "A.2", 2: "A.2", 3: "A.4", 4: "A.2", 5: "A.3", 6: "A.3", 7: "A.3", 8: "A.3" };

export const DECIMALES_1ESO = {
  id: "c0000000-0000-4000-8000-000000000007",
  curso: "1.º ESO",
  materia: "Matemáticas",
  nombre: "Números decimales",
  titulos: TITULO_DE_OBJETIVO,
  baterias: BATERIAS_POR_OBJETIVO,
  conceptos: CONCEPTOS,
  saberes: SABERES,
  idDeConcepto: (n) => `c1000000-0000-4000-8000-0000000007${String(n).padStart(2, "0")}`,
  modulos: [lectura, orden, sumaResta, productoCociente, problemas],
  migraciones: {
    objetivos: ["140_semilla_decimales_1eso.sql"],
    arquetipos: ["140_semilla_decimales_1eso.sql"],
    conceptos: ["140_semilla_decimales_1eso.sql"],
  },
};
