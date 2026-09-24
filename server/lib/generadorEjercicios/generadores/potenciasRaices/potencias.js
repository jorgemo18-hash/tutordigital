import { reuneApartados } from "../../ejercicio.js";
import { potenciaTexto, potenciaLatex, milesTexto, milesLatex } from "./formato.js";

// POTENCIAS Y RAÍCES, OBJETIVO 1: CALCULAR POTENCIAS DE NÚMEROS NATURALES
// (concepto 1).
//
// Sin calculadora (1.º ESO): o la potencia sale de cabeza, o no entra. La
// tabla de abajo dice hasta dónde llega la base para cada exponente.
//
// EL ERROR QUE TIENEN QUE PODER PROVOCAR (error 1 del tema): multiplicar la
// base por el exponente (2⁵ = 10). Por eso casi nunca sale exponente 2 con
// base 2 (2² = 4 = 2 · 2: el error da lo mismo y no se detecta).

const BASE_MAXIMA = { 2: 15, 3: 6, 4: 4, 5: 3, 6: 3 };

function potenciaDeCabeza(azar) {
  const e = azar.elige([2, 2, 3, 3, 4, 5, 6]);
  const b = azar.entero(2, BASE_MAXIMA[e]);
  if (b === 2 && e === 2) return null;
  return [b, e];
}

const producto = (b, e) => Array.from({ length: e }, () => b).join(" · ");

// ── "Escribe como potencia" (dificultad 1) ──────────────────────────────
// De 5 a 7 productos de factores iguales, de 2 a 7 factores. Uno con base
// 10, que es la que se usará después para los números grandes.
export function escribeComoPotencia(azar, { cuantos = 5 } = {}) {
  let conDiez = false;
  const { apartados } = reuneApartados(() => {
    const diez = !conDiez && azar.suerte(0.3);
    const b = diez ? 10 : azar.entero(2, 12);
    const e = azar.entero(2, 7);
    if (diez) conDiez = true;
    return {
      latex: `$${producto(b, e).replace(/·/g, "\\cdot")} =$ ___`,
      latexResuelto: `$${producto(b, e).replace(/·/g, "\\cdot")} = ${potenciaLatex(b, e)}$`,
      texto: `${producto(b, e)} = ___`,
      solucion: potenciaTexto(b, e),
      razon: `El ${b} se multiplica ${e} veces: base ${b}, exponente ${e}.`,
    };
  }, { cuantos, clave: (a) => a.solucion.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, "") });

  return {
    clave: "escribe_como_potencia",
    arquetipo: "Escribe el producto como una potencia",
    enunciado: "Escribe cada producto como una potencia:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// ── "Calcula la potencia" (dificultad 1) ────────────────────────────────
// De 6 a 8. Siempre una de exponente 1 y una de base 10 con exponente de 3
// a 6 (un 1 y tantos ceros como dice el exponente).
export function calculaPotencia(azar, { cuantos = 6 } = {}) {
  const fijos = azar.mezcla([
    () => [azar.entero(3, 25), 1],
    () => [10, azar.entero(3, 6)],
  ]);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const par = i < fijos.length ? fijos[i]() : potenciaDeCabeza(azar);
    i += 1;
    if (!par) return null;
    const [b, e] = par;
    const valor = b ** e;
    return {
      latex: `$${potenciaLatex(b, e)} =$ ______`,
      latexResuelto: `$${potenciaLatex(b, e)} = ${milesLatex(valor)}$`,
      texto: `${potenciaTexto(b, e)} = ___`,
      solucion: valor,
      base: b,
      exponente: e,
      razon: razonPotencia(b, e, valor),
    };
  }, { cuantos, clave: (a) => `${a.base}-${a.exponente}` });

  return {
    clave: "calcula_potencia",
    arquetipo: "Calcula el valor de la potencia",
    enunciado: "Calcula:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 3,
    apartados,
  };
}

function razonPotencia(b, e, valor) {
  if (e === 1) return `Exponente 1: la base una sola vez. ${b}¹ = ${b}.`;
  if (b === 10) return `Un 1 seguido de ${e} ceros: ${milesTexto(valor)}.`;
  return `${potenciaTexto(b, e)} = ${producto(b, e)} = ${milesTexto(valor)}. No es ${b} · ${e}.`;
}

