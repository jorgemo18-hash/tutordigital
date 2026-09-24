import * as cantidad from "../generadores/fracciones/cantidad.js";
import * as equivalencia from "../generadores/fracciones/equivalencia.js";
import * as comparar from "../generadores/fracciones/comparar.js";
import * as sumaResta from "../generadores/fracciones/sumaResta.js";
import * as productoCociente from "../generadores/fracciones/productoCociente.js";
import * as combinadas from "../generadores/fracciones/combinadas.js";
import * as problemas from "../generadores/fracciones/problemas.js";

// EL TEMA «FRACCIONES» DE 1.º ESO (migración 137).
//
// La aritmética es exacta (generadores/fracciones/fraccion.js: numerador y
// denominador enteros, nunca decimales) y las respuestas van simplificadas.
// Lo que se queda fuera, y por qué, está en la cabecera de la migración:
// las fracciones dibujadas y en la recta, y las negativas.

const TITULO_DE_OBJETIVO = {
  1: "Calcular la fracción de una cantidad",
  2: "Reconocer fracciones equivalentes y simplificar",
  3: "Comparar y ordenar fracciones",
  4: "Sumar y restar fracciones",
  5: "Multiplicar y dividir fracciones",
  6: "Resolver operaciones combinadas con fracciones",
  7: "Resolver problemas con fracciones",
};

const B = (generador, clave, concepto, dificultad, minimo, maximo) => ({ generador, clave, concepto, dificultad, minimo, maximo });

const BATERIAS_POR_OBJETIVO = {
  1: [
    B(cantidad.fraccionDeCantidad, "fraccion_de_cantidad", 1, 1, 6, 8),
    B(cantidad.cantidadDesdeFraccion, "cantidad_desde_fraccion", 1, 2, 3, 5),
  ],
  2: [
    B(equivalencia.equivalenteQueFalta, "equivalente_que_falta", 2, 1, 5, 7),
    B(equivalencia.sonEquivalentes, "son_equivalentes", 2, 1, 6, 8),
    B(equivalencia.simplificaFraccion, "simplifica_fraccion", 3, 2, 4, 6),
  ],
  3: [
    B(comparar.comparaFracciones, "compara_fracciones", 4, 1, 6, 8),
    B(comparar.ordenaFracciones, "ordena_fracciones", 4, 2, 2, 3),
  ],
  4: [
    B(sumaResta.sumaMismoDenominador, "suma_mismo_denominador", 5, 1, 6, 8),
    B(sumaResta.sumaDistintoDenominador, "suma_distinto_denominador", 5, 2, 5, 7),
    B(sumaResta.enteroYFraccion, "entero_y_fraccion", 5, 2, 4, 6),
  ],
  5: [
    B(productoCociente.multiplicaFracciones, "multiplica_fracciones", 6, 1, 6, 8),
    B(productoCociente.divideFracciones, "divide_fracciones", 6, 1, 6, 8),
    B(productoCociente.fraccionDeFraccion, "fraccion_de_fraccion", 6, 2, 4, 6),
  ],
  6: [
    B(combinadas.combinadaFracciones, "combinada_fracciones", 7, 2, 3, 4),
    B(combinadas.combinadaConParentesis, "combinada_fracciones_parentesis", 7, 3, 2, 3),
  ],
  7: [
    B(problemas.problemasFraccionDeCantidad, "problemas_fraccion_cantidad", 8, 2, 2, 3),
    B(problemas.problemasLoQueQueda, "problemas_lo_que_queda", 8, 3, 2, 3),
  ],
};

const CONCEPTOS = {
  1: "Fracción de una cantidad",
  2: "Fracciones equivalentes",
  3: "Simplificación y fracción irreducible",
  4: "Comparación y ordenación de fracciones",
  5: "Suma y resta de fracciones",
  6: "Producto y cociente de fracciones",
  7: "Operaciones combinadas con fracciones",
  8: "Problemas con fracciones",
};

const SABERES = { 1: "A.3", 2: "A.2", 3: "A.2", 4: "A.4", 5: "A.3", 6: "A.3", 7: "A.3", 8: "A.3" };

export const FRACCIONES_1ESO = {
  id: "c0000000-0000-4000-8000-000000000004",
  curso: "1.º ESO",
  materia: "Matemáticas",
  nombre: "Fracciones",
  titulos: TITULO_DE_OBJETIVO,
  baterias: BATERIAS_POR_OBJETIVO,
  conceptos: CONCEPTOS,
  saberes: SABERES,
  idDeConcepto: (n) => `c1000000-0000-4000-8000-0000000004${String(n).padStart(2, "0")}`,
  modulos: [cantidad, equivalencia, comparar, sumaResta, productoCociente, combinadas, problemas],
  migraciones: {
    objetivos: ["137_semilla_fracciones_1eso.sql"],
    arquetipos: ["137_semilla_fracciones_1eso.sql"],
    conceptos: ["137_semilla_fracciones_1eso.sql"],
  },
};
