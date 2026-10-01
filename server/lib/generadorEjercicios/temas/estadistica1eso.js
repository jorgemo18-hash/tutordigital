import * as datos from "../generadores/estadistica/datos.js";
import * as graficos from "../generadores/estadistica/graficos.js";
import * as medidas from "../generadores/estadistica/medidas.js";
import * as probabilidad from "../generadores/estadistica/probabilidad.js";

// EL TEMA «ESTADÍSTICA Y PROBABILIDAD» DE 1.º ESO (migración 150).
//
// Una sola variable (E.1): tipos, tablas de frecuencias, barras y sectores,
// media, mediana, moda y rango. Azar (E.2): aleatorio o determinista, regla
// de Laplace y frecuencia relativa. Las barras las dibuja la hoja
// (assets/shared/hoja/js/figuras/graficos.js).

const TITULO_DE_OBJETIVO = {
  1: "Organizar datos en tablas de frecuencias",
  2: "Leer e interpretar gráficos estadísticos",
  3: "Calcular e interpretar media, mediana, moda y rango",
  4: "Calcular probabilidades",
};

const B = (generador, clave, concepto, dificultad, minimo, maximo) => ({ generador, clave, concepto, dificultad, minimo, maximo });

const BATERIAS_POR_OBJETIVO = {
  1: [
    B(datos.tipoDeVariable, "tipo_de_variable", 1, 1, 6, 8),
    B(datos.tablaDeFrecuencias, "tabla_de_frecuencias", 2, 2, 2, 2),
  ],
  2: [
    B(graficos.leeDiagramaBarras, "lee_diagrama_barras", 3, 1, 2, 2),
    B(graficos.angulosDeSectores, "angulos_de_sectores", 3, 2, 2, 3),
  ],
  3: [
    B(medidas.mediaMedianaModa, "media_mediana_moda", 4, 1, 2, 3),
    B(medidas.mediaDeTabla, "media_de_tabla", 4, 2, 2, 3),
    B(medidas.comparaConjuntos, "compara_conjuntos", 5, 3, 2, 2),
  ],
  4: [
    B(probabilidad.aleatorioODeterminista, "aleatorio_o_determinista", 6, 1, 4, 6),
    B(probabilidad.probabilidadLaplace, "probabilidad_laplace", 7, 2, 3, 4),
    B(probabilidad.frecuenciaRelativa, "frecuencia_relativa", 8, 3, 2, 2),
  ],
};

const CONCEPTOS = {
  1: "Variable estadística y sus tipos",
  2: "Tabla de frecuencias",
  3: "Gráficos estadísticos",
  4: "Media, mediana y moda",
  5: "Rango y comparación de datos",
  6: "Experimentos aleatorios y deterministas",
  7: "Regla de Laplace",
  8: "Frecuencia relativa y probabilidad",
};

const SABERES = { 1: "E.1", 2: "E.1", 3: "E.1", 4: "E.1", 5: "E.1", 6: "E.2", 7: "E.2", 8: "E.2" };

export const ESTADISTICA_1ESO = {
  id: "c0000000-0000-4000-8000-000000000012",
  curso: "1.º ESO",
  materia: "Matemáticas",
  nombre: "Estadística y probabilidad",
  titulos: TITULO_DE_OBJETIVO,
  baterias: BATERIAS_POR_OBJETIVO,
  conceptos: CONCEPTOS,
  saberes: SABERES,
  idDeConcepto: (n) => `c1000000-0000-4000-8000-0000000012${String(n).padStart(2, "0")}`,
  modulos: [datos, graficos, medidas, probabilidad],
  migraciones: {
    objetivos: ["150_semilla_estadistica_1eso.sql"],
    arquetipos: ["150_semilla_estadistica_1eso.sql"],
    conceptos: ["150_semilla_estadistica_1eso.sql"],
  },
};
