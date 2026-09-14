// DIBUJAR LAS MATEMÁTICAS DE LA HOJA CON KaTeX.
//
// El contenido de la hoja lleva las fórmulas entre $...$ y aquí se hace UNA
// pasada sobre la hoja ya montada. Se hace al final y no pieza a pieza porque
// auto-render recorre el DOM: si se llama por trozo, un $ de apertura en el
// enunciado y el de cierre en un apartado no se emparejarían nunca.
//
// KaTeX está vendorizado en /assets/shared/vendor/katex (ver su LEEME.md) y lo
// carga la página, no este módulo: es un <script> global que define
// window.renderMathInElement, y cargarlo desde aquí lo duplicaría en cada
// hoja.
//
// SI KaTeX NO ESTÁ, LA HOJA SIGUE SIENDO VÁLIDA: se ve "$x^2$" en crudo. Es
// feo, pero se entiende y se puede imprimir. Lo que no puede pasar es que una
// fórmula que no se dibuja deje el hueco en blanco — eso sí sería una hoja
// mal impresa sin que nadie se entere.

const DELIMITADORES = [
  { left: "$$", right: "$$", display: true },
  { left: "$", right: "$", display: false },
];

export function katexDisponible(win = globalThis.window) {
  return typeof win?.renderMathInElement === "function";
}

export function dibujarFormulas(raiz, win = globalThis.window) {
  if (!raiz) return false;
  if (!katexDisponible(win)) return false;
  try {
    win.renderMathInElement(raiz, {
      delimiters: DELIMITADORES,
      // Un enunciado con un error de LaTeX no puede tumbar la hoja entera: se
      // queda ese trozo en crudo y el resto se dibuja.
      throwOnError: false,
      // "5 $ de descuento" en un problema de dinero no es una fórmula.
      ignoredClasses: ["hj-no-formulas"],
    });
    return true;
  } catch {
    return false;
  }
}
