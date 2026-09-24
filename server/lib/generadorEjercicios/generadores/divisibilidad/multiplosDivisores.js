import { reuneApartados } from "../../ejercicio.js";
import { divisores, parejasDeDivisores } from "./aritmetica.js";
import { HUECO_LARGO } from "./numeros.js";

// DIVISIBILIDAD, OBJETIVO 1: MÚLTIPLOS Y DIVISORES (conceptos 1 y 2).
//
// Aquí no hay expresiones que evaluar: cada apartado es una pregunta sobre
// la relación "a es múltiplo de b / b es divisor de a", y la respuesta la da
// aritmetica.js. Cada apartado trae su `razon` escrita, que es la que se
// imprime si sale como ejemplo resuelto (ver ejemploResuelto.js).
//
// EL CERO NO SALE NUNCA COMO MÚLTIPLO, a propósito. Los libros no se ponen
// de acuerdo (unos cuentan el 0 como primer múltiplo y otros empiezan en el
// propio número), y una pregunta cuya respuesta depende del libro de texto
// no se puede corregir. Por eso se pregunta por los SIGUIENTES de una serie
// o por los que hay ENTRE dos números, que tienen una sola respuesta.

const coma = ",\\; ";

// ── "Escribe los tres múltiplos siguientes" (dificultad 1) ───────────────
// De 4 a 6 series. La serie empieza en un múltiplo cualquiera (no siempre
// en el propio número) para que no se conteste recitando la tabla.
export function continuaMultiplos(azar, { cuantos = 4 } = {}) {
  const { apartados } = reuneApartados(() => {
    const n = azar.entero(3, 15);
    const k = azar.entero(1, 7);
    const dados = [k, k + 1, k + 2].map((i) => i * n);
    const solucion = [k + 3, k + 4, k + 5].map((i) => i * n);
    return {
      latex: `$${dados.join(coma)},$ ___, ___, ___`,
      latexResuelto: `$${[...dados, ...solucion].join(coma)}$`,
      texto: `${dados.join(", ")}, ___, ___, ___`,
      solucion,
      razon: `Son múltiplos de ${n}: van de ${n} en ${n}. ${dados[2]} + ${n} = ${solucion[0]}, y así sigue.`,
    };
  // Una serie por número: dos de múltiplos de 6 en la misma batería son la
  // misma pregunta dos veces.
  }, { cuantos, clave: (a) => String(a.solucion[1] - a.solucion[0]) });

  return {
    clave: "continua_multiplos",
    arquetipo: "Escribe los tres múltiplos siguientes",
    enunciado: "Escribe los tres múltiplos siguientes de cada serie:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// ── "¿Es múltiplo? ¿Es divisor? Contesta sí o no" (dificultad 1) ─────────
//
// De 6 a 8 preguntas, la mitad con respuesta "sí" y la mitad "no", y con las
// dos palabras (múltiplo y divisor) y también "divisible por". El error que
// tiene que poder provocar es CONFUNDIR MÚLTIPLO CON DIVISOR (error 1 del
// tema): quien lo tiene contesta a la pregunta al revés. Por eso los "no"
// NO son evidentes: el número está cerca de un múltiplo (91 y 13·7 = 91 sí,
// 92 no), para que haya que dividir de verdad.
const FORMAS = [
  { tipo: "multiplo", frase: (a, b) => `¿Es $${a}$ múltiplo de $${b}$?` },
  { tipo: "divisor", frase: (a, b) => `¿Es $${b}$ divisor de $${a}$?` },
  { tipo: "divisible", frase: (a, b) => `¿Es $${a}$ divisible por $${b}$?` },
];

// El divisor, de 6 a 19 y nunca 10: por 2, 3, 5 o 10 se contesta mirando la
// última cifra y la batería dejaría de pedir dividir. Los criterios tienen
// su propio objetivo.
const DIVISORES_DE_LA_BATERIA = [6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19];

function parejaDeDivision(azar, exacta) {
  const b = azar.elige(DIVISORES_DE_LA_BATERIA);
  const q = azar.entero(4, 12);
  const a = exacta ? b * q : b * q + azar.entero(1, b - 1);
  return [a, b];
}

function razonDeDivision(a, b) {
  const q = Math.floor(a / b);
  const r = a % b;
  return r === 0
    ? `${a} : ${b} = ${q}, exacta: ${a} es múltiplo de ${b} y ${b} es divisor de ${a}. Sí.`
    : `${a} : ${b} = ${q} y sobran ${r}: la división no es exacta. No.`;
}

export function esMultiploODivisor(azar, { cuantos = 6 } = {}) {
  // Mitad y mitad, en orden sorteado. El último (el ejemplo) es libre.
  const respuestas = azar.mezcla(Array.from({ length: cuantos + 1 }, (_, i) => i % 2 === 0));
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const exacta = respuestas[i % respuestas.length];
    i += 1;
    const [a, b] = parejaDeDivision(azar, exacta);
    const forma = FORMAS[i % FORMAS.length];
    const solucion = exacta ? "sí" : "no";
    return {
      latex: `${forma.frase(a, b)} ___`,
      latexResuelto: `${forma.frase(a, b)} ${exacta ? "Sí" : "No"}`,
      texto: `${forma.frase(a, b).replace(/\$/g, "")} ___`,
      solucion,
      pareja: [a, b],
      razon: razonDeDivision(a, b),
    };
  }, { cuantos, clave: (a) => a.pareja.join("-") });

  return {
    clave: "es_multiplo_o_divisor",
    arquetipo: "Contesta sí o no: múltiplo, divisor, divisible",
    enunciado: "Contesta sí o no. Haz la división si hace falta:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// ── "Escribe los múltiplos comprendidos entre dos números" (dificultad 2) ─
// De 3 a 4. Los extremos NO son múltiplos: así no hay duda de si "entre"
// los incluye. Salen de 3 a 6 múltiplos por apartado.
export function multiplosEntre(azar, { cuantos = 3 } = {}) {
  const { apartados } = reuneApartados(() => {
    const n = azar.entero(6, 25);
    const cuantosSalen = azar.entero(3, 6);
    const primero = n * azar.entero(2, 12);
    const desde = primero - azar.entero(1, n - 1);
    const ultimo = primero + n * (cuantosSalen - 1);
    const hasta = ultimo + azar.entero(1, n - 1);
    if (hasta > 400) return null;
    const solucion = Array.from({ length: cuantosSalen }, (_, i) => primero + n * i);
    const frase = `Los múltiplos de $${n}$ entre $${desde}$ y $${hasta}$:`;
    return {
      latex: `${frase} ${HUECO_LARGO}`,
      latexResuelto: `${frase} $${solucion.join(coma)}$`,
      texto: `${frase.replace(/\$/g, "")} ___`,
      solucion,
      razon: `El primero que pasa de ${desde} es ${n} · ${primero / n} = ${primero}. `
        + `Desde ahí, de ${n} en ${n} sin pasar de ${hasta}.`,
    };
  }, { cuantos, clave: (a) => String(a.solucion[1] - a.solucion[0]) });

  return {
    clave: "multiplos_entre",
    arquetipo: "Escribe los múltiplos comprendidos entre dos números",
    enunciado: "Escribe todos los que hay:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}

// ── "Halla todos los divisores de un número" (dificultad 2) ──────────────
//
// De 3 a 4 números, cada uno con 6 a 12 divisores: con menos es trivial y
// con más no cabe en la línea. El error que tiene que poder provocar es
// OLVIDAR EL 1 Y EL PROPIO NÚMERO (error 2 del tema). La explicación enseña
// el método de las parejas, que es el que garantiza no dejarse ninguno.
export function todosLosDivisores(azar, { cuantos = 3 } = {}) {
  const { apartados } = reuneApartados(() => {
    const n = azar.entero(12, 100);
    const solucion = divisores(n);
    if (solucion.length < 6 || solucion.length > 12) return null;
    const parejas = parejasDeDivisores(n).map(([p, q]) => `${p} · ${q}`).join(", ");
    return {
      latex: `Divisores de $${n}$: ${HUECO_LARGO}`,
      latexResuelto: `Divisores de $${n}$: $${solucion.join(coma)}$`,
      texto: `Divisores de ${n}: ___`,
      solucion,
      numero: n,
      razon: `Se buscan las parejas que multiplicadas dan ${n}: ${parejas}. Todos los números que aparecen son sus divisores.`,
    };
  }, { cuantos, clave: (a) => String(a.numero) });

  return {
    clave: "todos_los_divisores",
    arquetipo: "Halla todos los divisores de un número",
    enunciado: "Halla todos los divisores:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}
