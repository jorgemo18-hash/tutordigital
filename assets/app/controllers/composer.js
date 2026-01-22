// assets/app/controllers/composer.js
// Composer helpers extracted from index.js.

export function createComposerHelpers({
  inp,
  btn,
  pad,
  getModeChosen,
  getPendingImage,
} = {}) {
  function autoGrowInput() {
    if (!inp) return;
    try {
      inp.style.height = "auto";
      const max = 140;
      const next = Math.min(inp.scrollHeight, max);
      inp.style.height = next + "px";

      if (inp.scrollHeight > max + 2) {
        inp.style.overflowY = "auto";
        inp.scrollTop = inp.scrollHeight;
      } else {
        inp.style.overflowY = "hidden";
        inp.scrollTop = 0;
      }

      if (!String(inp.value || "").length) {
        inp.style.overflowY = "hidden";
        inp.scrollTop = 0;
      }
    } catch {}
  }

  function updatePadLayout() {
    try {
      const isOpen = !!(pad && pad.classList && pad.classList.contains("show"));
      const h = isOpen && pad ? Math.ceil(pad.getBoundingClientRect().height) : 0;
      document.documentElement.style.setProperty("--ttd-pad-h", `${h}px`);
    } catch {}
  }

  function update() {
    if (!btn || !inp) return;

    const chosen = typeof getModeChosen === "function" ? !!getModeChosen() : false;
    const hasImg = !!(typeof getPendingImage === "function" ? getPendingImage() : null);
    const text = String(inp.value || "").trim();

    try { inp.disabled = false; } catch {}
    try { inp.placeholder = chosen ? "Escribe aquí…" : "Escribe tu duda…"; } catch {}

    try { btn.disabled = !(text || hasImg); } catch {}

    try { updatePadLayout(); } catch {}
  }

  function ensureComposerInteractive() {
    if (!inp) return;
    try {
      inp.disabled = false;
      inp.readOnly = false;
      inp.style.pointerEvents = "auto";
      inp.style.userSelect = "text";
      inp.tabIndex = 0;
    } catch {}
  }

  return {
    autoGrowInput,
    update,
    ensureComposerInteractive,
    updatePadLayout,
  };
}
