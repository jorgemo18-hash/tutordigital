// CÓMO SE ESCRIBEN LOS NÚMEROS de este tema, que son los primeros grandes
// de verdad (3 400 000) y los primeros con coma (3,4 · 10⁶).
//
// La norma española: los números de CINCO cifras o más se agrupan de tres en
// tres con un espacio (34 507, 3 400 000); los de cuatro, no (3400). La coma
// es la decimal. En LaTeX el espacio es `\,` (fino, que no parte la línea) y
// la coma va entre llaves, `{,}`: sin ellas KaTeX la trata como una coma de
// lista y le pone un espacio detrás ("3, 4").

const SUPER = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
export const superindice = (e) => String(e).split("").map((c) => SUPER[c]).join("");

function agrupa(n, separador) {
  const s = String(n);
  if (s.length < 5) return s;
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, separador);
}

export const milesTexto = (n) => agrupa(n, " ");
export const milesLatex = (n) => agrupa(n, "\\,");

// Una mantisa con coma: 3.07 → "3,07" / "3{,}07". Se construye desde las
// cifras (entero y decimales por separado) para no arrastrar los errores de
// coma flotante de JavaScript (3.07 * 100 = 306.99999…).
export function mantisaTexto({ entera, decimales }) {
  return decimales ? `${entera},${decimales}` : String(entera);
}
export function mantisaLatex({ entera, decimales }) {
  return decimales ? `${entera}{,}${decimales}` : String(entera);
}

// La potencia escrita: en texto con superíndice (2⁵) y en LaTeX (2^{5}).
export const potenciaTexto = (b, e) => `${b}${superindice(e)}`;
export const potenciaLatex = (b, e) => `${b}^{${e}}`;
