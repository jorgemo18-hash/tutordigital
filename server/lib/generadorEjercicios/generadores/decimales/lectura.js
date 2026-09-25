import { reuneApartados } from "../../ejercicio.js";
import { dec, texto, latex, cifraEn, alAzar, cociente } from "./decimal.js";
import { enLetra, sePuedeEscribir } from "./palabras.js";

// DECIMALES, OBJETIVO 1: LEER, ESCRIBIR Y DESCOMPONER (conceptos 1 y 2).
// Saber A.2: «Números enteros, fraccionarios y decimales … en la expresión
// de cantidades» y «Diferentes formas de representación…».
//
// LOS ERRORES QUE TIENEN QUE PODER PROVOCAR:
//   2 confundir las posiciones decimales: "cinco centésimas" escrito 0,5;
//     la cifra de las centésimas de 3,472 contestada con la de las
//     décimas;
//  10 escribir una fracción como decimal poniendo la coma entre numerador y
//     denominador (3/4 = 3,4).

const POSICIONES = ["unidades", "décimas", "centésimas", "milésimas"];
const EN_SINGULAR = ["unidad", "décima", "centésima", "milésima"];
const conNombre = (c, p) => `${c} ${c === 1 ? EN_SINGULAR[p] : POSICIONES[p]}`;
const ABREVIADAS = ["U", "d", "c", "m"];

