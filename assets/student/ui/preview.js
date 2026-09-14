// assets/app/ui/preview.js
// La vista previa de la fórmula que hay encima del cuadro de escribir: mientras
// el alumno escribe, enseña dibujado lo que lleva escrito.
//
// LLEVABA APAGADA DESDE SIEMPRE (arreglado el 14/09/2026). La condición para
// dibujar era `if (!padOpen) return;`, donde `padOpen` se calculaba así:
//
//   const pad = document.getElementById("pad");
//   const padOpen = !!pad?.classList?.contains("show");
//
// Y **no había ningún `#pad` en ningún HTML del proyecto**: el elemento nunca
// llegó a existir. Así que `padOpen` era siempre `false` y esto no pintaba
// nunca nada. Dos capas de fallo, además: aunque el `#pad` hubiera existido,
// KaTeX tampoco estaba cargado.
//
// Ahora el estado se RECIBE (`estaAbiertoElPanel`) en vez de ir a buscar una
// clase a un id global — que es lo que permitió que el cable se quedara suelto
// sin que nada se quejara. Y se dibuja también sin panel abierto cuando lo
// escrito es SOLO una fórmula: si el alumno escribe "x^2+3x=10" a mano, ver la
// fórmula bien es justo lo que le dice que el tutor la va a entender.
export function createPreviewRenderer({
  inp, eqPreview, looksMath, isMathOnly, asciiToLatex,
  estaAbiertoElPanel = () => false,
} = {}) {
  function clear() {
    try {
      eqPreview.style.display = "none";
      eqPreview.innerHTML = "";
    } catch {}
  }

  function extractMathTail(s = "") {
    const text = String(s || "").trim();
    if (!text) return "";

    if (typeof looksMath === "function" && looksMath(text)) return text;

    const re =
      /(sqrt\([^)]*\)|\\sqrt\{[^}]*\}|\b(?:sin|cos|tan|log|ln)\([^)]*\)|[A-Za-z]\s*\^\s*(?:\{[^}]+\}|\d+)|[A-Za-z0-9π√]+(?:\s*[+\-*/×÷^=]\s*[A-Za-z0-9π√]+)+|[0-9]+(?:[.,][0-9]+)?\s*[+\-*/×÷=]\s*[0-9]+(?:[.,][0-9]+)?)/gi;

    let last = null;
    let m;
    while ((m = re.exec(text))) {
      last = { value: m[0], index: m.index };
    }
    if (!last) return "";

    const candidate = String(last.value || "").trim();

    const hasMathSignal =
      /[+\-*/×÷^=π√]/.test(candidate) || /\b(sqrt|sin|cos|tan|log|ln)\b/i.test(candidate);
    if (!hasMathSignal) return "";

    const start = last.index;
    const prevSpace = text.lastIndexOf(" ", start);
    const tail = text.slice(prevSpace >= 0 ? prevSpace + 1 : start).trim();

    return tail && /[+\-*/×÷^=π√]/.test(tail) ? tail : candidate;
  }

  function renderPreview() {
    if (!eqPreview || !inp) return;

    const raw = String(inp.value || "").trim();
    if (!raw) {
      clear();
      return;
    }

    const ok = (typeof isMathOnly === "function")
      ? isMathOnly(raw)
      : (typeof looksMath === "function" ? looksMath(raw) : false);

    // Con el panel de símbolos abierto se enseña siempre que se pueda sacar
    // algo: el alumno está construyendo una fórmula a botonazos y necesita ver
    // qué lleva. Con el panel cerrado, solo si lo escrito es SOLO una fórmula
    // —si no, una frase normal con un número dentro abriría un visor de
    // fórmulas encima del teclado sin venir a cuento.
    if (!ok && !estaAbiertoElPanel()) {
      clear();
      return;
    }

    const fragment = ok ? raw : extractMathTail(raw);
    if (!fragment) {
      clear();
      return;
    }

    try {
      eqPreview.style.display = "block";
      if (!window.katex) {
        eqPreview.textContent = fragment;
        return;
      }
      const latex = typeof asciiToLatex === "function" ? asciiToLatex(fragment) : fragment;
      window.katex.render(latex, eqPreview, { throwOnError: false, displayMode: false });
    } catch {
      eqPreview.textContent = fragment;
    }
  }

  return { renderPreview };
}
