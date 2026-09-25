// LOS NÚMEROS DECIMALES, EXACTOS. Un decimal es { n, e }: el número entero
// que se lee sin la coma y cuántas cifras hay detrás de ella. 3,45 es
// { n: 345, e: 2 }. Así 0,1 + 0,2 da 0,3 y no 0,30000000000000004, que es
// lo que da JavaScript con sus números de coma flotante.
//
// Se escriben como en el cuaderno: con coma, sin ceros de sobra a la
// derecha (3,40 es 3,4) salvo cuando se piden a propósito (0,5 y 0,50), y
// en LaTeX con la coma entre llaves, `{,}`, para que KaTeX no le ponga un
// espacio detrás.

const P10 = (k) => 10 ** k;

// Quita los ceros de la derecha: { 340, 2 } → { 34, 1 }.
export function dec(n, e = 0) {
  if (!Number.isInteger(n) || !Number.isInteger(e) || e < 0) throw new Error(`decimal no válido: ${n}, ${e}`);
  let [m, k] = [n, e];
  while (k > 0 && m % 10 === 0) { m /= 10; k -= 1; }
  return { n: m, e: k };
}

// Los dos con el mismo número de decimales, para sumar o comparar.
function igualados(a, b) {
  const e = Math.max(a.e, b.e);
  return [a.n * P10(e - a.e), b.n * P10(e - b.e), e];
}

export const suma = (a, b) => { const [x, y, e] = igualados(a, b); return dec(x + y, e); };
export const resta = (a, b) => { const [x, y, e] = igualados(a, b); return dec(x - y, e); };
export const producto = (a, b) => dec(a.n * b.n, a.e + b.e);
export const compara = (a, b) => { const [x, y] = igualados(a, b); return Math.sign(x - y); };
export const iguales = (a, b) => compara(a, b) === 0;
export const valor = (a) => a.n / P10(a.e);

// El cociente, si es exacto con como mucho `maxDecimales` cifras; si no, null.
export function cociente(a, b, maxDecimales = 4) {
  // a / b = (a.n · 10^b.e) / (b.n · 10^a.e)
  const num = a.n * P10(b.e);
  const den = b.n * P10(a.e);
  for (let e = 0; e <= maxDecimales; e += 1) {
    const x = num * P10(e);
    if (x % den === 0) return dec(x / den, e);
  }
  return null;
}

// Por la unidad seguida de ceros: la coma se mueve k lugares.
export const porPotencia = (a, k) => dec(a.n * P10(Math.max(0, k - a.e)), Math.max(0, a.e - k));
export const entrePotencia = (a, k) => dec(a.n, a.e + k);

// Las cifras: parte entera y decimales, con `cifras` decimales como mínimo
// (0,5 escrito con dos es 0,50).
function partes(a, cifras = 0) {
  const e = Math.max(a.e, cifras);
  const n = Math.abs(a.n) * P10(e - a.e);
  const s = String(n).padStart(e + 1, "0");
  return { signo: a.n < 0 ? "−" : "", entera: s.slice(0, s.length - e) || "0", decimales: s.slice(s.length - e) };
}

// La parte entera de cinco cifras o más, de tres en tres (65 100), como en
// el tema de potencias (potenciasRaices/formato.js).
const agrupa = (entera, separador) => (entera.length < 5 ? entera : entera.replace(/\B(?=(\d{3})+(?!\d))/g, separador));

export function texto(a, cifras = 0) {
  const { signo, entera, decimales } = partes(a, cifras);
  return `${signo}${agrupa(entera, " ")}${decimales ? `,${decimales}` : ""}`;
}

export function latex(a, cifras = 0) {
  const { signo, entera, decimales } = partes(a, cifras);
  return `${signo ? "-" : ""}${agrupa(entera, "\\,")}${decimales ? `{,}${decimales}` : ""}`;
}

// La cifra que ocupa una posición: 0 unidades, 1 décimas, 2 centésimas…
export function cifraEn(a, posicion) {
  const { entera, decimales } = partes(a, posicion);
  return posicion === 0 ? Number(entera.slice(-1)) : Number(decimales[posicion - 1]);
}

// Un decimal al azar con `e` cifras decimales exactas (la última no es 0)
// y parte entera entre `min` y `max`.
export function alAzar(azar, { e, min = 0, max = 9 }) {
  const entera = azar.entero(min, max);
  const decimales = azar.entero(1, P10(e) - 1);
  if (decimales % 10 === 0) return null;
  return { n: entera * P10(e) + decimales, e };
}