// ── "¿Qué cifra ocupa…?" (dificultad 1) ─────────────────────────────────
// De 6 a 8, con las cuatro cifras distintas para que la respuesta no sea
// ambigua ni la trampa coincida con ella.
export function valorPosicional(azar, { cuantos = 6 } = {}) {
  const { apartados } = reuneApartados(() => {
    const d = alAzar(azar, { e: 3, min: 1, max: 9 });
    if (!d) return null;
    const cifras = [0, 1, 2, 3].map((p) => cifraEn(d, p));
    if (new Set(cifras).size < 4) return null;
    const pos = azar.entero(1, 3);
    const vecina = pos === 1 ? 2 : pos - 1;
    return {
      latex: `$${latex(d)}$: ${POSICIONES[pos]}, ___`,
      latexResuelto: `$${latex(d)}$: ${POSICIONES[pos]}, ${cifras[pos]}`,
      texto: `${texto(d)}: ${POSICIONES[pos]}, ___`,
      solucion: cifras[pos],
      vecina: cifras[vecina],
      razon: `Detrás de la coma: la 1.ª cifra son las décimas, la 2.ª las centésimas y la 3.ª las milésimas. `
        + `En ${texto(d)}, las ${POSICIONES[pos]} son el ${cifras[pos]}.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "valor_posicional_decimal",
    arquetipo: "Di qué cifra ocupa cada posición decimal",
    enunciado: "Escribe la cifra que ocupa la posición que se pide:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// ── "Escribe con cifras" (dificultad 1) ─────────────────────────────────
// De 4 a 6: "tres unidades y cuarenta y cinco centésimas". La mitad con
// ceros detrás de la coma (cinco centésimas = 0,05), que es donde está el
// error 2.
export function escribeConCifras(azar, { cuantos = 4 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const e = azar.entero(1, 3);
    const conCeros = i % 2 === 0 && e > 1;
    i += 1;
    const entera = azar.entero(0, 19);
    const parte = conCeros ? azar.entero(1, 10 ** (e - 1) - 1) : azar.entero(10 ** (e - 1), 10 ** e - 1);
    if (parte % 10 === 0 || !sePuedeEscribir(parte) || !sePuedeEscribir(entera) || entera === 1) return null;
    const d = dec(entera * 10 ** e + parte, e);
    const frase = entera
      ? `${enLetra(entera)} unidades y ${enLetra(parte)} ${POSICIONES[e]}`
      : `${enLetra(parte)} ${POSICIONES[e]}`;
    const deLaFrase = `${frase.charAt(0).toUpperCase()}${frase.slice(1)}`;
    return {
      latex: `${deLaFrase}: ___`,
      latexResuelto: `${deLaFrase}: $${latex(d)}$`,
      texto: `${deLaFrase}: ___`,
      solucion: texto(d),
      // Error 2: la parte decimal copiada tal cual, sin los ceros.
      sinCeros: `${entera},${parte}`,
      razon: `Las ${POSICIONES[e]} son la ${e}.ª cifra detrás de la coma: ${parte} ${POSICIONES[e]} se escribe ${texto(d).split(",")[1]} detrás de la coma. Queda ${texto(d)}.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "escribe_decimal_con_cifras",
    arquetipo: "Escribe con cifras el número decimal",
    enunciado: "Escribe con cifras:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 1,
    apartados,
  };
}

// ── "Descompón el número decimal" (dificultad 2) ────────────────────────
// De 4 a 6: 4,305 = 4 U + 3 d + 5 m. Casi siempre con un 0 en medio, que es
// la posición que se salta.
export function descomponDecimal(azar, { cuantos = 4 } = {}) {
  const { apartados } = reuneApartados(() => {
    const d = alAzar(azar, { e: azar.entero(2, 3), min: 1, max: 9 });
    if (!d) return null;
    const trozos = [0, 1, 2, 3].slice(0, d.e + 1).map((p) => [p, p === 0 ? Math.floor(d.n / 10 ** d.e) : cifraEn(d, p)]).filter(([, c]) => c !== 0);
    const suma = trozos.map(([p, c]) => `${c} ${ABREVIADAS[p]}`).join(" + ");
    return {
      latex: `$${latex(d)} =$ _________`,
      latexResuelto: `$${latex(d)} =$ ${suma}`,
      texto: `${texto(d)} = _________`,
      solucion: suma,
      razon: `Cada cifra con su posición: ${trozos.map(([p, c]) => conNombre(c, p)).join(", ")}. Los ceros no se escriben.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "descompon_decimal",
    arquetipo: "Descompón el número decimal en unidades, décimas, centésimas y milésimas",
    enunciado: "Descompón (U unidades, d décimas, c centésimas, m milésimas):",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}

// Las fracciones que se pasan a decimal de cabeza (denominador 2, 4, 5, 8…)
// y las fracciones decimales (denominador 10, 100, 1000).
const SENCILLAS = [[1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 8], [3, 8], [3, 2], [5, 4], [7, 5]];

// ── "Fracción y decimal" (dificultad 2) ─────────────────────────────────
// De 6 a 8: la mitad fracciones decimales (7/100 = 0,07) y la mitad
// sencillas (3/4 = 0,75), que se dividen.
export function fraccionYDecimal(azar, { cuantos = 6 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const decimal = i % 2 === 0;
    i += 1;
    let n; let d;
    if (decimal) {
      d = azar.elige([10, 100, 1000]);
      n = azar.entero(1, d === 10 ? 29 : d === 100 ? 250 : 999);
      if (n % 10 === 0) return null;
    } else {
      [n, d] = azar.elige(SENCILLAS);
    }
    const r = cociente(dec(n), dec(d));
    const fL = `\\dfrac{${n}}{${d}}`;
    return {
      latex: `$${fL} =$ ___`,
      latexResuelto: `$${fL} = ${latex(r)}$`,
      texto: `${n}/${d} = ___`,
      solucion: texto(r),
      comaEnMedio: `${n},${d}`,
      sinCeros: decimal && String(n).length < String(d).length - 1 ? `0,${n}` : null,
      razon: decimal
        ? `Entre ${d}: la coma se mueve ${String(d).length - 1} ${d === 10 ? "lugar" : "lugares"} a la izquierda, ${n} → ${texto(r)}.`
        : `La fracción es una división: ${n} : ${d} = ${texto(r)}.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "fraccion_a_decimal",
    arquetipo: "Escribe la fracción como número decimal",
    enunciado: "Escribe como número decimal:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 2,
    apartados,
  };
}
