// LOS NÚMEROS EN LETRA, de 0 a 199, para "escribe con cifras: tres
// unidades y cuarenta y cinco centésimas".
//
// Unidades, décimas, centésimas y milésimas son FEMENINAS: "una centésima",
// "veintiuna milésimas", "doscientas milésimas". Para no tener que
// concordar, quien elige los números evita los que terminan en 1 (salvo el
// 11) y los de 200 en adelante: `sePuedeEscribir` lo comprueba.

const HASTA_29 = [
  "cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
  "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve",
  "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve",
];
const DECENAS = { 3: "treinta", 4: "cuarenta", 5: "cincuenta", 6: "sesenta", 7: "setenta", 8: "ochenta", 9: "noventa" };

export const sePuedeEscribir = (n) => Number.isInteger(n) && n >= 0 && n < 200 && (n % 10 !== 1 || n % 100 === 11);

export function enLetra(n) {
  if (!sePuedeEscribir(n)) throw new Error(`${n} no se escribe sin concordar el género`);
  if (n === 100) return "cien";
  if (n > 100) return `ciento ${enLetra(n - 100)}`;
  if (n < 30) return HASTA_29[n];
  const u = n % 10;
  return u ? `${DECENAS[Math.floor(n / 10)]} y ${HASTA_29[u]}` : DECENAS[Math.floor(n / 10)];
}
