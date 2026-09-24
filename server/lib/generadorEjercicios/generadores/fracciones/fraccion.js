// UNA FRACCIÓN Y SU ARITMÉTICA EXACTA.
//
// Lo mismo que expresion.js para los enteros: las soluciones las calcula
// este archivo, con numerador y denominador enteros, sin decimales de por
// medio (1/3 + 1/6 en coma flotante da 0,49999…, y "0,5" en una hoja de
// fracciones es una respuesta equivocada de otro tema).
//
// Una fracción es { n, d } con d > 0. Las operaciones devuelven la fracción
// SIMPLIFICADA, que es la respuesta que se pide; la sin simplificar se
// construye aparte cuando hace falta (para la respuesta-trampa de "no
// simplifica", o para escribir los pasos de un ejemplo).

export function mcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x || 1;
}

export const mcm = (a, b) => Math.abs(a * b) / mcd(a, b);

export function frac(n, d = 1) {
  if (!Number.isInteger(n) || !Number.isInteger(d) || d === 0) {
    throw new Error(`fracción no válida: ${n}/${d}`);
  }
  return d < 0 ? { n: -n, d: -d } : { n, d };
}

export function simplifica({ n, d }) {
  const g = mcd(n, d);
  return frac(n / g, d / g);
}

export const suma = (a, b) => simplifica(frac(a.n * b.d + b.n * a.d, a.d * b.d));
export const resta = (a, b) => simplifica(frac(a.n * b.d - b.n * a.d, a.d * b.d));
export const producto = (a, b) => simplifica(frac(a.n * b.n, a.d * b.d));
export function cociente(a, b) {
  if (b.n === 0) throw new Error("división entre cero");
  return simplifica(frac(a.n * b.d, a.d * b.n));
}

export const iguales = (a, b) => a.n * b.d === b.n * a.d;
export const compara = (a, b) => Math.sign(a.n * b.d - b.n * a.d);
export const esIrreducible = ({ n, d }) => mcd(n, d) === 1;
export const esEntera = ({ n, d }) => n % d === 0;

// ── Cómo se escriben ─────────────────────────────────────────────────────

// Texto plano: "3/4", y "2" si es entera. El signo va delante.
export function texto(f) {
  if (f.d === 1) return String(f.n);
  return `${f.n}/${f.d}`;
}

// LaTeX con \dfrac y no \frac: en una línea de texto, \frac sale con los
// números del tamaño de un subíndice, ilegibles en una fotocopia.
export function latex(f) {
  if (f.d === 1) return String(f.n);
  if (f.n < 0) return `-\\dfrac{${-f.n}}{${f.d}}`;
  return `\\dfrac{${f.n}}{${f.d}}`;
}

// La fracción TAL CUAL, sin simplificar ni pasar a entero: para escribir
// los enunciados y los pasos ("6/8", "4/4").
export const latexTalCual = ({ n, d }) => `\\dfrac{${n}}{${d}}`;
export const textoTalCual = ({ n, d }) => `${n}/${d}`;
