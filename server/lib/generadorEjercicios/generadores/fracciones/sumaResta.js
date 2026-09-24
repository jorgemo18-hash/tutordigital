import { reuneApartados } from "../../ejercicio.js";
import { frac, suma, resta, mcm, latex, texto, latexTalCual, textoTalCual, esIrreducible } from "./fraccion.js";
import { propiaConDenominador, denominadoresDistintos } from "./eleccion.js";

// FRACCIONES, OBJETIVO 4: SUMAR Y RESTAR (concepto 5).
//
// El resultado se da SIMPLIFICADO (irreducible, o entero si lo es). Siempre
// positivo: los negativos con fracciones son de 2.º.
//
// LOS ERRORES QUE TIENEN QUE PODER PROVOCAR (con su respuesta-trampa):
//   1 sumar numeradores Y denominadores (1/2 + 1/3 = 2/5);
//   2 poner el denominador común sin cambiar los numeradores
//     (1/2 + 1/3 = 2/6);
//   3 no simplificar el resultado (2/8 en vez de 1/4);
//   4 con un entero, sumarlo al numerador (2 + 3/4 = 5/4).

const OPERA = { "+": suma, "-": resta };
const PALABRA = { "+": "suman", "-": "restan" };
const MENOS = "−";
const simb = (op) => (op === "-" ? MENOS : "+");

// "3/4 = 6/8" solo de las que cambian: "7/8 = 7/8" en una explicación
// parece una errata.
function pasadas(parejas) {
  return parejas.filter(([x, y]) => x.d !== y.d).map(([x, y]) => `${textoTalCual(x)} = ${textoTalCual(y)}`).join(" y ");
}

// ── "Suma y resta con el mismo denominador" (dificultad 1) ──────────────
// De 6 a 8, y en alguno el resultado se puede simplificar: es donde se
// aprende que hay que mirarlo.
export function sumaMismoDenominador(azar, { cuantos = 6 } = {}) {
  const { apartados } = reuneApartados(() => {
    const d = azar.entero(3, 12);
    const op = azar.elige(["+", "+", "-"]);
    const a = frac(azar.entero(1, d - 1), d);
    const b = frac(azar.entero(1, d - 1), d);
    const r = OPERA[op](a, b);
    if (r.n <= 0) return null;
    const bruto = frac(op === "+" ? a.n + b.n : a.n - b.n, d);
    return {
      latex: `$${latexTalCual(a)} ${simb(op)} ${latexTalCual(b)} =$ ___`,
      latexResuelto: `$${latexTalCual(a)} ${simb(op)} ${latexTalCual(b)} = ${latex(r)}$`,
      texto: `${textoTalCual(a)} ${simb(op)} ${textoTalCual(b)} = ___`,
      solucion: texto(r),
      a, b, op, bruto,
      razon: `Mismo denominador: se ${PALABRA[op]} los numeradores y el denominador se queda, ${textoTalCual(bruto)}`
        + (esIrreducible(bruto) && bruto.d !== 1 ? "." : `, que se simplifica: ${texto(r)}.`),
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "suma_mismo_denominador",
    arquetipo: "Suma y resta fracciones con el mismo denominador",
    enunciado: "Calcula y simplifica si se puede:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// ── "Suma y resta con distinto denominador" (dificultad 2) ──────────────
// De 5 a 7, con el denominador común (m.c.m.) hasta 36.
export function sumaDistintoDenominador(azar, { cuantos = 5 } = {}) {
  const { apartados } = reuneApartados(() => {
    const ds = denominadoresDistintos(azar);
    if (!ds) return null;
    const a = propiaConDenominador(azar, ds[0]);
    const b = propiaConDenominador(azar, ds[1]);
    if (!a || !b) return null;
    const op = azar.elige(["+", "+", "-"]);
    const r = OPERA[op](a, b);
    if (r.n <= 0) return null;
    const m = mcm(a.d, b.d);
    const a2 = frac(a.n * (m / a.d), m);
    const b2 = frac(b.n * (m / b.d), m);
    const bruto = frac(op === "+" ? a2.n + b2.n : a2.n - b2.n, m);
    return {
      latex: `$${latexTalCual(a)} ${simb(op)} ${latexTalCual(b)} =$ ___`,
      latexResuelto: `$${latexTalCual(a)} ${simb(op)} ${latexTalCual(b)} = ${latexTalCual(a2)} ${simb(op)} ${latexTalCual(b2)} = ${latex(r)}$`,
      texto: `${textoTalCual(a)} ${simb(op)} ${textoTalCual(b)} = ___`,
      solucion: texto(r),
      a, b, op, bruto,
      razon: `Denominador común: m.c.m.(${a.d}, ${b.d}) = ${m}. ${pasadas([[a, a2], [b, b2]])}; `
        + `se ${PALABRA[op]} los numeradores: ${textoTalCual(bruto)}`
        + (esIrreducible(bruto) && bruto.d !== 1 ? "." : `, que se simplifica: ${texto(r)}.`),
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "suma_distinto_denominador",
    arquetipo: "Suma y resta fracciones con distinto denominador",
    enunciado: "Calcula reduciendo a común denominador, y simplifica:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 2,
    apartados,
  };
}

// ── "Un entero y una fracción" (dificultad 2) ───────────────────────────
// De 4 a 6: 2 + 3/4, 3 − 2/5, 1 − 3/8. El entero se escribe como fracción
// con el mismo denominador.
export function enteroYFraccion(azar, { cuantos = 4 } = {}) {
  const { apartados } = reuneApartados(() => {
    const d = azar.entero(2, 10);
    const f = propiaConDenominador(azar, d);
    if (!f) return null;
    const entero = azar.entero(1, 4);
    const op = azar.elige(["+", "-"]);
    const enteroFrac = frac(entero * d, d);
    const r = OPERA[op](frac(entero), f);
    const [izq, der] = azar.suerte(0.5) || op === "-" ? [String(entero), latexTalCual(f)] : [latexTalCual(f), String(entero)];
    const [izqT, derT] = izq === String(entero) ? [String(entero), textoTalCual(f)] : [textoTalCual(f), String(entero)];
    return {
      latex: `$${izq} ${simb(op)} ${der} =$ ___`,
      latexResuelto: `$${izq} ${simb(op)} ${der} = ${latex(r)}$`,
      texto: `${izqT} ${simb(op)} ${derT} = ___`,
      solucion: texto(r),
      entero, f, op,
      razon: `${entero} = ${textoTalCual(enteroFrac)}; con el mismo denominador se ${PALABRA[op]} los numeradores: ${texto(r)}.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "entero_y_fraccion",
    arquetipo: "Suma o resta un número entero y una fracción",
    enunciado: "Calcula:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 2,
    apartados,
  };
}
