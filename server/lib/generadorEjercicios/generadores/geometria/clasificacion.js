import { reuneApartados } from "../../ejercicio.js";
import { figuraDeTrianguloPorAngulos, poligonoConCotas } from "./figuras.js";

// GEOMETRÍA, OBJETIVO 3: CLASIFICAR TRIÁNGULOS Y CUADRILÁTEROS (concepto 3).
// Saber C.1: «Figuras geométricas planas…: descripción y clasificación en
// función de sus propiedades o características».
//
// La figura lleva los datos (ángulos o lados) y la clasificación sale de
// ellos, no del dibujo: un triángulo "que parece rectángulo" con 88° no es
// rectángulo.

// ── "Clasifica el triángulo" (dificultad 2) ─────────────────────────────
// De 4 a 6: la mitad por sus ángulos (con los tres marcados) y la mitad
// por sus lados (con los tres medidos).
const POR_ANGULOS = [
  { a: 60, b: 60, tipo: "acutángulo" },
  { a: 50, b: 70, tipo: "acutángulo" },
  { a: 55, b: 65, tipo: "acutángulo" },
  { a: 90, b: 35, tipo: "rectángulo" },
  { a: 40, b: 50, tipo: "rectángulo" },
  { a: 30, b: 60, tipo: "rectángulo" },
  { a: 25, b: 35, tipo: "obtusángulo" },
  { a: 30, b: 40, tipo: "obtusángulo" },
  { a: 110, b: 35, tipo: "obtusángulo" },
];

// Triángulos por sus lados (en cm), que existen (desigualdad triangular).
const POR_LADOS = [
  { lados: [5, 5, 5], tipo: "equilátero" },
  { lados: [6, 6, 6], tipo: "equilátero" },
  { lados: [6, 6, 4], tipo: "isósceles" },
  { lados: [5, 5, 8], tipo: "isósceles" },
  { lados: [7, 7, 3], tipo: "isósceles" },
  { lados: [4, 5, 6], tipo: "escaleno" },
  { lados: [3, 4, 5], tipo: "escaleno" },
  { lados: [5, 7, 9], tipo: "escaleno" },
];

// Los vértices de un triángulo de lados dados: base AB = c, y C donde se
// cortan las circunferencias de radios b (desde A) y a (desde B).
function trianguloPorLados([a, b, c]) {
  const x = (b * b - a * a + c * c) / (2 * c);
  const y = Math.sqrt(Math.max(0, b * b - x * x));
  return [[0, 0], [c, 0], [x, y]];
}

export function clasificaTriangulo(azar, { cuantos = 4 } = {}) {
  const angulos = azar.mezcla(POR_ANGULOS);
  const lados = azar.mezcla(POR_LADOS);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const porAngulos = i % 2 === 0;
    const k = Math.floor(i / 2);
    i += 1;
    if (porAngulos) {
      const t = angulos[k % angulos.length];
      const c = 180 - t.a - t.b;
      const rotulos = [t.a, t.b, c].map((g) => `${g}°`);
      return {
        latex: "Según sus ángulos: ___",
        latexResuelto: `Según sus ángulos: ${t.tipo}`,
        texto: `Ángulos ${t.a}°, ${t.b}°, ${c}° → ___`,
        solucion: t.tipo,
        figura: figuraDeTrianguloPorAngulos(t.a, t.b, rotulos),
        razon: t.tipo === "rectángulo" ? "Tiene un ángulo de 90°: rectángulo."
          : t.tipo === "obtusángulo" ? `Tiene un ángulo de más de 90° (${Math.max(t.a, t.b, c)}°): obtusángulo.`
            : "Los tres ángulos miden menos de 90°: acutángulo.",
      };
    }
    const t = lados[k % lados.length];
    const orden = azar.mezcla([0, 1, 2]);
    const l = orden.map((j) => t.lados[j]);
    const v = trianguloPorLados(l);
    return {
      latex: "Según sus lados: ___",
      latexResuelto: `Según sus lados: ${t.tipo}`,
      texto: `Lados ${l.join(", ")} cm → ___`,
      solucion: t.tipo,
      figura: poligonoConCotas(v, [[0, `${l[2]} cm`], [1, `${l[0]} cm`], [2, `${l[1]} cm`]]),
      razon: t.tipo === "equilátero" ? "Los tres lados miden lo mismo: equilátero."
        : t.tipo === "isósceles" ? "Dos lados miden lo mismo y el otro no: isósceles." : "Los tres lados son distintos: escaleno.",
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "clasifica_triangulo",
    arquetipo: "Clasifica el triángulo por sus lados o por sus ángulos",
    enunciado: "Clasifica cada triángulo:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 3,
    apartados,
  };
}

// Los cuadriláteros por sus propiedades, escritas como las diría un libro.
const CUADRILATEROS = [
  { nombre: "cuadrado", frase: "Cuatro lados iguales y cuatro ángulos rectos" },
  { nombre: "rectángulo", frase: "Lados opuestos iguales, cuatro ángulos rectos y lados contiguos distintos" },
  { nombre: "rombo", frase: "Cuatro lados iguales y ningún ángulo recto" },
  { nombre: "romboide", frase: "Lados opuestos paralelos e iguales, lados contiguos distintos y ningún ángulo recto" },
  { nombre: "trapecio", frase: "Solo dos lados paralelos" },
  { nombre: "trapezoide", frase: "Ningún lado paralelo a otro" },
];

// ── "¿Qué cuadrilátero es?" (dificultad 2) ──────────────────────────────
export function identificaCuadrilatero(azar, { cuantos = 4 } = {}) {
  const plan = azar.mezcla(CUADRILATEROS);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const c = plan[i];
    i += 1;
    if (!c) return null;
    return {
      latex: `${c.frase}: ___`,
      latexResuelto: `${c.frase}: ${c.nombre}`,
      texto: `${c.frase}: ___`,
      solucion: c.nombre,
      razon: {
        cuadrado: "Lados iguales y ángulos rectos a la vez: cuadrado.",
        rectángulo: "Ángulos rectos pero lados contiguos distintos: rectángulo.",
        rombo: "Lados iguales pero sin ángulos rectos: rombo.",
        romboide: "Paralelogramo sin lados iguales contiguos ni ángulos rectos: romboide.",
        trapecio: "Solo un par de lados paralelos: trapecio.",
        trapezoide: "Sin lados paralelos: trapezoide.",
      }[c.nombre],
    };
  }, { cuantos, clave: (a) => a.solucion });

  return {
    clave: "identifica_cuadrilatero",
    arquetipo: "Nombra el cuadrilátero a partir de sus propiedades",
    enunciado: "¿Qué cuadrilátero es? (cuadrado, rectángulo, rombo, romboide, trapecio o trapezoide)",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}
