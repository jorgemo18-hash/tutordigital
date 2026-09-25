import * as estimacion from "../generadores/medida/estimacion.js";
import * as cambios from "../generadores/medida/cambios.js";
import * as complejas from "../generadores/medida/complejas.js";
import * as problemas from "../generadores/medida/problemas.js";

// EL TEMA «SISTEMA MÉTRICO DECIMAL» DE 1.º ESO (migración 142).
//
// Longitud, masa, capacidad y superficie; la aritmética de los decimales
// (generadores/decimales/decimal.js), exacta. Los ángulos y las áreas de
// figuras (B.2) son de geometría, no de este tema.

const TITULO_DE_OBJETIVO = {
  1: "Elegir unidades y estimar medidas",
  2: "Cambiar de unidad de longitud, masa y capacidad",
  3: "Pasar de forma compleja a incompleja y sumar medidas",
  4: "Trabajar con unidades de superficie",
  5: "Resolver problemas de medida",
};

const B = (generador, clave, concepto, dificultad, minimo, maximo) => ({ generador, clave, concepto, dificultad, minimo, maximo });

const BATERIAS_POR_OBJETIVO = {
  1: [
    B(estimacion.unidadAdecuada, "unidad_adecuada", 1, 1, 6, 8),
    B(estimacion.estimaMedida, "estima_medida", 5, 1, 4, 6),
  ],
  2: [
    B(cambios.cambioDeUnidad, "cambio_de_unidad", 2, 1, 6, 8),
    B(cambios.comparaMedidas, "compara_medidas", 2, 2, 5, 7),
  ],
  3: [
    B(complejas.aFormaIncompleja, "a_forma_incompleja", 3, 2, 4, 6),
    B(complejas.sumaDeMedidas, "suma_de_medidas", 3, 2, 4, 6),
  ],
  4: [
    B(cambios.cambioDeSuperficie, "cambio_de_superficie", 4, 2, 5, 7),
    B(cambios.medidasAgrarias, "medidas_agrarias", 4, 3, 3, 4),
  ],
  5: [
    B(problemas.problemasDeMedida, "problemas_de_medida", 6, 2, 3, 4),
    B(problemas.problemasDosPasos, "problemas_medida_dos_pasos", 6, 3, 3, 4),
  ],
};

const CONCEPTOS = {
  1: "Magnitudes y unidades",
  2: "Cambios de unidad",
  3: "Forma compleja e incompleja",
  4: "Unidades de superficie",
  5: "Estimación de medidas",
  6: "Problemas de medida",
};

const SABERES = { 1: "B.1", 2: "B.1", 3: "B.1", 4: "B.1", 5: "B.3", 6: "B.1" };

export const MEDIDA_1ESO = {
  id: "c0000000-0000-4000-8000-000000000009",
  curso: "1.º ESO",
  materia: "Matemáticas",
  nombre: "Sistema métrico decimal",
  titulos: TITULO_DE_OBJETIVO,
  baterias: BATERIAS_POR_OBJETIVO,
  conceptos: CONCEPTOS,
  saberes: SABERES,
  idDeConcepto: (n) => `c1000000-0000-4000-8000-0000000009${String(n).padStart(2, "0")}`,
  modulos: [estimacion, cambios, complejas, problemas],
  migraciones: {
    objetivos: ["142_semilla_medida_1eso.sql"],
    arquetipos: ["142_semilla_medida_1eso.sql"],
    conceptos: ["142_semilla_medida_1eso.sql"],
  },
};
