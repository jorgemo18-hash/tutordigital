import * as razones from "../generadores/proporcionalidad/razones.js";
import * as tablas from "../generadores/proporcionalidad/tablas.js";
import * as problemas from "../generadores/proporcionalidad/problemas.js";
import * as porcentajes from "../generadores/proporcionalidad/porcentajes.js";
import * as variaciones from "../generadores/proporcionalidad/variaciones.js";
import * as consumo from "../generadores/proporcionalidad/consumo.js";

// EL TEMA «PROPORCIONALIDAD Y PORCENTAJES» DE 1.º ESO (migración 139).
//
// Números que se calculan sin calculadora; el dinero, en céntimos por
// dentro (generadores/proporcionalidad/numeros.js). Lo que se queda fuera,
// y por qué, está en la cabecera de la migración.

const TITULO_DE_OBJETIVO = {
  1: "Trabajar con razones y proporciones",
  2: "Resolver problemas de proporcionalidad directa",
  3: "Calcular porcentajes",
  4: "Calcular aumentos y disminuciones porcentuales",
  5: "Tomar decisiones de consumo con cálculos",
};

const B = (generador, clave, concepto, dificultad, minimo, maximo) => ({ generador, clave, concepto, dificultad, minimo, maximo });

const BATERIAS_POR_OBJETIVO = {
  1: [
    B(razones.razonSimplificada, "razon_simplificada", 1, 1, 4, 6),
    B(razones.esProporcion, "es_proporcion", 2, 1, 6, 8),
    B(razones.terminoDeProporcion, "termino_de_proporcion", 2, 2, 5, 7),
  ],
  2: [
    B(tablas.sonProporcionales, "son_proporcionales", 3, 1, 3, 4),
    B(tablas.completaTabla, "completa_tabla_proporcional", 3, 2, 3, 4),
    B(problemas.problemasReduccionUnidad, "problemas_reduccion_unidad", 4, 2, 3, 4),
    B(problemas.problemasDeProporcionalidad, "problemas_proporcionalidad_contextos", 4, 3, 3, 4),
  ],
  3: [
    B(porcentajes.porcentajeFraccionDecimal, "porcentaje_fraccion_decimal", 5, 1, 5, 7),
    B(porcentajes.porcentajeDeCantidad, "porcentaje_de_cantidad", 6, 1, 6, 8),
    B(porcentajes.quePorcentajeEs, "que_porcentaje_es", 6, 2, 4, 6),
    B(porcentajes.totalDesdePorcentaje, "total_desde_porcentaje", 6, 3, 3, 4),
  ],
  4: [
    B(variaciones.rebajaPrecioFinal, "rebaja_precio_final", 7, 2, 4, 5),
    B(variaciones.subidaEImpuestos, "subida_e_impuestos", 7, 2, 3, 4),
    B(variaciones.precioAntes, "precio_antes", 7, 3, 3, 4),
  ],
  5: [
    B(consumo.mejorOferta, "mejor_oferta", 8, 2, 3, 4),
    B(consumo.promociones, "promociones", 8, 2, 3, 4),
  ],
};

const CONCEPTOS = {
  1: "Razones",
  2: "Proporciones",
  3: "Magnitudes directamente proporcionales",
  4: "Problemas de proporcionalidad directa",
  5: "Qué es un porcentaje",
  6: "Cálculos con porcentajes",
  7: "Aumentos y disminuciones porcentuales",
  8: "Consumo responsable",
};

const SABERES = { 1: "A.5", 2: "A.5", 3: "A.5", 4: "A.5", 5: "A.5", 6: "A.5", 7: "A.5", 8: "A.6" };

export const PROPORCIONALIDAD_1ESO = {
  id: "c0000000-0000-4000-8000-000000000006",
  curso: "1.º ESO",
  materia: "Matemáticas",
  nombre: "Proporcionalidad y porcentajes",
  titulos: TITULO_DE_OBJETIVO,
  baterias: BATERIAS_POR_OBJETIVO,
  conceptos: CONCEPTOS,
  saberes: SABERES,
  idDeConcepto: (n) => `c1000000-0000-4000-8000-0000000006${String(n).padStart(2, "0")}`,
  modulos: [razones, tablas, problemas, porcentajes, variaciones, consumo],
  migraciones: {
    objetivos: ["139_semilla_proporcionalidad_1eso.sql"],
    arquetipos: ["139_semilla_proporcionalidad_1eso.sql"],
    conceptos: ["139_semilla_proporcionalidad_1eso.sql"],
  },
};
