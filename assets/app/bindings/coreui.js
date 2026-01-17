// assets/app/bindings/coreui.js
// Centraliza el binding de UI para evitar duplicados.

export function bindCoreUI({
  // DOM
  inp,
  btn,
  kbd,
  pad,
  micBtn,
  btnDeberes,
  btnExamen,
  btnTrabajo,
  scrollEl,

  // deps
  STATE,
  stopMic,
  toggleMic,
  insertAtCursor,

  // features
  initAttach,
  chooseMode,
  MODES,

  // storage/history
  getHistory,
  setHistory,

  // send
  safeSend,

  // helpers/ui
  ensureComposerInteractive,
  autoGrowInput,
  update,
  renderPreview,
  fileToDataURL,

  // pending image
  getPendingImage,
  setPendingImage,

  // attach preview UI
  showAttachPreview,
  hideAttachPreview,

  // layout
  updatePadLayout,
} = {}) {

  let __ttdBound = false;

  return function bindOnce() {
    if (__ttdBound) return;
    __ttdBound = true;

    const ensure = () => {
      try { ensureComposerInteractive && ensureComposerInteractive(); } catch {}
    };

    const scrollToBottom = () => {
      try {
        if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
      } catch {}
    };

    // layout inicial
    try { updatePadLayout && updatePadLayout(); } catch {}

    // ===== INPUT =====
    if (inp) {
      inp.addEventListener("input", () => {
        try { update(); } catch {}
        try { renderPreview(); } catch {}
        try { autoGrowInput(); } catch {}
        ensure();
      });

      inp.addEventListener("keydown", async (e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          try { stopMic(); } catch {}
          await safeSend();
          ensure();
        }
      });
    }

    // ===== ENVIAR =====
    if (btn) {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        try { stopMic(); } catch {}
        await safeSend();
        ensure();
      });
    }

    // ===== MIC =====
    if (micBtn) {
      micBtn.addEventListener("click", (e) => {
        e.preventDefault();
        toggleMic?.({
          onLiveText: () => {
            update?.();
            renderPreview?.();
            autoGrowInput?.();
          }
        });
        ensure();
      });
    }

    // ===== AGENDA =====
    const bindAgenda = (button, mode) => {
      if (!button) return;
      button.addEventListener("click", async (e) => {
        e.preventDefault();
        await chooseMode?.(mode, { inp });
        requestAnimationFrame(scrollToBottom);
        ensure();
      });
    };

    bindAgenda(btnDeberes, MODES?.DEBERES);
    bindAgenda(btnExamen, MODES?.EXAMEN);
    bindAgenda(btnTrabajo, MODES?.TRABAJO);

    // ===== ADJUNTOS =====
    initAttach?.({
      onFile: async (file) => {
        const dataUrl = await fileToDataURL(file);
        setPendingImage({ file, dataUrl });
        showAttachPreview?.(file);
        update?.();
        renderPreview?.();
        ensure();
        requestAnimationFrame(scrollToBottom);
      }
    });

    update?.();
    renderPreview?.();
  };
}