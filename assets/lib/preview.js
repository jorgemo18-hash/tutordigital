// assets/lib/preview.js
// Encapsula el preview KaTeX del input.

export function createPreviewRenderer({ inp, eqPreview, looksMath, asciiToLatex } = {}) {
  function renderPreview() {
    if (!eqPreview || !inp) return;

    const pad = document.getElementById("pad");
const padOpen = !!pad?.classList?.contains("show");
if (!padOpen) {
  eqPreview.style.display = "none";
  eqPreview.innerHTML = "";
  return;
}

    const raw = inp.value.trim();
    if (!raw || (typeof looksMath === "function" && !looksMath(raw))) {
      eqPreview.style.display = "none";
      eqPreview.innerHTML = "";
      return;
    }

    eqPreview.style.display = "block";

    if (!window.katex) {
      eqPreview.textContent = raw;
      return;
    }

    try {
      const latex = typeof asciiToLatex === "function" ? asciiToLatex(raw) : raw;
      window.katex.render(latex, eqPreview, { throwOnError: false, displayMode: false });
    } catch {
      eqPreview.textContent = raw;
    }
  }

  return { renderPreview };
}