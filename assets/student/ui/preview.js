// assets/app/ui/preview.js
// Encapsula el preview KaTeX del input.

export function createPreviewRenderer({ inp, eqPreview, looksMath, isMathOnly, asciiToLatex } = {}) {
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

    const pad = document.getElementById("pad");
    const padOpen = !!pad?.classList?.contains("show");
    if (!padOpen) {
      clear();
      return;
    }

    const raw = String(inp.value || "").trim();
    if (!raw) {
      clear();
      return;
    }

    const ok = (typeof isMathOnly === "function")
      ? isMathOnly(raw)
      : (typeof looksMath === "function" ? looksMath(raw) : false);

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