// ── "Halla la base o el exponente que falta" (dificultad 2) ─────────────
// De 4 a 6: la operación inversa (A.3 pide las relaciones inversas). La
// mitad con el hueco en el exponente y la mitad en la base.
export function potenciaQueFalta(azar, { cuantos = 4 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const par = potenciaDeCabeza(azar);
    if (!par) return null;
    const [b, e] = par;
    const valor = b ** e;
    const enExponente = i % 2 === 0;
    i += 1;
    const latex = enExponente ? `$${b}^{\\square} = ${milesLatex(valor)}$` : `$\\square^{${e}} = ${milesLatex(valor)}$`;
    return {
      latex: `${latex}, $\\square =$ ___`,
      latexResuelto: `${latex}, $\\square = ${enExponente ? e : b}$`,
      texto: enExponente ? `${b}^□ = ${valor}, □ = ___` : `□^${e} = ${valor}, □ = ___`,
      solucion: enExponente ? e : b,
      razon: enExponente
        ? `${producto(b, e)} = ${milesTexto(valor)}: el ${b} está ${e} veces. Exponente ${e}.`
        : `${producto(b, e)} = ${milesTexto(valor)}: la base es ${b}.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "potencia_que_falta",
    arquetipo: "Halla la base o el exponente que falta",
    enunciado: "¿Qué número va en el □?",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 2,
    apartados,
  };
}

// ── "Compara las potencias" (dificultad 2) ──────────────────────────────
//
// De 4 a 6 parejas, la mitad con base y exponente CAMBIADOS (2⁵ y 5²). Es la
// batería que mejor delata el error 1: quien multiplica base por exponente
// ve 10 y 10 y escribe "=". Hay alguna pareja igual de verdad (2⁴ = 4²) para
// que "=" no sea siempre la trampa.
const CAMBIADAS = [[2, 3], [2, 4], [2, 5], [2, 6], [3, 4], [2, 7], [3, 5], [4, 5], [2, 9], [3, 6]];

function parejaLibre(azar) {
  const x = potenciaDeCabeza(azar);
  const y = potenciaDeCabeza(azar);
  if (!x || !y || x[0] === y[0] || x[1] === y[1]) return null;
  return [x, y];
}

const signo = (p, q) => (p === q ? "=" : p < q ? "<" : ">");

export function comparaPotencias(azar, { cuantos = 4 } = {}) {
  const cambiadas = azar.mezcla(CAMBIADAS);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const deCambiadas = i % 2 === 0;
    i += 1;
    let par;
    if (deCambiadas) {
      const [a, b] = cambiadas[(i >> 1) % cambiadas.length];
      par = azar.suerte(0.5) ? [[a, b], [b, a]] : [[b, a], [a, b]];
    } else {
      par = parejaLibre(azar);
    }
    if (!par) return null;
    const [[b1, e1], [b2, e2]] = par;
    const v1 = b1 ** e1;
    const v2 = b2 ** e2;
    if (v1 > 2000 || v2 > 2000) return null;
    const solucion = signo(v1, v2);
    const izq = potenciaLatex(b1, e1);
    const der = potenciaLatex(b2, e2);
    return {
      latex: `$${izq}$ ___ $${der}$`,
      latexResuelto: `$${izq} ${solucion} ${der}$`,
      texto: `${potenciaTexto(b1, e1)} ___ ${potenciaTexto(b2, e2)}`,
      solucion,
      pareja: par,
      razon: `${potenciaTexto(b1, e1)} = ${milesTexto(v1)} y ${potenciaTexto(b2, e2)} = ${milesTexto(v2)}: ${milesTexto(v1)} ${solucion} ${milesTexto(v2)}.`,
    };
  }, { cuantos, clave: (a) => a.pareja.flat().sort().join("-") });

  return {
    clave: "compara_potencias",
    arquetipo: "Compara las potencias con <, > o =",
    enunciado: "Escribe <, > o =. Calcula antes las dos potencias:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 2,
    apartados,
  };
}
