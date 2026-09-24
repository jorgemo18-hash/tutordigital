import { reuneApartados } from "../../ejercicio.js";
import {
  superindice, potenciaLatex, potenciaTexto, milesTexto, milesLatex, mantisaTexto, mantisaLatex,
} from "./formato.js";

// POTENCIAS Y RAÍCES, OBJETIVO 2: POTENCIAS DE 10 Y NOTACIÓN CIENTÍFICA
// (conceptos 2 y 3). Saber A.2: «Números grandes y pequeños: notación
// exponencial y científica».
//
// SOLO NÚMEROS GRANDES. Los pequeños (0,00034 = 3,4 · 10⁻⁴) necesitan
// exponentes negativos, que en 1.º ESO no se han dado cuando se ve este
// tema. Queda escrito en el arquetipo de la migración 136 para que nadie
// crea que se ha olvidado.

// ── "Potencias de 10" (dificultad 1) ────────────────────────────────────
// De 5 a 7, mitad en cada sentido: 10⁵ = ___ y 100 000 = 10^___.
export function potenciasDeDiez(azar, { cuantos = 5 } = {}) {
  const exponentes = azar.mezcla([2, 3, 4, 5, 6, 7, 8, 9]);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const e = exponentes[i % exponentes.length];
    const alNumero = i % 2 === 0;
    i += 1;
    const valor = 10 ** e;
    return alNumero
      ? {
        latex: `$${potenciaLatex(10, e)} =$ ______`,
        latexResuelto: `$${potenciaLatex(10, e)} = ${milesLatex(valor)}$`,
        texto: `${potenciaTexto(10, e)} = ___`,
        solucion: milesTexto(valor),
        razon: `Un 1 seguido de ${e} ceros.`,
      }
      : {
        latex: `$${milesLatex(valor)} = 10^{\\square}$, $\\square =$ ___`,
        latexResuelto: `$${milesLatex(valor)} = ${potenciaLatex(10, e)}$`,
        texto: `${milesTexto(valor)} = 10^□, □ = ___`,
        solucion: e,
        razon: `Tiene ${e} ceros detrás del 1: exponente ${e}.`,
      };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "potencias_de_diez",
    arquetipo: "Pasa de potencia de 10 a número y al revés",
    enunciado: "Completa:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// ── "Descomposición polinómica" (dificultad 2) ──────────────────────────
// De 3 a 4 números de 4 a 6 cifras, con algún 0 en medio (la cifra que no se
// escribe es donde está la dificultad). Las unidades van sin potencia y las
// decenas como "· 10", que es como se escribe.
function termino(cifra, e) {
  if (e === 0) return { texto: String(cifra), latex: String(cifra) };
  if (e === 1) return { texto: `${cifra} · 10`, latex: `${cifra} \\cdot 10` };
  return { texto: `${cifra} · 10${superindice(e)}`, latex: `${cifra} \\cdot 10^{${e}}` };
}

export function descomposicionPolinomica(azar, { cuantos = 3 } = {}) {
  const { apartados } = reuneApartados(() => {
    const largo = azar.entero(4, 6);
    const cifras = Array.from({ length: largo }, (_, k) => (k === 0 ? azar.entero(1, 9) : azar.entero(0, 9)));
    // Un 0 EN MEDIO, siempre: uno al final se ve solo, y en medio es donde
    // se escribe "3 · 10³ + 0 · 10²…" o se salta un lugar sin querer.
    if (!cifras.slice(1, -1).includes(0)) cifras[azar.entero(1, largo - 2)] = 0;
    const n = Number(cifras.join(""));
    const terminos = cifras
      .map((c, k) => ({ c, e: largo - 1 - k }))
      .filter(({ c }) => c !== 0)
      .map(({ c, e }) => termino(c, e));
    const solucion = terminos.map((t) => t.texto).join(" + ");
    return {
      latex: `$${milesLatex(n)} =$ _________`,
      latexResuelto: `$${milesLatex(n)} = ${terminos.map((t) => t.latex).join(" + ")}$`,
      texto: `${milesTexto(n)} = ___`,
      solucion,
      numero: n,
      razon: `Cada cifra por la potencia de 10 de su lugar; los ceros no se escriben: ${solucion}.`,
    };
  }, { cuantos, clave: (a) => String(a.numero) });

  return {
    clave: "descomposicion_polinomica",
    arquetipo: "Escribe el número con potencias de 10",
    enunciado: "Escribe cada número como suma de cifras por potencias de 10:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}

// ── "Notación científica" (dificultad 2) ────────────────────────────────
//
// De 4 a 6, mitad en cada sentido. La mantisa lleva de 1 a 3 cifras
// significativas; el exponente va de 3 a 9 (miles a miles de millones).
//
// EL ERROR QUE TIENE QUE PODER PROVOCAR (error 6 del tema): poner de
// exponente el número de CIFRAS (4 500 000 tiene 7 cifras → 10⁷) en vez de
// los lugares que se mueve la coma (6). Su respuesta-trampa sale de ahí.
function numeroCientifico(azar) {
  const significativas = azar.entero(1, 3);
  const entera = azar.entero(1, 9);
  let decimales = "";
  for (let k = 1; k < significativas; k += 1) decimales += String(azar.entero(0, 9));
  decimales = decimales.replace(/0+$/, "");
  const e = azar.entero(3, 9);
  if (decimales.length > e) return null;
  const valor = Number(`${entera}${decimales.padEnd(e, "0")}`);
  return { entera, decimales, e, valor };
}

export function notacionCientifica(azar, { cuantos = 4 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const m = numeroCientifico(azar);
    if (!m) return null;
    const aCientifica = i % 2 === 0;
    i += 1;
    const cientificaTexto = `${mantisaTexto(m)} · 10${superindice(m.e)}`;
    const cientificaLatex = `${mantisaLatex(m)} \\cdot 10^{${m.e}}`;
    if (aCientifica) {
      return {
        latex: `$${milesLatex(m.valor)} =$ ______`,
        latexResuelto: `$${milesLatex(m.valor)} = ${cientificaLatex}$`,
        texto: `${milesTexto(m.valor)} = ___`,
        solucion: cientificaTexto,
        mantisa: m,
        sentido: "a_cientifica",
        razon: `${m.decimales ? `La coma va detrás de la primera cifra: ${mantisaTexto(m)}` : `Solo hay una cifra que no es 0: ${m.entera}`}. `
          + `Para volver al número hay que añadir ${m.e} lugares: 10${superindice(m.e)}.`,
      };
    }
    return {
      latex: `$${cientificaLatex} =$ ______`,
      latexResuelto: `$${cientificaLatex} = ${milesLatex(m.valor)}$`,
      texto: `${cientificaTexto} = ___`,
      solucion: milesTexto(m.valor),
      mantisa: m,
      sentido: "a_numero",
      razon: `Multiplicar por 10${superindice(m.e)} es mover la coma ${m.e} lugares a la derecha, rellenando con ceros.`,
    };
  }, { cuantos, clave: (a) => String(a.mantisa.valor) });

  return {
    clave: "notacion_cientifica",
    arquetipo: "Pasa a notación científica y al revés",
    enunciado: "Pasa a notación científica, o al revés:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 2,
    apartados,
  };
}
