import { frac, mcd } from "./fraccion.js";

// QUÉ FRACCIONES SALEN EN LAS HOJAS. Aparte de los generadores porque lo
// usan casi todos: denominadores de 2 a 12 (los que se manejan de cabeza en
// 1.º ESO), y siempre fracciones que ya son irreducibles cuando el
// ejercicio no va de simplificar.

// Una fracción propia con denominador de 2 a 12 y numerador de 1 a d − 1,
// ya irreducible (2/4 de 60 es un ejercicio de simplificar, no este).
export function fraccionPropia(azar, { denominadores = null } = {}) {
  const d = denominadores ? azar.elige(denominadores) : azar.entero(2, 12);
  const n = azar.entero(1, d - 1);
  return mcd(n, d) === 1 ? frac(n, d) : null;
}


// Dos denominadores distintos cuyo m.c.m. no pase de `tope`: para sumar y
// comparar sin que el denominador común se dispare.
export function denominadoresDistintos(azar, { tope = 36 } = {}) {
  const a = azar.entero(2, 12);
  const b = azar.entero(2, 12);
  if (a === b) return null;
  const comun = (a * b) / mcd(a, b);
  return comun <= tope ? [a, b] : null;
}

// Una fracción propia irreducible con ESE denominador.
export function propiaConDenominador(azar, d) {
  const n = azar.entero(1, d - 1);
  return mcd(n, d) === 1 ? frac(n, d) : null;
}
