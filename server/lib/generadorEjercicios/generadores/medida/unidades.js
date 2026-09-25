import { porPotencia, entrePotencia, dec } from "../decimales/decimal.js";

// LAS UNIDADES DEL SISTEMA MÉTRICO DECIMAL, de mayor a menor, y cómo se
// pasa de una a otra: moviendo la coma tantos lugares como escalones (por
// 10 cada escalón en longitud, masa y capacidad; por 100 en superficie).
//
// No es un generador (no está en el catálogo): lo usan los de medida/.

export const MAGNITUDES = {
  longitud: { unidades: ["km", "hm", "dam", "m", "dm", "cm", "mm"], cifrasPorEscalon: 1, base: "m" },
  masa: { unidades: ["kg", "hg", "dag", "g", "dg", "cg", "mg"], cifrasPorEscalon: 1, base: "g" },
  capacidad: { unidades: ["kL", "hL", "daL", "L", "dL", "cL", "mL"], cifrasPorEscalon: 1, base: "L" },
  superficie: { unidades: ["km²", "hm²", "dam²", "m²", "dm²", "cm²", "mm²"], cifrasPorEscalon: 2, base: "m²" },
};

// Las que se usan de verdad: el hectómetro o el decagramo salen en la
// escalera, pero nadie compra 3 dag de queso. Los ejercicios de cambio de
// unidad las usan todas (la escalera es lo que se practica); los problemas,
// solo estas.
export const USUALES = {
  longitud: ["km", "m", "cm", "mm"],
  masa: ["kg", "g", "mg"],
  capacidad: ["L", "dL", "cL", "mL"],
};

// Cuántos lugares se mueve la coma de `de` a `a` (positivo: hacia la
// derecha, porque `a` es más pequeña).
export function lugares(magnitud, de, a) {
  const m = MAGNITUDES[magnitud];
  const pasos = m.unidades.indexOf(a) - m.unidades.indexOf(de);
  return pasos * m.cifrasPorEscalon;
}

// El valor `d` (decimal.js) expresado en otra unidad.
export function convierte(magnitud, d, de, a) {
  const k = lugares(magnitud, de, a);
  return k >= 0 ? porPotencia(d, k) : entrePotencia(d, -k);
}

// Lo que sale moviendo la coma al revés (error 1) o un escalón de menos
// (error 2), para las respuestas-trampa.
export function alReves(magnitud, d, de, a) {
  const k = lugares(magnitud, de, a);
  return k >= 0 ? entrePotencia(d, k) : porPotencia(d, -k);
}

export function unEscalonDeMenos(magnitud, d, de, a) {
  const m = MAGNITUDES[magnitud];
  const k = lugares(magnitud, de, a);
  const menos = k > 0 ? k - m.cifrasPorEscalon : k + m.cifrasPorEscalon;
  if (menos === 0) return null;
  return menos > 0 ? porPotencia(d, menos) : entrePotencia(d, -menos);
}

export const nombreDeLaMagnitud = (unidad) => Object.keys(MAGNITUDES).find((k) => MAGNITUDES[k].unidades.includes(unidad));

// Un entero como decimal, por comodidad.
export const entero = (n) => dec(n);
