import { reuneApartados } from "../../ejercicio.js";
import { esPrimo, menorDivisorPropio, primosEntre } from "./aritmetica.js";
import { HUECO_LARGO } from "./numeros.js";

// DIVISIBILIDAD, OBJETIVO 3: NÚMEROS PRIMOS Y COMPUESTOS (concepto 4).
//
// EL ERROR QUE TIENE QUE PODER PROVOCAR (error 4 del tema): creer que un
// impar es primo porque "no es par" (51, 57, 91). Por eso en cada batería hay
// al menos dos impares compuestos que no acaban en 5: los que acaban en 5 se
// ven a la primera y no provocan nada.
//
// El 1 NO sale: no es primo ni compuesto, y ponerlo en una batería de "primo
// o compuesto" es una pregunta con trampa sin respuesta en el enunciado.

const IMPARES_COMPUESTOS = [49, 51, 57, 63, 69, 77, 81, 87, 91, 93, 111, 117, 119, 121, 133, 143, 147, 153, 161, 169, 187, 203, 209, 221];

const PRIMOS_HASTA_15 = [2, 3, 5, 7, 11, 13];

// Por qué es primo: se prueba con los primos cuyo cuadrado no pasa del
// número, y se dice dónde se para. Es el método que se enseña, y el motivo de
// no probar "todos los números hasta n".
function razonPrimo(n) {
  const probados = PRIMOS_HASTA_15.filter((p) => p * p <= n);
  const siguiente = PRIMOS_HASTA_15.find((p) => p * p > n);
  const lista = probados.length === 1
    ? `por ${probados[0]}`
    : `por ${probados.slice(0, -1).join(", ")} ni por ${probados[probados.length - 1]}`;
  return `No se divide ${lista}; y ${siguiente} · ${siguiente} = ${siguiente * siguiente} ya pasa de ${n}. Primo.`;
}

function razonCompuesto(n) {
  const d = menorDivisorPropio(n);
  return `${n} = ${d} · ${n / d}: tiene más divisores que el 1 y él mismo. Compuesto.`;
}

export function primoOCompuesto(azar, { cuantos = 6 } = {}) {
  // Dos impares compuestos y dos primos fijos; el resto, cualquiera de 11 a
  // 150. El ejemplo (el último) sale del sorteo libre.
  const fijos = [
    ...azar.mezcla(IMPARES_COMPUESTOS).slice(0, 2),
    ...azar.mezcla(primosEntre(10, 150)).slice(0, 2),
  ];
  const plan = azar.mezcla(fijos);
  while (plan.length < cuantos + 20) plan.push(azar.entero(11, 150));
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const n = plan[i];
    i += 1;
    if (n === undefined) return null;
    const primo = esPrimo(n);
    const solucion = primo ? "primo" : "compuesto";
    return {
      latex: `$${n}$: ___`,
      latexResuelto: `$${n}$: ${solucion}`,
      texto: `${n}: ___`,
      solucion,
      numero: n,
      razon: primo ? razonPrimo(n) : razonCompuesto(n),
    };
  }, { cuantos, clave: (a) => String(a.numero) });

  return {
    clave: "primo_o_compuesto",
    arquetipo: "Clasifica en primo o compuesto",
    enunciado: "Escribe si cada número es primo o compuesto:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// ── "Escribe los primos que hay entre dos números" (dificultad 2) ────────
// De 2 a 3 tramos de 15 a 30 números, hasta el 120: con 2, 3, 5 y 7 basta
// para cribar (11 · 11 = 121), que es lo que se puede hacer sin calculadora.
export function primosEntreDos(azar, { cuantos = 2 } = {}) {
  const { apartados } = reuneApartados(() => {
    const desde = azar.entero(10, 95);
    const hasta = Math.min(120, desde + azar.entero(15, 30));
    const solucion = primosEntre(desde, hasta);
    if (solucion.length < 3 || solucion.length > 7) return null;
    const frase = `Los primos entre $${desde}$ y $${hasta}$:`;
    return {
      latex: `${frase} ${HUECO_LARGO}`,
      latexResuelto: `${frase} $${solucion.join(",\\; ")}$`,
      texto: `${frase.replace(/\$/g, "")} ___`,
      solucion,
      razon: "Se tachan los pares, los que acaban en 5 y los múltiplos de 3 y de 7. "
        + `Quedan ${solucion.join(", ")}.`,
    };
  }, { cuantos, clave: (a) => String(a.solucion[0]) });

  return {
    clave: "primos_entre",
    arquetipo: "Escribe los números primos comprendidos entre dos números",
    enunciado: "Escribe todos los números primos que hay:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}
