// ── Generic auto-scroll for any expanding element ─────────────────────────
// Extraído literal de admin.js — genérico, sin dependencias del panel admin.

/**
 * Scroll `el` into view if it extends below the viewport.
 * For accordion bodies, scrolls to the parent section so the header stays
 * visible. Does nothing if the top of the target is above the viewport
 * (the user has already scrolled past it).
 */
function scrollIfBelow(el) {
  requestAnimationFrame(() => {
    if (!el.isConnected) return;
    const target = el.classList.contains("accordionBody")
      ? (el.closest(".accordion") ?? el)
      : el;
    // Si ya estamos al top de la página no hace falta scrollear a ningún sitio
    if (window.scrollY === 0) return;
    const rect = target.getBoundingClientRect();
    if (rect.top >= 0 && rect.bottom > window.innerHeight) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

/**
 * Register generic scroll observers — call once at init.
 * Covers:
 *   • <details> elements opening (toggle event, capture phase)
 *   • Elements whose `hidden` class is removed
 *   • Elements whose HTML `hidden` attribute is removed
 */
export function initAutoScroll() {
  // <details> — toggle doesn't bubble reliably across browsers
  document.addEventListener("toggle", (e) => {
    if (e.target.open) scrollIfBelow(e.target);
  }, { capture: true });

  const observer = new MutationObserver((mutations) => {
    for (const mut of mutations) {
      const el = mut.target;
      if (mut.attributeName === "class") {
        const hadHidden = (mut.oldValue ?? "").split(/\s+/).includes("hidden");
        if (hadHidden && !el.classList.contains("hidden")) scrollIfBelow(el);
      } else if (mut.attributeName === "hidden") {
        // oldValue is "" when attribute was present, null when absent
        if (mut.oldValue !== null && !el.hasAttribute("hidden")) scrollIfBelow(el);
      }
    }
  });
  observer.observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "hidden"],
    attributeOldValue: true,
  });
}
