import { reuneApartados } from "../../ejercicio.js";
import { milesTexto } from "../potenciasRaices/formato.js";

// NATURALES, OBJETIVO 2: LA DIVISIÓN Y SUS TÉRMINOS (concepto 3). Saber
// A.3: «Relaciones inversas entre las operaciones (… multiplicación y
// división)»: la prueba de la división es justo esa relación,
// D = d · c + r.
//
// EL ERROR QUE TIENE QUE PODER PROVOCAR es el 3: olvidar el resto al hallar
// el dividendo (D = d · c), o dejar un resto mayor que el divisor.

// ── "Divide y haz la prueba" (dificultad 1) ─────────────────────────────
// De 4 a 6 divisiones de tres o cuatro cifras entre una o dos, siempre con
// resto (una exacta no tiene prueba que enseñe nada).
export function divisionYPrueba(azar, { cuantos = 4 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const dosCifras = i % 2 === 1;
    i += 1;
    const d = dosCifras ? azar.entero(12, 35) : azar.entero(3, 9);
    const c = azar.entero(dosCifras ? 12 : 25, dosCifras ? 95 : 400);
    const r = azar.entero(1, d - 1);
    const D = d * c + r;
    return {
      latex: `$${D} : ${d}$ → cociente ___, resto ___`,
      latexResuelto: `$${D} : ${d}$ → cociente ${c}, resto ${r}`,
      texto: `${D} : ${d} → cociente ___, resto ___`,
      solucion: [c, r],
      razon: `Prueba: divisor por cociente más resto, ${d} · ${c} + ${r} = ${milesTexto(D)}, que es el dividendo; y el resto, ${r}, es menor que el divisor.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "division_y_prueba",
    arquetipo: "Divide y comprueba con la prueba de la división",
    enunciado: "Divide y haz la prueba (d · c + r = D):",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// ── "Halla el término que falta" (dificultad 2) ─────────────────────────
// De 4 a 6: el dividendo (D = d · c + r) o el divisor ((D − r) : c). Y
// alguna "¿es posible?": un resto que no es menor que el divisor.
export function terminoDeLaDivision(azar, { cuantos = 4 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const que = ["dividendo", "divisor", "posible"][i % 3];
    i += 1;
    const d = azar.entero(4, 25);
    const c = azar.entero(6, 60);
    const r = azar.entero(1, d - 1);
    const D = d * c + r;
    if (que === "dividendo") {
      const frase = `Divisor ${d}, cociente ${c}, resto ${r}. Dividendo:`;
      return {
        latex: `${frase} ___`, latexResuelto: `${frase} ${milesTexto(D)}`, texto: `${frase} ___`,
        solucion: milesTexto(D),
        sinResto: milesTexto(d * c),
        razon: `D = d · c + r = ${d} · ${c} + ${r} = ${milesTexto(D)}.`,
      };
    }
    if (que === "divisor") {
      const frase = `Dividendo ${milesTexto(D)}, cociente ${c}, resto ${r}. Divisor:`;
      return {
        latex: `${frase} ___`, latexResuelto: `${frase} ${d}`, texto: `${frase} ___`,
        solucion: d,
        razon: `Sin el resto, ${milesTexto(D)} − ${r} = ${milesTexto(D - r)} es divisor por cociente: ${milesTexto(D - r)} : ${c} = ${d}.`,
      };
    }
    // Un resto menor que el divisor (sí) o igual o mayor (no), a suertes:
    // si fuera siempre "no", se contestaría sin pensar.
    const si = azar.suerte(0.5);
    const resto = si ? azar.entero(1, d - 1) : d + azar.entero(0, 5);
    const frase = `¿Es posible una división con divisor ${d} y resto ${resto}?`;
    return {
      latex: `${frase} ___`, latexResuelto: `${frase} ${si ? "Sí" : "No"}`, texto: `${frase} ___`,
      solucion: si ? "sí" : "no",
      razon: si
        ? `Sí: el resto, ${resto}, es menor que el divisor, ${d}.`
        : `No: el resto tiene que ser MENOR que el divisor; con ${resto}, el ${d} cabría una vez más.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "termino_de_la_division",
    arquetipo: "Halla el término que falta en una división",
    enunciado: "Completa (D = d · c + r):",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}
