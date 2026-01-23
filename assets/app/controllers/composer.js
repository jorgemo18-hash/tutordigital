// assets/app/controllers/composer.js
// Composer helpers extracted from index.js.

export function createComposerHelpers({
  inp,
  btn,
  pad,
  getModeChosen,
  getWaitingForMode,
  getPendingImage,
} = {}) {
  function autoGrowInput() {
    if (!inp) return;
    try {
      inp.style.height = "auto";
      const max = Number(
        getComputedStyle(document.documentElement)
          .getPropertyValue("--composer-input-max")
          .replace("px", "")
      ) || 140;
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
    const waiting = typeof getWaitingForMode === "function" ? !!getWaitingForMode() : false;
    const pending = typeof getPendingImage === "function" ? getPendingImage() : null;
    const hasAttach = !!(pending && (pending.file || pending.dataUrl));
    const text = String(inp.value || "").trim();

    try { inp.disabled = false; } catch {}
    try {
      inp.placeholder = chosen
        ? "Escribe aquí…"
        : waiting
          ? "Elige un modo arriba…"
          : "Escribe tu duda…";
    } catch {}

    try { btn.disabled = !(text || hasAttach); } catch {}

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
