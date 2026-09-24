import { reuneApartados } from "../../ejercicio.js";
import { potenciaLatex, potenciaTexto, superindice } from "./formato.js";

// POTENCIAS Y RAÍCES, OBJETIVO 3: OPERAR CON POTENCIAS DE LA MISMA BASE
// (conceptos 4 y 5). Saber A.3: «Propiedades de las operaciones (…
// potenciación)».
//
// SE PIDE EL RESULTADO COMO UNA SOLA POTENCIA, no su valor: lo que se
// practica es la propiedad, y 3⁴ · 3⁶ = 3¹⁰ se hace sin calcular 59 049.
//
// LOS ERRORES QUE TIENEN QUE PODER PROVOCAR (con su respuesta-trampa):
//   2 en el producto, multiplicar los exponentes   (3⁴ · 3² = 3⁸)
//   3 en el producto, multiplicar también las bases (3⁴ · 3² = 9⁶)
//   4 en el cociente, dividir los exponentes       (5⁸ : 5² = 5⁴)
//   5 en la potencia de una potencia, sumarlos     ((2³)² = 2⁵)
// Los números se eligen para que cada error dé una respuesta distinta de la
// buena (con 2 y 2 sumar y multiplicar dan lo mismo: no sirve).

const BASES = [2, 3, 5, 6, 7, 10, 11];

