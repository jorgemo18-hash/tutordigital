// assets/app/boot/initial.js

function isMobileViewport() {
  try { return window.matchMedia && window.matchMedia("(max-width: 720px)").matches; } catch {}
  return false;
}

export function createInitialScrollLock({
  scrollEl,
  inp,
  micBtn,
  kbd,
  btn,
  btnDeberes,
  btnExamen,
  btnTrabajo,
  unlockOnFirstSendOnly = false,
} = {}) {
  let locked = false;
  let rafId = 0;
  let timers = [];
  let vvState = null;
  let unlockBound = false;
  let unlockFn = null;

  function enforceScrollTop() {
    if (!locked || !scrollEl) return;
    try { scrollEl.scrollTop = 0; } catch {}
  }

  function scheduleEnforce() {
    if (!locked) return;
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      enforceScrollTop();
    });
  }

  function unlockInitialScroll() {
    if (!locked) return;
    locked = false;
    try { if (rafId) cancelAnimationFrame(rafId); } catch {}
    rafId = 0;
    for (const t of timers) {
      try { clearTimeout(t); } catch {}
    }
    timers = [];
    if (vvState) {
      try {
        vvState.vv.removeEventListener("resize", vvState.onViewportChange);
        vvState.vv.removeEventListener("scroll", vvState.onViewportChange);
      } catch {}
      vvState = null;
    }
    try { window.removeEventListener("scroll", scheduleEnforce, true); } catch {}
    try { inp?.removeEventListener?.("input", unlockFn); } catch {}
    try { inp?.removeEventListener?.("keydown", unlockFn); } catch {}
    try { micBtn?.removeEventListener?.("click", unlockFn); } catch {}
    try { document.getElementById("more")?.removeEventListener?.("click", unlockFn); } catch {}
    try { kbd?.removeEventListener?.("click", unlockFn); } catch {}
    try { document.getElementById("sendIn")?.removeEventListener?.("click", unlockFn); } catch {}
    try { btn?.removeEventListener?.("click", unlockFn); } catch {}
    try { btnDeberes?.removeEventListener?.("click", unlockFn); } catch {}
    try { btnExamen?.removeEventListener?.("click", unlockFn); } catch {}
    try { btnTrabajo?.removeEventListener?.("click", unlockFn); } catch {}
    try { scrollEl?.removeEventListener?.("wheel", unlockFn); } catch {}
    try { scrollEl?.removeEventListener?.("touchmove", unlockFn); } catch {}
    unlockFn = null;
    unlockBound = false;
  }

  function bindUnlockListeners() {
    if (unlockBound) return;
    unlockBound = true;
    const unlock = unlockFn || (unlockFn = () => unlockInitialScroll());

    if (unlockOnFirstSendOnly) return;

    try { inp?.addEventListener?.("input", unlock, { passive: true }); } catch {}
    try { inp?.addEventListener?.("keydown", unlock, { passive: true }); } catch {}
    try { micBtn?.addEventListener?.("click", unlock, { passive: true }); } catch {}
    try { document.getElementById("more")?.addEventListener?.("click", unlock, { passive: true }); } catch {}
    try { kbd?.addEventListener?.("click", unlock, { passive: true }); } catch {}
    try { document.getElementById("sendIn")?.addEventListener?.("click", unlock, { passive: true }); } catch {}
    try { btn?.addEventListener?.("click", unlock, { passive: true }); } catch {}
    try { btnDeberes?.addEventListener?.("click", unlock, { passive: true }); } catch {}
    try { btnExamen?.addEventListener?.("click", unlock, { passive: true }); } catch {}
    try { btnTrabajo?.addEventListener?.("click", unlock, { passive: true }); } catch {}
    try { scrollEl?.addEventListener?.("wheel", unlock, { passive: true }); } catch {}
    try { scrollEl?.addEventListener?.("touchmove", unlock, { passive: true }); } catch {}
  }

  function lockInitialScroll() {
    if (!scrollEl || locked || !isMobileViewport()) return;
    locked = true;
    enforceScrollTop();

    timers = [
      setTimeout(enforceScrollTop, 60),
      setTimeout(enforceScrollTop, 220),
      setTimeout(enforceScrollTop, 520),
    ];

    const vv = window.visualViewport;
    if (vv) {
      const onViewportChange = () => scheduleEnforce();
      vv.addEventListener("resize", onViewportChange);
      vv.addEventListener("scroll", onViewportChange);
      vvState = { vv, onViewportChange };
    }

    try { window.addEventListener("scroll", scheduleEnforce, true); } catch {}
    bindUnlockListeners();
  }

  return { lockInitialScroll, unlockInitialScroll };
}

export function runInitialBoot({
  add,
  getHistory,
  setHistory,
  scrollEl,
  renderFromHistory,
  rerenderPendingMath,
  ensureComposerInteractive,
  update,
  renderPreview,
  lockInitialScroll,
} = {}) {
  queueMicrotask(() => {
    try {
      const hist = getHistory();
      if (!Array.isArray(hist) || hist.length === 0) {
        const msg = "¿Qué toca hoy? Elige arriba";
        add("assistant", msg, { autoScroll: false, pinned: true });
        const h = getHistory();
        h.push({ role: "assistant", content: msg });
        setHistory(h);
        try {
          requestAnimationFrame(() => {
            try { scrollEl.scrollTop = 0; } catch {}
          });
        } catch {}
      }
    } catch (e) {
      console.warn("No se pudo mostrar el mensaje inicial:", e);
    }
  });

  try {
    renderFromHistory();
  } catch (e) {
    console.warn("renderFromHistory() falló:", e);
  }

  try {
    rerenderPendingMath();
  } catch {}

  try {
    ensureComposerInteractive();
  } catch {}
  try {
    update();
  } catch {}
  try {
    renderPreview();
  } catch {}

  requestAnimationFrame(() => {
    try {
      // No forzar al final al arrancar: respeta el historial visible
      // scrollEl.scrollTop = 0;
    } catch {}
  });

  setTimeout(() => {
    try {
      rerenderPendingMath();
    } catch {}
  }, 0);
  setTimeout(() => {
    try {
      rerenderPendingMath();
    } catch {}
  }, 300);
}
