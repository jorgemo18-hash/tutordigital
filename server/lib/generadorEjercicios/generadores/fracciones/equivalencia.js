import { reuneApartados } from "../../ejercicio.js";
import { frac, mcd, latex, texto, latexTalCual, textoTalCual } from "./fraccion.js";
import { fraccionPropia } from "./eleccion.js";

// FRACCIONES, OBJETIVO 2: FRACCIONES EQUIVALENTES Y SIMPLIFICAR (conceptos
// 2 y 3).
//
// LOS ERRORES QUE TIENEN QUE PODER PROVOCAR:
//   10 creer que se obtienen equivalentes SUMANDO lo mismo arriba y abajo
//      (2/3 = 4/5); por eso en "¿son equivalentes?" los "no" son así;
//   11 simplificar solo una vez, por un divisor común que no es el
//      m.c.d. (36/48 → 18/24 y parar); por eso el m.c.d. es compuesto.

// ── "Completa la fracción equivalente" (dificultad 1) ───────────────────
// De 5 a 7. La mitad amplificando (2/3 = □/12) y la mitad simplificando
// (12/18 = 2/□), con el hueco unas veces arriba y otras abajo.
export function equivalenteQueFalta(azar, { cuantos = 5 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const f = fraccionPropia(azar);
    if (!f) return null;
    const k = azar.entero(2, 8);
    const grande = frac(f.n * k, f.d * k);
    const amplifica = i % 2 === 0;
    const huecoArriba = (i >> 1) % 2 === 0;
    i += 1;
    const [dada, pedida] = amplifica ? [f, grande] : [grande, f];
    const solucion = huecoArriba ? pedida.n : pedida.d;
    const conocido = huecoArriba ? pedida.d : pedida.n;
    const hueco = huecoArriba ? `\\dfrac{\\square}{${pedida.d}}` : `\\dfrac{${pedida.n}}{\\square}`;
    const huecoTexto = huecoArriba ? `□/${pedida.d}` : `${pedida.n}/□`;
    const factor = amplifica ? `se multiplica por ${k}` : `se divide entre ${k}`;
    const deDonde = huecoArriba ? `${dada.d} → ${pedida.d}` : `${dada.n} → ${pedida.n}`;
    return {
      latex: `$${latexTalCual(dada)} = ${hueco}$, $\\square =$ ___`,
      latexResuelto: `$${latexTalCual(dada)} = ${latexTalCual(pedida)}$`,
      texto: `${textoTalCual(dada)} = ${huecoTexto}, □ = ___`,
      solucion,
      // Para la respuesta-trampa del error 10: lo que sale SUMANDO.
      conSuma: (huecoArriba ? dada.n : dada.d) + (conocido - (huecoArriba ? dada.d : dada.n)),
      razon: `De ${deDonde} ${factor}; lo mismo con el otro término: ${huecoArriba ? `${dada.n}` : `${dada.d}`} ${amplifica ? "·" : ":"} ${k} = ${solucion}.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "equivalente_que_falta",
    arquetipo: "Completa la fracción equivalente",
    enunciado: "¿Qué número va en el □ para que sean equivalentes?",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// ── "¿Son equivalentes? Sí o no" (dificultad 1) ─────────────────────────
// De 6 a 8 parejas, mitad y mitad. Los "no" son los del error 10: se ha
// sumado lo mismo arriba y abajo (2/3 y 4/5).
export function sonEquivalentes(azar, { cuantos = 6 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const f = fraccionPropia(azar);
    if (!f) return null;
    const equivalentes = i % 2 === 0;
    i += 1;
    const k = azar.entero(2, 6);
    const otra = equivalentes ? frac(f.n * k, f.d * k) : frac(f.n + k, f.d + k);
    const solucion = f.n * otra.d === f.d * otra.n ? "sí" : "no";
    const cruz1 = f.n * otra.d;
    const cruz2 = f.d * otra.n;
    const pareja = `$${latexTalCual(f)}$ y $${latexTalCual(otra)}$`;
    return {
      latex: `${pareja}: ___`,
      latexResuelto: `${pareja}: ${solucion === "sí" ? "Sí" : "No"}`,
      texto: `${textoTalCual(f)} y ${textoTalCual(otra)}: ___`,
      solucion,
      razon: `Productos cruzados: ${f.n} · ${otra.d} = ${cruz1} y ${f.d} · ${otra.n} = ${cruz2}. `
        + (cruz1 === cruz2 ? "Iguales: sí." : "Distintos: no."),
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "son_equivalentes",
    arquetipo: "¿Son equivalentes? Contesta sí o no",
    enunciado: "¿Son equivalentes? Contesta sí o no:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// ── "Simplifica hasta la fracción irreducible" (dificultad 2) ───────────
// De 4 a 6, con el m.c.d. COMPUESTO (4, 6, 8, 9, 12…): si fuera primo, bastaría
// dividir una vez y el error 11 no se vería nunca.
const MCD_COMPUESTOS = [4, 6, 8, 9, 10, 12, 14, 15, 16, 18];

export function simplificaFraccion(azar, { cuantos = 4 } = {}) {
  const { apartados } = reuneApartados(() => {
    const f = fraccionPropia(azar);
    if (!f) return null;
    const g = azar.elige(MCD_COMPUESTOS);
    const grande = frac(f.n * g, f.d * g);
    if (grande.d > 180) return null;
    return {
      latex: `$${latexTalCual(grande)} =$ ___`,
      latexResuelto: `$${latexTalCual(grande)} = ${latex(f)}$`,
      texto: `${textoTalCual(grande)} = ___`,
      solucion: texto(f),
      grande,
      razon: `m.c.d.(${grande.n}, ${grande.d}) = ${mcd(grande.n, grande.d)}: `
        + `${grande.n} : ${g} = ${f.n} y ${grande.d} : ${g} = ${f.d}. Ya no se puede simplificar más.`,
    };
  }, { cuantos, clave: (a) => a.solucion });

  return {
    clave: "simplifica_fraccion",
    arquetipo: "Simplifica hasta la fracción irreducible",
    enunciado: "Simplifica hasta que no se pueda más:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 2,
    apartados,
  };
}