// ── "Producto de potencias de la misma base" (dificultad 1) ─────────────
export function productoMismaBase(azar, { cuantos = 5 } = {}) {
  const { apartados } = reuneApartados(() => {
    const b = azar.elige(BASES);
    const m = azar.entero(2, 9);
    const n = azar.entero(2, 9);
    if (m * n === m + n) return null;
    const e = m + n;
    return {
      latex: `$${potenciaLatex(b, m)} \\cdot ${potenciaLatex(b, n)} =$ ___`,
      latexResuelto: `$${potenciaLatex(b, m)} \\cdot ${potenciaLatex(b, n)} = ${potenciaLatex(b, e)}$`,
      texto: `${potenciaTexto(b, m)} · ${potenciaTexto(b, n)} = ___`,
      solucion: potenciaTexto(b, e),
      base: b, m, n,
      razon: `Misma base: se deja la base y se SUMAN los exponentes, ${m} + ${n} = ${e}.`,
    };
  }, { cuantos, clave: (a) => `${a.base}` });

  return {
    clave: "producto_misma_base",
    arquetipo: "Escribe el producto como una sola potencia",
    enunciado: "Escribe como una sola potencia:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// ── "Cociente de potencias de la misma base" (dificultad 1) ─────────────
// La mitad con el exponente de arriba múltiplo del de abajo (8 y 2): es
// donde "dividir los exponentes" da un número y parece que funciona.
export function cocienteMismaBase(azar, { cuantos = 5 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const b = azar.elige(BASES);
    const n = azar.entero(2, 5);
    const multiplo = i % 2 === 0;
    i += 1;
    // El resultado con exponente 2 como poco: "2¹" es una forma rara de
    // escribir 2, y no es lo que se practica.
    const m = multiplo ? n * azar.entero(2, 3) : n + azar.entero(2, 7);
    if (m === n * 2 && n === 2) return null;
    if (multiplo && m / n === m - n) return null;
    const e = m - n;
    return {
      latex: `$${potenciaLatex(b, m)} : ${potenciaLatex(b, n)} =$ ___`,
      latexResuelto: `$${potenciaLatex(b, m)} : ${potenciaLatex(b, n)} = ${potenciaLatex(b, e)}$`,
      texto: `${potenciaTexto(b, m)} : ${potenciaTexto(b, n)} = ___`,
      solucion: potenciaTexto(b, e),
      base: b, m, n,
      razon: `Misma base: se deja la base y se RESTAN los exponentes, ${m} − ${n} = ${e}.`,
    };
  }, { cuantos, clave: (a) => `${a.base}` });

  return {
    clave: "cociente_misma_base",
    arquetipo: "Escribe el cociente como una sola potencia",
    enunciado: "Escribe como una sola potencia:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// ── "Potencia de una potencia" (dificultad 2) ───────────────────────────
export function potenciaDePotencia(azar, { cuantos = 4 } = {}) {
  const { apartados } = reuneApartados(() => {
    const b = azar.elige(BASES);
    const m = azar.entero(2, 6);
    const n = azar.entero(2, 5);
    if (m * n === m + n) return null;
    const e = m * n;
    const enunciado = `(${potenciaLatex(b, m)})^{${n}}`;
    return {
      latex: `$${enunciado} =$ ___`,
      latexResuelto: `$${enunciado} = ${potenciaLatex(b, e)}$`,
      texto: `(${potenciaTexto(b, m)})${superindice(n)} = ___`,
      solucion: potenciaTexto(b, e),
      base: b, m, n,
      razon: `${potenciaTexto(b, m)} se repite ${n} veces, así que los exponentes se MULTIPLICAN: ${m} · ${n} = ${e}.`,
    };
  }, { cuantos, clave: (a) => `${a.base}` });

  return {
    clave: "potencia_de_potencia",
    arquetipo: "Escribe la potencia de una potencia como una sola potencia",
    enunciado: "Escribe como una sola potencia:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 2,
    apartados,
  };
}

// ── "Las tres propiedades juntas" (dificultad 3) ────────────────────────
//
// De 3 a 4 expresiones con las tres operaciones, en dos formas:
//   (bᵐ)ⁿ · bᵖ : bᵍ     y     bᵐ · bⁿ : (bᵖ)ᵍ
// La explicación va paso a paso, en el
// orden en que se hace: primero la potencia de potencia (paréntesis), luego
// de izquierda a derecha. El exponente final, de 2 a 12.
function formaA(azar, b) {
  const m = azar.entero(2, 4); const n = azar.entero(2, 3);
  const p = azar.entero(1, 6); const q = azar.entero(2, 8);
  const pp = m * n;
  const e = pp + p - q;
  if (e < 2 || e > 12 || m * n === m + n) return null;
  const pl = p === 1 ? String(b) : potenciaLatex(b, p);
  const pt = p === 1 ? String(b) : potenciaTexto(b, p);
  return {
    latex: `(${potenciaLatex(b, m)})^{${n}} \\cdot ${pl} : ${potenciaLatex(b, q)}`,
    texto: `(${potenciaTexto(b, m)})${superindice(n)} · ${pt} : ${potenciaTexto(b, q)}`,
    e,
    // Con el error 5, (bᵐ)ⁿ se hace sumando.
    eConError5: m + n + p - q,
    pasos: [
      `(${potenciaTexto(b, m)})${superindice(n)} = ${potenciaTexto(b, pp)}`,
      `${potenciaTexto(b, pp)} · ${pt} = ${potenciaTexto(b, pp + p)}`,
      `${potenciaTexto(b, pp + p)} : ${potenciaTexto(b, q)} = ${potenciaTexto(b, e)}`,
    ],
  };
}

function formaB(azar, b) {
  const m = azar.entero(3, 9); const n = azar.entero(2, 8);
  const p = azar.entero(2, 3); const q = azar.entero(2, 3);
  const pq = p * q;
  const e = m + n - pq;
  if (e < 2 || e > 12 || p * q === p + q) return null;
  return {
    latex: `${potenciaLatex(b, m)} \\cdot ${potenciaLatex(b, n)} : (${potenciaLatex(b, p)})^{${q}}`,
    texto: `${potenciaTexto(b, m)} · ${potenciaTexto(b, n)} : (${potenciaTexto(b, p)})${superindice(q)}`,
    e,
    eConError5: m + n - (p + q),
    pasos: [
      `(${potenciaTexto(b, p)})${superindice(q)} = ${potenciaTexto(b, pq)}`,
      `${potenciaTexto(b, m)} · ${potenciaTexto(b, n)} = ${potenciaTexto(b, m + n)}`,
      `${potenciaTexto(b, m + n)} : ${potenciaTexto(b, pq)} = ${potenciaTexto(b, e)}`,
    ],
  };
}

export function propiedadesMezcladas(azar, { cuantos = 3 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const b = azar.elige([2, 3, 5, 7]);
    const f = (i % 2 === 0 ? formaA : formaB)(azar, b);
    i += 1;
    if (!f) return null;
    return {
      latex: `$${f.latex} =$ ___`,
      latexResuelto: `$${f.latex} = ${potenciaLatex(b, f.e)}$`,
      texto: `${f.texto} = ___`,
      solucion: potenciaTexto(b, f.e),
      base: b,
      eConError5: f.eConError5,
      razon: `Primero el paréntesis y luego de izquierda a derecha: ${f.pasos.join("; ")}.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "propiedades_mezcladas",
    arquetipo: "Aplica las propiedades de las potencias en una misma expresión",
    enunciado: "Escribe como una sola potencia, paso a paso:",
    tipo: "ejercicio",
    dificultad: 3,
    columnas: 1,
    apartados,
  };
}
