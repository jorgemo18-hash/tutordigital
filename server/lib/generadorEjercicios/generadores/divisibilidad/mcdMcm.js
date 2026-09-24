import { reuneApartados } from "../../ejercicio.js";
import {
  factoriza, mcd, mcm, mcdDeVarios, mcmDeVarios, factoresDelMcd, factoresDelMcm, factoresTexto,
} from "./aritmetica.js";
import { parejaInteresante, soloPrimosPequenos } from "./numeros.js";

// DIVISIBILIDAD, OBJETIVO 5: MÁXIMO COMÚN DIVISOR Y MÍNIMO COMÚN MÚLTIPLO
// (conceptos 6 y 7).
//
// POR DESCOMPOSICIÓN, que es el método de 1.º ESO: se descomponen los
// números y se cogen los factores comunes con el menor exponente (m.c.d.) o
// todos con el mayor (m.c.m.). La explicación del ejemplo lo hace así,
// escrito con los factores de verdad, porque es donde se aprende la
// diferencia entre las dos reglas.
//
// LOS ERRORES QUE TIENEN QUE PODER PROVOCAR (y sus respuestas-trampa):
//   5 confundir el m.c.d. con el m.c.m. (se contesta uno por el otro);
//   6 en el m.c.d., coger los comunes con el MAYOR exponente;
//   7 en el m.c.m., multiplicar los dos números sin más.
// Por eso los números siempre tienen algún factor común (con m.c.d. = 1 el
// error 7 da lo mismo que la respuesta buena y no se detecta) y ninguno es
// múltiplo del otro (entonces el m.c.d. es el pequeño y se ve sin calcular).

// "2² · 3 = 12", pero "7" a secas si el producto es un solo primo: "7 = 7"
// en una explicación parece una errata.
function igualA(factores, n) {
  const escrito = factoresTexto(factores);
  return escrito === String(n) ? escrito : `${escrito} = ${n}`;
}

const descompuestos = (lista) => lista.map((n) => `${n} = ${factoresTexto(factoriza(n))}`);

function juntos(lista) {
  return lista.length === 2 ? lista.join(" y ") : `${lista.slice(0, -1).join(", ")} y ${lista[lista.length - 1]}`;
}

function razonMcd(lista) {
  return `${juntos(descompuestos(lista))}. Comunes con el menor exponente: `
    + `${igualA(factoresDelMcd(lista), mcdDeVarios(lista))}.`;
}

function razonMcm(lista) {
  return `${juntos(descompuestos(lista))}. Comunes y no comunes con el mayor exponente: `
    + `${igualA(factoresDelMcm(lista), mcmDeVarios(lista))}.`;
}

const pareja = (a, b) => `${a},\\ ${b}`;

// ── "Calcula el m.c.d." (dificultad 2) ───────────────────────────────────
// De 3 a 5 parejas de 12 a 180.
export function mcdDeDos(azar, { cuantos = 3 } = {}) {
  const { apartados } = reuneApartados(() => {
    const p = parejaInteresante(azar, { desde: 12, hasta: 180, mcdMinimo: 4 });
    if (!p) return null;
    const solucion = mcd(...p);
    return {
      latex: `$\\text{m.c.d.}(${pareja(...p)}) =$ ___`,
      latexResuelto: `$\\text{m.c.d.}(${pareja(...p)}) = ${solucion}$`,
      texto: `m.c.d.(${p.join(", ")}) = ___`,
      solucion,
      pareja: p,
      razon: razonMcd(p),
    };
  }, { cuantos, clave: (a) => a.pareja.join("-") });

  return {
    clave: "mcd_de_dos",
    arquetipo: "Calcula el máximo común divisor de dos números",
    enunciado: "Calcula descomponiendo en factores primos:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}

// ── "Calcula el m.c.m." (dificultad 2) ───────────────────────────────────
// De 3 a 5 parejas de 4 a 60, con el m.c.m. hasta 600.
export function mcmDeDos(azar, { cuantos = 3 } = {}) {
  const { apartados } = reuneApartados(() => {
    const p = parejaInteresante(azar, { desde: 4, hasta: 60, topeMcm: 600 });
    if (!p) return null;
    const solucion = mcm(...p);
    return {
      latex: `$\\text{m.c.m.}(${pareja(...p)}) =$ ___`,
      latexResuelto: `$\\text{m.c.m.}(${pareja(...p)}) = ${solucion}$`,
      texto: `m.c.m.(${p.join(", ")}) = ___`,
      solucion,
      pareja: p,
      razon: razonMcm(p),
    };
  }, { cuantos, clave: (a) => a.pareja.join("-") });

  return {
    clave: "mcm_de_dos",
    arquetipo: "Calcula el mínimo común múltiplo de dos números",
    enunciado: "Calcula descomponiendo en factores primos:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}

// ── "Calcula el m.c.d. y el m.c.m. de tres números" (dificultad 3) ───────
// De 2 a 3 ternas de 6 a 90, con el m.c.m. hasta 1000 y el m.c.d. mayor que
// 1. Las dos cosas en el mismo apartado, a propósito: con los mismos
// factores delante se ve que las dos reglas son distintas.
function ternaInteresante(azar) {
  for (let intento = 0; intento < 400; intento += 1) {
    const t = [azar.entero(6, 90), azar.entero(6, 90), azar.entero(6, 90)].sort((x, y) => x - y);
    if (new Set(t).size < 3 || !t.every(soloPrimosPequenos)) continue;
    if (t.some((x) => t.some((y) => x !== y && y % x === 0))) continue;
    if (mcdDeVarios(t) < 2 || mcmDeVarios(t) > 1000) continue;
    return t;
  }
  return null;
}

export function mcdYMcmDeTres(azar, { cuantos = 2 } = {}) {
  const { apartados } = reuneApartados(() => {
    const t = ternaInteresante(azar);
    if (!t) return null;
    const d = mcdDeVarios(t);
    const m = mcmDeVarios(t);
    const numeros = `$${t[0]},\\ ${t[1]}$ y $${t[2]}$`;
    return {
      latex: `${numeros}: m.c.d. = ___ ; m.c.m. = ___`,
      latexResuelto: `${numeros}: m.c.d. = $${d}$ ; m.c.m. = $${m}$`,
      texto: `${t.join(", ")}: m.c.d. = ___ ; m.c.m. = ___`,
      solucion: `m.c.d. = ${d}; m.c.m. = ${m}`,
      terna: t,
      razon: `${juntos(descompuestos(t))}. m.c.d.: comunes con el menor exponente, `
        + `${igualA(factoresDelMcd(t), d)}. m.c.m.: todos con el mayor, `
        + `${igualA(factoresDelMcm(t), m)}.`,
    };
  }, { cuantos, clave: (a) => a.terna.join("-") });

  return {
    clave: "mcd_y_mcm_de_tres",
    arquetipo: "Calcula el m.c.d. y el m.c.m. de tres números",
    enunciado: "Calcula el m.c.d. y el m.c.m.:",
    tipo: "ejercicio",
    dificultad: 3,
    columnas: 1,
    apartados,
  };
}
