// mobileBackGuard.js — Stops iOS Safari's swipe-back gesture (and the
// hardware/browser back action in general) from leaving the SPA while a
// mobile bottom sheet, pane, or in-sheet subview is open.
//
// Each open layer calls pushBackGuard(onBack) and gets a synthetic history
// entry pushed for it. A swipe/back gesture fires popstate, which this
// module intercepts: it runs that layer's onBack() instead of letting the
// browser actually navigate to whatever page came before (e.g. login).
// When the app closes a layer through its own UI (not a swipe), it must
// call popBackGuard() so the synthetic entry is consumed in turn — see
// teacher/mobile/mobileTeacherSheets.js's openSheet/closeSheet for the
// reference wiring.

const _stack = [];
let _wired = false;
let _consuming = false;

function _onPopState() {
  if (_consuming) { _consuming = false; return; }
  const onBack = _stack.pop();
  if (!onBack) return; // nothing guarded — let the real navigation proceed
  onBack();
  if (_stack.length > 0) {
    // Something is still open underneath (e.g. a sheet behind a subview) —
    // re-arm so the *next* swipe is caught too instead of falling through.
    history.pushState({ __mtBackGuard: _stack.length }, "");
  }
}

function _ensureWired() {
  if (_wired) return;
  _wired = true;
  window.addEventListener("popstate", _onPopState);
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
