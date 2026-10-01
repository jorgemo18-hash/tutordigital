// CÓMO SE ESCRIBEN LOS NÚMEROS del tema de estadística y probabilidad: coma
// decimal, fracciones irreducibles y tablas de frecuencias.
//
// No es un generador (no está en el catálogo): lo usan los de estadistica/.

// 6.5 → "6,5"; 0.25 → "0,25"; 7 → "7". Sin ceros de sobra.
export function coma(n, decimales = 2) {
  const t = (Math.round(n * 10 ** decimales) / 10 ** decimales).toFixed(decimales).replace(/\.?0+$/, "");
  return t.replace(".", ",");
}

// ¿Tiene como mucho `decimales` cifras decimales? (para medias exactas)
export const exacto = (num, den, decimales = 2) => (num * 10 ** decimales) % den === 0;

const mcd = (a, b) => (b === 0 ? Math.abs(a) : mcd(b, a % b));

// Una fracción irreducible: { texto: "3/10", latex: "\frac{3}{10}" }.
export function fraccion(num, den) {
  const d = mcd(num, den) || 1;
  const [n, m] = [num / d, den / d];
  if (m === 1) return { texto: String(n), latex: String(n) };
  return { texto: `${n}/${m}`, latex: `\\frac{${n}}{${m}}` };
}

// Una tabla de frecuencias en LaTeX: una fila de valores y debajo las filas
// que se pidan (un valor que no es número se escribe tal cual: un hueco).
export function tablaDeFilas(filas) {
  const columnas = filas[0][1].length;
  const fila = ([nombre, vs]) => `\\text{${nombre}} & ${vs.map((v) => (typeof v === "number" ? coma(v) : v)).join(" & ")}`;
  return `\\begin{array}{|l|${Array.from({ length: columnas }, () => "c").join("|")}|}\\hline ${filas.map(fila).join(" \\\\ \\hline ")} \\\\ \\hline\\end{array}`;
}

// Un hueco en blanco de cuatro espacios de LaTeX (OJO: "\;" en un string de
// JavaScript es solo ";": hacen falta dos barras).
export const HUECO_TABLA = "\\;\\;\\;\\;";

// Lista de datos para el texto: "3, 1, 0, 2…".
export const lista = (datos) => datos.map((d) => coma(d)).join(", ");
