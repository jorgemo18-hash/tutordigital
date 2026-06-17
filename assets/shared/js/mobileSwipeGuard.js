// mobileSwipeGuard.js — Intercepts iOS Safari's edge swipe-back gesture at
// the touch level. history.pushState (mobileBackGuard.js) doesn't reliably
// stop that gesture in iOS Safari/PWA when the real session history is
// short — Safari's own edge-swipe recognizer can win the gesture before a
// popstate ever fires. This module is the primary defense; mobileBackGuard
// stays in place as an independent fallback (it still helps e.g. on the
// Android back button, or browsers where edge-swipe isn't a factor).
//
// Detects a left-edge, left-to-right swipe — the shape of the gesture
// that triggers "go back" — and either closes the most recently opened
// layer, or, if nothing is open, swallows the gesture so the browser never
// navigates away. Callers supply hasOpenLayer/closeTopLayer explicitly
// (typically mobileBackGuard.js's hasOpenGuard/triggerTopGuard).

const EDGE_ZONE_PX    = 40; // how close to the left edge a swipe must start
const MIN_DELTA_PX    = 50; // minimum horizontal travel to count as "a swipe"
const BLOCK_THRESHOLD = 10; // horizontal travel that already justifies blocking Safari's own gesture

function _isBackSwipeShape(dx, dy) {
  return dx > MIN_DELTA_PX && dx > Math.abs(dy);
}

// rootEl: the touch target to watch (a full-screen mobile shell/container).
// hasOpenLayer(): () => boolean — is anything open right now?
// closeTopLayer(): () => void — close the most recently opened thing.
export function setupSwipeGuard(rootEl, { hasOpenLayer, closeTopLayer }) {
  if (!rootEl) return () => {};

  let startX = null;
  let startY = null;
  let trackingEdge = false;

  function onTouchStart(e) {
    const t = e.touches[0];
    if (!t) return;
    startX = t.clientX;
    startY = t.clientY;
    trackingEdge = startX <= EDGE_ZONE_PX;
  }

  function onTouchMove(e) {
    if (!trackingEdge || startX === null) return;
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if (dx > BLOCK_THRESHOLD && dx > Math.abs(dy)) {
      // Stop Safari's own edge-swipe-back transition from taking over —
      // by touchend it would already be too late to prevent it.
      e.preventDefault();
    }
  }

  function onTouchEnd(e) {
    if (startX === null) return;
    const t = e.changedTouches[0];
    const endX = t ? t.clientX : startX;
    const endY = t ? t.clientY : startY;
    const dx = endX - startX;
    const dy = endY - (startY ?? endY);
    const wasEdgeBackSwipe = trackingEdge && _isBackSwipeShape(dx, dy);
    startX = null;
    startY = null;
    trackingEdge = false;
    if (!wasEdgeBackSwipe) return;

    if (hasOpenLayer()) closeTopLayer();
    // else: absorb — nothing open, do nothing, gesture swallowed.
  }

  rootEl.addEventListener("touchstart", onTouchStart, { passive: true });
  rootEl.addEventListener("touchmove", onTouchMove, { passive: false });
  rootEl.addEventListener("touchend", onTouchEnd, { passive: true });

  return function cleanupSwipeGuard() {
    rootEl.removeEventListener("touchstart", onTouchStart);
    rootEl.removeEventListener("touchmove", onTouchMove);
    rootEl.removeEventListener("touchend", onTouchEnd);
  };
}
