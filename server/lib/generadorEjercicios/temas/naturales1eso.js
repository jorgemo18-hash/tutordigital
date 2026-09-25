import * as numeracion from "../generadores/naturales/numeracion.js";
import * as division from "../generadores/naturales/division.js";
import * as propiedades from "../generadores/naturales/propiedades.js";
import * as recuento from "../generadores/naturales/recuento.js";
import * as problemas from "../generadores/naturales/problemas.js";

// EL TEMA «NÚMEROS NATURALES» DE 1.º ESO (migración 141).
//
// Las operaciones combinadas y la jerarquía NO están aquí: ya las genera el
// tema de enteros, con naturales incluidos. Lo que sí está es lo que el
// currículo nombra de este tema y ningún otro cubre: el recuento
// sistemático (A.1), la estimación y el cálculo mental.

const TITULO_DE_OBJETIVO = {
  1: "Usar el sistema de numeración, redondear y estimar",
  2: "Dividir y usar la prueba de la división",
  3: "Calcular de forma eficiente con las propiedades",
  4: "Contar de forma sistemática",
  5: "Resolver problemas con números naturales",
};

const B = (generador, clave, concepto, dificultad, minimo, maximo) => ({ generador, clave, concepto, dificultad, minimo, maximo });

const BATERIAS_POR_OBJETIVO = {
  1: [
    B(numeracion.valorDeLaCifra, "valor_de_la_cifra", 1, 1, 6, 8),
    B(numeracion.redondeaNatural, "redondea_natural", 2, 1, 6, 8),
    B(numeracion.estimaOperacion, "estima_operacion", 2, 2, 4, 6),
  ],
  2: [
    B(division.divisionYPrueba, "division_y_prueba", 3, 1, 4, 6),
    B(division.terminoDeLaDivision, "termino_de_la_division", 3, 2, 4, 6),
  ],
  3: [
    B(propiedades.calculoMental, "calculo_mental_trucos", 4, 1, 6, 8),
    B(propiedades.distributiva, "distributiva_naturales", 4, 1, 5, 7),
    B(propiedades.factorComun, "factor_comun_naturales", 4, 2, 4, 6),
  ],
  4: [
    B(recuento.recuentoMultiplicativo, "recuento_multiplicativo", 5, 2, 3, 4),
    B(recuento.recuentoSinOrden, "recuento_sin_orden", 5, 3, 3, 4),
  ],
  5: [
    B(problemas.problemasNaturales, "problemas_naturales", 6, 2, 3, 4),
    B(problemas.problemasDeResto, "problemas_de_resto", 6, 3, 3, 4),
  ],
};

const CONCEPTOS = {
  1: "El sistema de numeración decimal",
  2: "Redondear y estimar",
  3: "La división y su prueba",
  4: "Propiedades y cálculo mental",
  5: "Recuento sistemático",
  6: "Problemas con números naturales",
};

const SABERES = { 1: "A.1", 2: "A.2", 3: "A.3", 4: "A.3", 5: "A.1", 6: "A.3" };

export const NATURALES_1ESO = {
  id: "c0000000-0000-4000-8000-000000000008",
  curso: "1.º ESO",
  materia: "Matemáticas",
  nombre: "Números naturales",
  titulos: TITULO_DE_OBJETIVO,
  baterias: BATERIAS_POR_OBJETIVO,
  conceptos: CONCEPTOS,
  saberes: SABERES,
  idDeConcepto: (n) => `c1000000-0000-4000-8000-0000000008${String(n).padStart(2, "0")}`,
  modulos: [numeracion, division, propiedades, recuento, problemas],
  migraciones: {
    objetivos: ["141_semilla_naturales_1eso.sql"],
    arquetipos: ["141_semilla_naturales_1eso.sql"],
    conceptos: ["141_semilla_naturales_1eso.sql"],
  },
};
