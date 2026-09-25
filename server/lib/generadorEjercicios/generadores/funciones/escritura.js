// CÓMO SE ESCRIBEN LOS NÚMEROS Y LAS EXPRESIONES del tema de funciones: el
// menos tipográfico en el texto y el guion dentro de LaTeX; "2x + 1",
// "−x − 3", "3x", nunca "1x" ni "+ −".
//
// No es un generador (no está en el catálogo): lo usan los de funciones/.

export const escribe = (n) => (n < 0 ? `−${-n}` : String(n));
export const escribeL = (n) => (n < 0 ? `-${-n}` : String(n));
export const par = (x, y) => `(${escribe(x)}, ${escribe(y)})`;

export function expresion(a, b) {
  const ax = a === 1 ? "x" : a === -1 ? "−x" : `${escribe(a)}x`;
  if (b === 0) return ax;
  return `${ax} ${b < 0 ? "−" : "+"} ${Math.abs(b)}`;
}
export const expresionL = (a, b) => expresion(a, b).replace(/−/g, "-");

// Una tabla de dos filas (x e y) en LaTeX. Un valor que no es número se
// escribe tal cual (un hueco, por ejemplo).
export function tabla(filaX, filaY) {
  const fila = (nombre, vs) => `${nombre} & ${vs.map((v) => (typeof v === "number" ? escribeL(v) : v)).join(" & ")}`;
  return `\\begin{array}{|c|${filaX.map(() => "c").join("|")}|}\\hline ${fila("x", filaX)} \\\\ \\hline ${fila("y", filaY)} \\\\ \\hline\\end{array}`;
}
