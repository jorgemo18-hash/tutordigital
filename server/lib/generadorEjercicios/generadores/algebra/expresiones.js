import { reuneApartados } from "../../ejercicio.js";
import { termino, reduce, textoDe, latexDe, textoLineal, latexLineal, conParentesis, numeroTexto } from "./terminos.js";

// ÁLGEBRA, OBJETIVOS 1 Y 2: EL LENGUAJE ALGEBRAICO, EL VALOR NUMÉRICO Y
// REDUCIR EXPRESIONES (conceptos 1, 2 y 3).
//
// LOS ERRORES QUE TIENEN QUE PODER PROVOCAR:
//   1 "el doble de la suma de un número y 3" escrito 2x + 3;
//   2 en el valor numérico, pegar el coeficiente y el número (3x con x = 4
//     → 34);
//   3 reducir juntando términos que no son semejantes (3x + 5 → 8x);
//   4 al quitar un paréntesis, multiplicar solo el primer término
//     (2(x + 3) → 2x + 3).

const MENOS = "−";

// ── "Traduce al lenguaje algebraico" (dificultad 1) ─────────────────────
//
// Frases escritas a mano, cada una con su expresión. Van por parejas que se
// parecen y NO son lo mismo ("el doble de un número, más 3" y "el doble de
// la suma de un número y 3"): es lo que hay que aprender a leer.
//
// La solución guardada es UNA forma de escribirla (x + 5); 5 + x también
// está bien. Por eso esta batería no se corrige comparando texto: la
// respuesta-trampa sí, porque la forma equivocada es inconfundible.
const FRASES = [
  { f: () => "El doble de un número", t: "2x", l: "2x" },
  { f: () => "El triple de un número", t: "3x", l: "3x" },
  { f: (k) => `Un número más ${k}`, t: (k) => `x + ${k}`, l: (k) => `x + ${k}` },
  { f: (k) => `Un número menos ${k}`, t: (k) => `x ${MENOS} ${k}`, l: (k) => `x - ${k}` },
  { f: (k) => `El doble de un número, más ${k}`, t: (k) => `2x + ${k}`, l: (k) => `2x + ${k}` },
  { f: (k) => `El doble de la suma de un número y ${k}`, t: (k) => `2(x + ${k})`, l: (k) => `2(x + ${k})`, trampa: (k) => `2x + ${k}` },
  { f: (k) => `El triple de un número, menos ${k}`, t: (k) => `3x ${MENOS} ${k}`, l: (k) => `3x - ${k}` },
  { f: () => "La mitad de un número", t: "x/2", l: "\\dfrac{x}{2}" },
  { f: () => "El siguiente de un número", t: "x + 1", l: "x + 1" },
  { f: () => "El anterior de un número", t: `x ${MENOS} 1`, l: "x - 1" },
  { f: () => "El cuadrado de un número", t: "x²", l: "x^{2}" },
  { f: () => "Un número más su doble", t: "x + 2x", l: "x + 2x" },
];

const valor = (v, k) => (typeof v === "function" ? v(k) : v);

