// assets/ui/iosViewportFix.js
// iOS/Safari: mantener el composer visible incluso con teclado abierto.
// Expone CSS vars:
//   --kb   (px del teclado)
//   --padH (altura del pad cuando está abierto)


export function setupIOSViewportFix() {
  const vv = window.visualViewport;
  const padEl = document.getElementById("pad");

  function computeKeyboardPx() {
    if (!vv) return 0;
    return Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
  }

  function updateVars() {
    const kb = computeKeyboardPx();

    const padShown = !!(padEl && padEl.classList.contains("show"));
    const padH = padShown && padEl ? (padEl.offsetHeight || 0) : 0;

    document.documentElement.style.setProperty("--kb", kb + "px");
    document.documentElement.style.setProperty("--padH", padH + "px");
  }

  if (vv) {
    vv.addEventListener("resize", updateVars);
    vv.addEventListener("scroll", updateVars);
  }
  window.addEventListener("resize", updateVars);

  window.__ttdUpdateLayout = updateVars;

  updateVars();
}