// EXPRESIONES DE PRIMER GRADO COMO LISTA DE TÉRMINOS, y cómo se escriben.
//
// Una expresión es una lista de términos { coef, x } —`x: true` si lleva la
// letra—. Se guarda como lista y no ya reducida porque en este tema el
// ENUNCIADO es la expresión sin reducir ("3x + 5 − x + 2") y la respuesta
// es la reducida ("2x + 7"): las dos salen de la misma lista.
//
// Todo con coeficientes enteros. Se escribe como en el cuaderno: "x" y no
// "1x", "−x" y no "−1x", "2x − 3" y no "2x + −3", y el primer término sin
// "+" delante.

const MENOS = "−";

export const termino = (coef, x = false) => ({ coef, x });

// La expresión reducida: { a, b } = ax + b.
export function reduce(terminos) {
  return terminos.reduce((r, t) => (t.x ? { ...r, a: r.a + t.coef } : { ...r, b: r.b + t.coef }), { a: 0, b: 0 });
}

function trozo({ coef, x }, primero, menos, conX) {
  const abs = Math.abs(coef);
  const cuerpo = x ? `${abs === 1 ? "" : abs}${conX}` : String(abs);
  if (primero) return coef < 0 ? `${menos}${cuerpo}` : cuerpo;
  return coef < 0 ? ` ${menos} ${cuerpo}` : ` + ${cuerpo}`;
}

function escribe(terminos, menos, conX) {
  const utiles = terminos.filter((t) => t.coef !== 0);
  if (!utiles.length) return "0";
  return utiles.map((t, i) => trozo(t, i === 0, menos, conX)).join("");
}

export const textoDe = (terminos, letra = "x") => escribe(terminos, MENOS, letra);
export const latexDe = (terminos, letra = "x") => escribe(terminos, "-", letra);

// La reducida escrita: ax + b con la x primero.
export const lineal = ({ a, b }) => [termino(a, true), termino(b)];
export const textoLineal = (l, letra = "x") => textoDe(lineal(l), letra);
export const latexLineal = (l, letra = "x") => latexDe(lineal(l), letra);

// Un número con signo, como se escribe dentro de una cuenta: −3 entre
// paréntesis si va detrás de una operación.
export const conParentesis = (n) => (n < 0 ? `(${MENOS}${-n})` : String(n));
export const numeroTexto = (n) => (n < 0 ? `${MENOS}${-n}` : String(n));
