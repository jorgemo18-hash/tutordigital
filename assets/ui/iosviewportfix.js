// assets/ui/iosViewportFix.js
// iOS/Safari: mantener el composer visible incluso con teclado abierto.
// Expone CSS vars:
//   --kb   (px del teclado)
//   --padH (altura del pad cuando está abierto)

export function setupIOSViewportFix() {
  const vv = window.visualViewport;
  const padEl = document.getElementById("pad");
  let rafId = 0;

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

  function scheduleUpdate() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      updateVars();
    });
  }

  const onViewportChange = () => scheduleUpdate();
  const onWindowResize = () => scheduleUpdate();

  if (vv) {
    vv.addEventListener("resize", onViewportChange);
    vv.addEventListener("scroll", onViewportChange);
  }
  window.addEventListener("resize", onWindowResize);

  window.__ttdUpdateLayout = updateVars;

  updateVars();

  return function cleanupIOSViewportFix() {
    try {
      if (vv) {
        vv.removeEventListener("resize", onViewportChange);
        vv.removeEventListener("scroll", onViewportChange);
      }
      window.removeEventListener("resize", onWindowResize);
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    } catch {}
  };
}
