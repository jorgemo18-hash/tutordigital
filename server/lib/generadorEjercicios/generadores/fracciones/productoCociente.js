import { reuneApartados } from "../../ejercicio.js";
import { frac, producto, cociente, latex, texto, latexTalCual, textoTalCual, esIrreducible } from "./fraccion.js";
import { fraccionPropia } from "./eleccion.js";

// FRACCIONES, OBJETIVO 5: MULTIPLICAR Y DIVIDIR (concepto 6).
//
// LOS ERRORES QUE TIENEN QUE PODER PROVOCAR:
//   5 multiplicar EN CRUZ, como si fuera una división;
//   6 dividir multiplicando en línea, sin invertir la segunda;
//   7 invertir la PRIMERA en vez de la segunda.
// Con 1/2 y 1/3 los tres dan números distintos del bueno; con fracciones
// iguales o inversas no, y esas parejas se descartan.

function pareja(azar) {
  const a = fraccionPropia(azar);
  const b = fraccionPropia(azar);
  if (!a || !b) return null;
  if (a.n === b.n && a.d === b.d) return null;
  if (a.n === b.d && a.d === b.n) return null;
  return [a, b];
}

function simplificado(bruto, r) {
  return esIrreducible(bruto) && bruto.d !== 1 ? textoTalCual(bruto) : `${textoTalCual(bruto)} = ${texto(r)}`;
}

// ── "Multiplica" (dificultad 1) ──────────────────────────────────────────
export function multiplicaFracciones(azar, { cuantos = 6 } = {}) {
  const { apartados } = reuneApartados(() => {
    const p = pareja(azar);
    if (!p) return null;
    const [a, b] = p;
    const r = producto(a, b);
    const bruto = frac(a.n * b.n, a.d * b.d);
    return {
      latex: `$${latexTalCual(a)} \\cdot ${latexTalCual(b)} =$ ___`,
      latexResuelto: `$${latexTalCual(a)} \\cdot ${latexTalCual(b)} = ${latex(r)}$`,
      texto: `${textoTalCual(a)} · ${textoTalCual(b)} = ___`,
      solucion: texto(r),
      a, b,
      razon: `Numerador por numerador y denominador por denominador: ${a.n} · ${b.n} y ${a.d} · ${b.d}, ${simplificado(bruto, r)}.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "multiplica_fracciones",
    arquetipo: "Multiplica fracciones",
    enunciado: "Calcula y simplifica:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// ── "Divide" (dificultad 1) ──────────────────────────────────────────────
export function divideFracciones(azar, { cuantos = 6 } = {}) {
  const { apartados } = reuneApartados(() => {
    const p = pareja(azar);
    if (!p) return null;
    const [a, b] = p;
    const r = cociente(a, b);
    const bruto = frac(a.n * b.d, a.d * b.n);
    return {
      latex: `$${latexTalCual(a)} : ${latexTalCual(b)} =$ ___`,
      latexResuelto: `$${latexTalCual(a)} : ${latexTalCual(b)} = ${latexTalCual(a)} \\cdot ${latexTalCual(frac(b.d, b.n))} = ${latex(r)}$`,
      texto: `${textoTalCual(a)} : ${textoTalCual(b)} = ___`,
      solucion: texto(r),
      a, b,
      razon: `Dividir es multiplicar por la inversa de la SEGUNDA: ${textoTalCual(a)} · ${b.d}/${b.n} = ${simplificado(bruto, r)}.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "divide_fracciones",
    arquetipo: "Divide fracciones",
    enunciado: "Calcula y simplifica:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// ── "La fracción de una fracción" (dificultad 2) ────────────────────────
// De 4 a 6: "2/3 de 9/10". Es un producto, dicho con palabras: donde se ve
// si "de" se entiende como "por".
export function fraccionDeFraccion(azar, { cuantos = 4 } = {}) {
  const { apartados } = reuneApartados(() => {
    const p = pareja(azar);
    if (!p) return null;
    const [a, b] = p;
    const r = producto(a, b);
    const bruto = frac(a.n * b.n, a.d * b.d);
    return {
      latex: `$${latexTalCual(a)}$ de $${latexTalCual(b)} =$ ___`,
      latexResuelto: `$${latexTalCual(a)}$ de $${latexTalCual(b)} = ${latex(r)}$`,
      texto: `${textoTalCual(a)} de ${textoTalCual(b)} = ___`,
      solucion: texto(r),
      a, b,
      razon: `"De" es "por": ${textoTalCual(a)} · ${textoTalCual(b)} = ${simplificado(bruto, r)}.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "fraccion_de_fraccion",
    arquetipo: "Calcula la fracción de una fracción",
    enunciado: "Calcula y simplifica:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 2,
    apartados,
  };
}
