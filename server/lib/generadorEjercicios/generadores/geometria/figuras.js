// LAS FIGURAS DE LOS EJERCICIOS DE GEOMETRÍA, como DATO para la hoja (el
// dibujo lo hace assets/shared/hoja/js/figuras/geometria.js).
//
// No es un generador (no está en el catálogo): lo usan los de geometria/.

const rad = (g) => (g * Math.PI) / 180;

// Un ángulo de `g` grados con un lado horizontal, A ESCALA REAL (1 unidad =
// 1 mm): lo que mide el transportador es lo que dice el dato. Lados de
// 28 mm, que caben bajo el semicírculo de un transportador escolar.
// Para CLASIFICAR (no se mide) basta con 18 mm: la figura ocupa menos.
const LADO = 28;
export function figuraDeAngulo(g, lado = LADO) {
  const fin = [lado * Math.cos(rad(g)), lado * Math.sin(rad(g))];
  return {
    tipo: "geometria",
    escala: "real",
    // Siempre el alto del lado entero, abra lo que abra: así la altura de la
    // actividad no depende del ángulo que salga.
    altoMinimo: lado,
    descripcion: "Un ángulo",
    elementos: [
      { segmento: [[0, 0], [lado, 0]] },
      { segmento: [[0, 0], fin] },
      { angulo: { vertice: [0, 0], desde: [lado, 0], hasta: fin, recto: g === 90 } },
    ],
  };
}

// Un triángulo con los ángulos `a` y `b` en la base (a proporción: aquí se
// deduce, no se mide) y un rótulo en cada ángulo.
export function figuraDeTrianguloPorAngulos(a, b, rotulos) {
  const L = 10;
  const lado = (L * Math.sin(rad(b))) / Math.sin(rad(a + b));
  const C = [lado * Math.cos(rad(a)), lado * Math.sin(rad(a))];
  const [A, B] = [[0, 0], [L, 0]];
  return {
    tipo: "geometria",
    // Más alto que la caja normal: tres ángulos rotulados en 26 mm se
    // pisaban (el equilátero, sobre todo).
    alto: 36,
    descripcion: "Un triángulo con sus ángulos",
    elementos: [
      { poligono: [A, B, C] },
      // El de 90° lleva el cuadradito, como en el resto de la hoja.
      ...[[A, B, C], [B, A, C], [C, A, B]].map(([v, d, h], i) => ({ angulo: { vertice: v, desde: d, hasta: h, texto: rotulos[i], recto: rotulos[i] === "90°" } })),
    ],
  };
}

// Una cota bajo un lado horizontal (lado −1) o a la derecha de uno vertical.
export const cota = (de, a, texto, lado = -1) => ({ cota: { de, a, texto, lado } });

// Un polígono con cotas en los lados que se indiquen:
//   poligonoConCotas([[0,0],[7,0],[7,4],[0,4]], [[0, "7 cm"], [1, "4 cm"]])
// pone "7 cm" en el lado 0 (del vértice 0 al 1) y "4 cm" en el lado 1. Las
// cotas van por FUERA: el polígono se recorre en sentido antihorario y la
// cota va a su derecha.
export function poligonoConCotas(vertices, cotas, extra = []) {
  const n = vertices.length;
  return {
    tipo: "geometria",
    descripcion: "Un polígono con sus medidas",
    elementos: [
      { poligono: vertices },
      ...cotas.map(([lado, texto]) => cota(vertices[lado], vertices[(lado + 1) % n], texto, -1)),
      ...extra,
    ],
  };
}
