// mobileBackGuard.js — Stops iOS Safari's swipe-back gesture (and the
// hardware/browser back action in general) from leaving the SPA while a
// mobile bottom sheet, pane, or in-sheet subview is open — and, once
// armBaseGuard() has run, from leaving the SPA at all from a main screen.
//
// Each open layer calls pushBackGuard(onBack) and gets a synthetic history
// entry pushed for it. A swipe/back gesture fires popstate, which this
// module intercepts: it runs that layer's onBack() instead of letting the
// browser actually navigate to whatever page came before (e.g. login).
// When the app closes a layer through its own UI (not a swipe), it must
// call popBackGuard() so the synthetic entry is consumed in turn — see
// teacher/mobile/mobileTeacherSheets.js's openSheet/closeSheet for the
// reference wiring.
//
// armBaseGuard() additionally traps swipes that happen with nothing open
// at all (e.g. on the Cuaderno/Agenda/Perfil main screens): every such
// swipe just gets absorbed instead of navigating to a real previous page.

const _stack = [];
let _wired = false;
let _consuming = false;
let _hasBase = false;

function _onPopState() {
  if (_consuming) { _consuming = false; return; }

  const onBack = _stack.pop();
  if (onBack) {
    onBack();
    // Re-arm: for the next nested layer if one remains, otherwise for the
    // base "main screen" trap (when armed) so a further swipe doesn't fall
    // through to a real previous page either.
    if (_stack.length > 0) {
      history.pushState({ __mtBackGuard: _stack.length }, "");
    } else if (_hasBase) {
      history.pushState({ __mtBackGuardBase: true }, "");
    }
    return;
  }

  // Nothing was open — already on a main screen. Absorb the swipe instead
  // of letting it fall through to whatever page preceded the SPA.
  if (_hasBase) {
    history.pushState({ __mtBackGuardBase: true }, "");
  }
}

function _ensureWired() {
  if (_wired) return;
  _wired = true;
  window.addEventListener("popstate", _onPopState);
}

// Call once, at panel boot, so swiping back from a main screen with
// nothing open never escapes the SPA.
export function armBaseGuard() {
  if (_hasBase) return;
  _ensureWired();
  _hasBase = true;
  history.pushState({ __mtBackGuardBase: true }, "");
}

export function pushBackGuard(onBack) {
  _ensureWired();
  _stack.push(onBack);
  history.pushState({ __mtBackGuard: _stack.length }, "");
}

export function popBackGuard() {
  if (!_stack.length) return;
  _stack.pop();
  _consuming = true;
  history.back();
}

// ── Touch-level companion (mobileSwipeGuard.js) ──────────────────────
// These read/drain the same stack without touching browser history at
// all — the touch guard is the primary defense against iOS's edge swipe,
// so it doesn't need (and shouldn't trigger) a history.back() round trip.
// The corresponding synthetic history entry is simply left behind; it's
// harmless and gets absorbed like any other stale entry on a real back.

export function hasOpenGuard() {
  return _stack.length > 0;
}

export function triggerTopGuard() {
  const onBack = _stack.pop();
  if (onBack) onBack();
  return Boolean(onBack);
}
