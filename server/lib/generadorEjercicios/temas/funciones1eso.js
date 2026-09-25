import * as coordenadas from "../generadores/funciones/coordenadas.js";
import * as tablas from "../generadores/funciones/tablas.js";
import * as graficas from "../generadores/funciones/graficas.js";
import * as problemas from "../generadores/funciones/problemas.js";

// EL TEMA «FUNCIONES Y GRÁFICAS» DE 1.º ESO (migración 144).
//
// Relaciones lineales en sus cuatro formas (situación, tabla, expresión y
// gráfica), que es lo que nombra D.5. Los ejes y las gráficas los dibuja la
// hoja (assets/shared/hoja/js/figuras/ejes.js), con cuadrícula de 5 mm.

const TITULO_DE_OBJETIVO = {
  1: "Situar y leer puntos en unos ejes",
  2: "Pasar de la expresión a la tabla y de la tabla a la expresión",
  3: "Leer gráficas",
  4: "Modelizar situaciones con relaciones lineales",
};

const B = (generador, clave, concepto, dificultad, minimo, maximo) => ({ generador, clave, concepto, dificultad, minimo, maximo });

const BATERIAS_POR_OBJETIVO = {
  1: [
    B(coordenadas.cuadrante, "cuadrante", 1, 1, 6, 8),
    B(coordenadas.leeCoordenadas, "lee_coordenadas", 1, 1, 2, 3),
  ],
  2: [
    B(tablas.completaTablaFuncion, "completa_tabla_funcion", 2, 1, 2, 3),
    B(tablas.tablaAExpresion, "tabla_a_expresion", 3, 2, 2, 3),
  ],
  3: [
    B(graficas.graficaAExpresion, "grafica_a_expresion", 4, 2, 2, 3),
    B(graficas.leeGrafica, "lee_grafica", 4, 2, 2, 2),
  ],
  4: [
    B(problemas.problemasFuncionLineal, "problemas_funcion_lineal", 5, 3, 2, 3),
    B(problemas.comparaTarifas, "compara_tarifas", 5, 3, 2, 3),
  ],
};

const CONCEPTOS = {
  1: "Coordenadas cartesianas",
  2: "Tabla de valores",
  3: "Expresión de una relación lineal",
  4: "Lectura de gráficas",
  5: "Relaciones lineales en la vida cotidiana",
};

const SABERES = { 1: "D.5", 2: "D.5", 3: "D.5", 4: "D.5", 5: "D.5" };

export const FUNCIONES_1ESO = {
  id: "c0000000-0000-4000-8000-000000000011",
  curso: "1.º ESO",
  materia: "Matemáticas",
  nombre: "Funciones y gráficas",
  titulos: TITULO_DE_OBJETIVO,
  baterias: BATERIAS_POR_OBJETIVO,
  conceptos: CONCEPTOS,
  saberes: SABERES,
  idDeConcepto: (n) => `c1000000-0000-4000-8000-0000000011${String(n).padStart(2, "0")}`,
  modulos: [coordenadas, tablas, graficas, problemas],
  migraciones: {
    objetivos: ["144_semilla_funciones_1eso.sql"],
    arquetipos: ["144_semilla_funciones_1eso.sql"],
    conceptos: ["144_semilla_funciones_1eso.sql"],
  },
};
