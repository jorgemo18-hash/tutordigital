import * as angulos from "../generadores/geometria/angulos.js";
import * as clasificacion from "../generadores/geometria/clasificacion.js";
import * as areas from "../generadores/geometria/areas.js";
import * as circulo from "../generadores/geometria/circulo.js";
import * as compuestas from "../generadores/geometria/compuestas.js";

// EL TEMA «GEOMETRÍA PLANA» DE 1.º ESO (migración 143).
//
// El primer tema con figuras: la figura es un DATO del apartado y la dibuja
// la hoja (assets/shared/hoja/js/figuras/). Los ángulos que se miden van a
// escala real. Lo que se queda fuera, y por qué, está en la cabecera de la
// migración.
//
// LAS BATERÍAS CON FIGURA VAN DE 2 A 3 APARTADOS: en tres columnas caben en
// una fila después del ejemplo (que ocupa la suya entera), y así entran dos
// actividades en un folio. Con 3 a 4, cada actividad medía 115 mm y la hoja
// "normal" salía con un solo ejercicio.

const TITULO_DE_OBJETIVO = {
  1: "Medir y clasificar ángulos",
  2: "Relacionar ángulos",
  3: "Clasificar triángulos y cuadriláteros",
  4: "Calcular perímetros y áreas de polígonos",
  5: "Calcular la longitud de la circunferencia y el área del círculo",
  6: "Resolver problemas de áreas",
};

const B = (generador, clave, concepto, dificultad, minimo, maximo) => ({ generador, clave, concepto, dificultad, minimo, maximo });

const BATERIAS_POR_OBJETIVO = {
  1: [
    B(angulos.clasificaAngulo, "clasifica_angulo", 1, 1, 2, 3),
    B(angulos.mideAngulo, "mide_angulo", 1, 1, 2, 3),
  ],
  2: [
    B(angulos.complementarioSuplementario, "complementario_suplementario", 2, 1, 6, 8),
    B(angulos.anguloDelTriangulo, "angulo_del_triangulo", 2, 2, 2, 3),
  ],
  3: [
    B(clasificacion.clasificaTriangulo, "clasifica_triangulo", 3, 2, 2, 3),
    B(clasificacion.identificaCuadrilatero, "identifica_cuadrilatero", 3, 2, 4, 5),
  ],
  4: [
    B(areas.perimetroYArea, "perimetro_y_area", 4, 1, 2, 3),
    B(areas.areaTriangulo, "area_triangulo", 5, 2, 2, 3),
    B(areas.areaCuadrilateros, "area_cuadrilateros", 5, 2, 2, 3),
  ],
  5: [
    B(circulo.longitudCircunferencia, "longitud_circunferencia", 6, 2, 2, 3),
    B(circulo.areaCirculo, "area_circulo", 6, 2, 2, 3),
  ],
  6: [
    B(compuestas.figuraCompuesta, "figura_compuesta", 7, 3, 2, 3),
    B(compuestas.problemasDeAreas, "problemas_de_areas", 7, 3, 3, 4),
  ],
};

const CONCEPTOS = {
  1: "Ángulos y su medida",
  2: "Relaciones entre ángulos",
  3: "Clasificación de triángulos y cuadriláteros",
  4: "Perímetro y área",
  5: "Áreas de polígonos",
  6: "Circunferencia y círculo",
  7: "Figuras compuestas y problemas",
};

const SABERES = { 1: "B.2", 2: "B.2", 3: "C.1", 4: "B.2", 5: "B.2", 6: "B.2", 7: "C.4" };

export const GEOMETRIA_1ESO = {
  id: "c0000000-0000-4000-8000-000000000010",
  curso: "1.º ESO",
  materia: "Matemáticas",
  nombre: "Geometría plana",
  titulos: TITULO_DE_OBJETIVO,
  baterias: BATERIAS_POR_OBJETIVO,
  conceptos: CONCEPTOS,
  saberes: SABERES,
  idDeConcepto: (n) => `c1000000-0000-4000-8000-0000000010${String(n).padStart(2, "0")}`,
  modulos: [angulos, clasificacion, areas, circulo, compuestas],
  migraciones: {
    objetivos: ["143_semilla_geometria_1eso.sql"],
    arquetipos: ["143_semilla_geometria_1eso.sql"],
    conceptos: ["143_semilla_geometria_1eso.sql"],
  },
};
