// iosViewportReset.js — iOS Safari sometimes leaves the page zoomed in after
// an input loses focus and the keyboard closes. This forces a reset.

function resetViewportZoom(viewportMetaEl) {
  window.scrollTo(0, 0);
  if (!viewportMetaEl) return;
  const original = viewportMetaEl.getAttribute("content");
  viewportMetaEl.setAttribute("content", `${original}, maximum-scale=1`);
  requestAnimationFrame(() => viewportMetaEl.setAttribute("content", original));
}

// Wires a focusout listener on rootEl that resets iOS zoom once a form field
// (input/textarea/select) loses focus. rootEl and the viewport meta tag are
// passed explicitly so this has no hidden dependency on global page state.
export function setupIOSViewportReset(rootEl, viewportMetaEl = document.querySelector('meta[name="viewport"]')) {
  function onFocusOut(e) {
    if (!e.target?.matches?.("input, textarea, select")) return;
    setTimeout(() => resetViewportZoom(viewportMetaEl), 50);
  }
  rootEl.addEventListener("focusout", onFocusOut);
  return function cleanupIOSViewportReset() {
    rootEl.removeEventListener("focusout", onFocusOut);
  };
}