export function traduceEnunciado(azar, { cuantos = 6 } = {}) {
  // La pareja que más enseña va siempre: "el doble…, más k" y "el doble de
  // la suma…". El resto, sorteado.
  const fijas = [FRASES[4], FRASES[5]];
  const plan = [...azar.mezcla(fijas), ...azar.mezcla(FRASES.filter((x) => !fijas.includes(x)))];
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const fr = plan[i];
    i += 1;
    if (!fr) return null;
    const k = azar.entero(2, 9);
    return {
      latex: `${fr.f(k)}: ___`,
      latexResuelto: `${fr.f(k)}: $${valor(fr.l, k)}$`,
      texto: `${fr.f(k)}: ___`,
      solucion: valor(fr.t, k),
      trampa: fr.trampa ? fr.trampa(k) : null,
      razon: fr === FRASES[5]
        ? `Primero la suma, x + ${k}, y después el doble de TODO: 2(x + ${k}). Sin paréntesis sería el doble solo de x.`
        : `Se llama x al número: ${fr.f(k).toLowerCase()} es ${valor(fr.t, k)}.`,
    };
  }, { cuantos, clave: (a) => a.texto.replace(/\d+/g, "#") });

  return {
    clave: "traduce_enunciado",
    arquetipo: "Traduce el enunciado al lenguaje algebraico",
    enunciado: "Escribe con lenguaje algebraico (llama x al número):",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// ── "Calcula el valor numérico" (dificultad 1) ──────────────────────────
// De 6 a 8: ax + b, y alguna x² + b. La x casi siempre positiva y alguna vez
// negativa, entre paréntesis al sustituir.
export function valorNumerico(azar, { cuantos = 6 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const cuadrado = i % 4 === 3;
    i += 1;
    const x = azar.suerte(0.2) ? -azar.entero(1, 5) : azar.entero(1, 9);
    if (cuadrado) {
      const b = azar.entero(-9, 9);
      const exp = [termino(1, true), termino(b)];
      const sol = x * x + b;
      const expL = `x^{2}${b ? (b < 0 ? ` - ${-b}` : ` + ${b}`) : ""}`;
      const expT = `x²${b ? (b < 0 ? ` ${MENOS} ${-b}` : ` + ${b}`) : ""}`;
      return {
        latex: `$${expL}$ para $x = ${x}$: ___`,
        latexResuelto: `$${expL}$ para $x = ${x}$: $${sol}$`,
        texto: `${expT} para x = ${numeroTexto(x)}: ___`,
        solucion: sol,
        cuadrado: true, x, b, exp,
        razon: `${conParentesis(x)}² = ${x * x}${b ? `, y ${x * x} ${b < 0 ? MENOS : "+"} ${Math.abs(b)} = ${numeroTexto(sol)}` : ""}. No es ${conParentesis(x)} · 2.`,
      };
    }
    const a = azar.entero(2, 9);
    const b = azar.entero(-9, 9);
    if (b === 0) return null;
    const exp = [termino(a, true), termino(b)];
    const sol = a * x + b;
    return {
      latex: `$${latexDe(exp)}$ para $x = ${x}$: ___`,
      latexResuelto: `$${latexDe(exp)}$ para $x = ${x}$: $${sol}$`,
      texto: `${textoDe(exp)} para x = ${numeroTexto(x)}: ___`,
      solucion: sol,
      a, b, x,
      razon: `${a}x es ${a} · ${conParentesis(x)} = ${numeroTexto(a * x)}; ${numeroTexto(a * x)} ${b < 0 ? MENOS : "+"} ${Math.abs(b)} = ${numeroTexto(sol)}.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "valor_numerico",
    arquetipo: "Calcula el valor numérico de la expresión",
    enunciado: "Calcula el valor de cada expresión:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// "Las x con las x: 3x y −x dan 2x", o, si solo hay uno, "…: 3x".
function juntaLos(que, lista, total) {
  return lista.length === 1 ? `${que}: solo ${total}` : `${que}: ${lista.join(" y ")} dan ${total}`;
}

// ── "Reduce sumando los términos semejantes" (dificultad 1) ─────────────
// De 5 a 7 expresiones de tres o cuatro términos, con x y sin x mezclados.
export function reduceSemejantes(azar, { cuantos = 5 } = {}) {
  const { apartados } = reuneApartados(() => {
    const n = azar.entero(3, 4);
    const ts = Array.from({ length: n }, (_, k) => termino(azar.entero(1, 9) * (k > 0 && azar.suerte(0.35) ? -1 : 1), k % 2 === 0));
    const r = reduce(ts);
    if (r.a === 0 || r.b === 0) return null;
    // Se imprimen en un orden sorteado: con las x siempre delante, reducir
    // sería copiar.
    const orden = azar.mezcla(ts);
    const xs = ts.filter((t) => t.x).map((t) => t.coef);
    const ns = ts.filter((t) => !t.x).map((t) => t.coef);
    return {
      latex: `$${latexDe(orden)} =$ ___`,
      latexResuelto: `$${latexDe(orden)} = ${latexLineal(r)}$`,
      texto: `${textoDe(orden)} = ___`,
      solucion: textoLineal(r),
      ts,
      razon: `${juntaLos("Las x con las x", xs.map((c) => textoLineal({ a: c, b: 0 })), textoLineal({ a: r.a, b: 0 }))}; `
        + `${juntaLos("los números con los números", ns.map(numeroTexto), numeroTexto(r.b))}.`,
    };
  }, { cuantos, clave: (a) => a.solucion });

  return {
    clave: "reduce_semejantes",
    arquetipo: "Reduce sumando los términos semejantes",
    enunciado: "Reduce todo lo que se pueda:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// ── "Quita el paréntesis y reduce" (dificultad 2) ───────────────────────
// De 4 a 6: a(x + b) + cx + d y a(x − b) − cx.
export function reduceConParentesis(azar, { cuantos = 4 } = {}) {
  const { apartados } = reuneApartados(() => {
    const a = azar.entero(2, 6);
    const b = azar.entero(1, 9) * (azar.suerte(0.4) ? -1 : 1);
    const c = azar.entero(1, 5) * (azar.suerte(0.4) ? -1 : 1);
    const d = azar.suerte(0.5) ? azar.entero(1, 9) * (azar.suerte(0.4) ? -1 : 1) : 0;
    const r = { a: a + c, b: a * b + d };
    if (r.a === 0 || r.b === 0) return null;
    const dentroL = `x ${b < 0 ? "-" : "+"} ${Math.abs(b)}`;
    const dentroT = `x ${b < 0 ? MENOS : "+"} ${Math.abs(b)}`;
    const restoTs = [termino(c, true), termino(d)];
    const restoL = latexDe(restoTs).replace(/^-/, "- ").replace(/^(?!-)/, "+ ");
    const restoT = textoDe(restoTs).replace(new RegExp(`^${MENOS}`), `${MENOS} `).replace(new RegExp(`^(?!${MENOS})`), "+ ");
    const expL = `${a}(${dentroL}) ${restoL}`;
    const expT = `${a}(${dentroT}) ${restoT}`;
    const quitado = textoDe([termino(a, true), termino(a * b), ...restoTs]);
    return {
      latex: `$${expL} =$ ___`,
      latexResuelto: `$${expL} = ${latexLineal(r)}$`,
      texto: `${expT} = ___`,
      solucion: textoLineal(r),
      a, b, c, d,
      razon: `El ${a} multiplica a los DOS términos del paréntesis: ${a}x ${a * b < 0 ? MENOS : "+"} ${Math.abs(a * b)}. Queda ${quitado} = ${textoLineal(r)}.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "reduce_con_parentesis",
    arquetipo: "Quita el paréntesis y reduce",
    enunciado: "Quita el paréntesis y reduce:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}
