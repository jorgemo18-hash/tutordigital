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
  startTypeSelection,
  MODES,

  // storage/history
  getHistory,
  setHistory,

  // send
  safeSend,
  sendText,

  // helpers/ui
  ensureComposerInteractive,
  autoGrowInput,
  update,
  renderPreview,
  fileToDataURL,
  pdfFirstPageToPngDataURL,

  // pending image
  getPendingImage,
  setPendingImage,

  // attach preview UI
  showAttachPreview,

  // layout
  updatePadLayout,

  // chat renderer
  add,
} = {}) {
  let __ttdBound = false;
  const GLOBAL_FLAG = "__ttdCoreUIBound_v1";

  const DEBUG = (() => {
    try { return localStorage.getItem("ttd_debug") === "1"; } catch {}
    return false;
  })();

  const safeStopMic = () => {
    try { stopMic?.(); } catch {}
  };

  return function bindOnce() {
    if (__ttdBound) return;
    if (typeof window !== "undefined" && window[GLOBAL_FLAG]) return;
    __ttdBound = true;
    try { if (typeof window !== "undefined") window[GLOBAL_FLAG] = true; } catch {}

    const sendIn = document.getElementById("sendIn");

    const ensure = () => {
      try { ensureComposerInteractive?.(); } catch {}
    };

    const isNearBottom = () => {
      try {
        if (!scrollEl) return true;
        const threshold = 120;
        return scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - threshold;
      } catch {
        return true;
      }
    };

    const scrollToBottom = () => {
      try {
        if (!scrollEl) return;
        if (!isNearBottom()) return;
        scrollEl.scrollTop = scrollEl.scrollHeight;
      } catch {}
    };

    const scrollToBottomForce = () => {
      try {
        if (!scrollEl) return;
        scrollEl.scrollTop = scrollEl.scrollHeight;
      } catch {}
    };

    const pushAssistant = (msg) => {
      try { if (typeof add === "function" && msg) add("assistant", msg); } catch {}
      try {
        if (typeof getHistory === "function" && typeof setHistory === "function" && msg) {
          const h = getHistory();
          h.push({ role: "assistant", content: msg });
          setHistory(h);
        }
      } catch {}
      requestAnimationFrame(scrollToBottom);
    };

    const syncSendDisabled = () => {
      try { if (sendIn && btn) sendIn.disabled = !!btn.disabled; } catch {}
    };

    const focusInputEnd = () => {
      try {
        if (!inp) return;
        inp.focus?.();
        const pos = typeof inp.value === "string" ? inp.value.length : 0;
        try { inp.setSelectionRange?.(pos, pos); } catch {}
      } catch {}
    };

    const doSend = async (e) => {
      try { e?.preventDefault?.(); } catch {}
      try { e?.stopPropagation?.(); } catch {}

      const isMobile = () =>
        !!window.matchMedia && window.matchMedia("(max-width: 720px)").matches;
      const wasTyping = (document.activeElement === inp);

      safeStopMic();
      await safeSend?.();
      try { requestAnimationFrame(scrollToBottomForce); } catch {}

      // Si estabas escribiendo, mantén cursor listo.
      // Si NO estabas escribiendo (dictado), NO abras teclado en móvil.
      if (!isMobile() || wasTyping) {
        try { queueMicrotask(focusInputEnd); } catch {}
        try { setTimeout(focusInputEnd, 0); } catch {}
      } else {
        try { inp?.blur?.(); } catch {}
      }

      syncSendDisabled();
      ensure();
    };

    // layout inicial
    try { updatePadLayout?.(); } catch {}

    // ===== INPUT =====
    if (inp) {
      inp.addEventListener("input", (e) => {
        try {
          if (!STATE?.isRecording && e?.isTrusted) STATE.fromDictation = false;
        } catch {}

        try { update?.(); } catch {}
        try { renderPreview?.(); } catch {}
        syncSendDisabled();
        try { autoGrowInput?.(); } catch {}
        ensure();
      });

      inp.addEventListener("keydown", async (e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          await doSend(e);
        }
      });
    }

    // ===== ENVIAR =====
    btn?.addEventListener?.("click", doSend);
    sendIn?.addEventListener?.("click", doSend);

    // ===== KBD / PAD =====
    const setPadOpen = (open) => {
      if (!pad) return;
      pad.classList.toggle("show", !!open);
      pad.setAttribute("aria-hidden", open ? "false" : "true");
      try { updatePadLayout?.(); } catch {}
      try { update?.(); } catch {}
      try { renderPreview?.(); } catch {}
      requestAnimationFrame(scrollToBottom);
      ensure();
    };

    setPadOpen(false);

    kbd?.addEventListener?.("click", (e) => {
      e.preventDefault();
      try { if (STATE?.isRecording) safeStopMic(); } catch {}
      const isOpen = !!pad?.classList?.contains("show");
      setPadOpen(!isOpen);
    });

    // ===== MIC =====
    micBtn?.addEventListener?.("click", (e) => {
      try { e.preventDefault(); } catch {}
      try { e.stopPropagation(); } catch {}

      toggleMic?.({
        focusOnStop: false,
        onLiveText: () => {
          try { update?.(); } catch {}
          try { autoGrowInput?.(); } catch {}
        },
      });

      ensure();
    });

    // ===== PAD buttons =====
    pad?.addEventListener?.("click", (e) => {
      const el = e.target?.closest?.("button[data-i]");
      if (!el) return;
      e.preventDefault();

      try { if (STATE?.isRecording) safeStopMic(); } catch {}

      const raw = String(el.getAttribute("data-i") || "");
      if (!raw) return;

      let cursorOffset = 0;
      if (raw === "()" || raw === "√()" || raw.endsWith("()")) cursorOffset = -1;
      if (raw === "^{}") cursorOffset = -1;
      if (raw === "()/()") cursorOffset = -4;
      if (raw === "*10^{}" || raw === "×10^{}") cursorOffset = -1;

      try { insertAtCursor?.(raw, cursorOffset); } catch {}
      try { update?.(); } catch {}
      try { renderPreview?.(); } catch {}
      syncSendDisabled();
      try { autoGrowInput?.(); } catch {}
      ensure();
    });

    // ===== AGENDA =====
    // Los clics en tareas individuales los gestiona initAgendaTaskHandlers (abre el modal).
    // Pinchar el bloque sin apuntar a una tarea concreta no hace nada.

    // ===== ADJUNTOS =====
    initAttach?.({
      stopRecording: safeStopMic,
      onFile: async (file) => {
        try {
          try { if (STATE?.isRecording) safeStopMic(); } catch {}

          // Feedback inmediato: mostramos preview mientras procesamos
          showAttachPreview?.({
            file,
            fileName: file?.name,
            fileMime: file?.type,
            state: "loading",
          });

          const dataUrl = await fileToDataURL(file);
          let pdfImageDataUrl = null;
          try {
            if (file?.type === "application/pdf" && typeof pdfFirstPageToPngDataURL === "function") {
              pdfImageDataUrl = await pdfFirstPageToPngDataURL(file);
            }
          } catch {}
          setPendingImage?.({ file, dataUrl, pdfImageDataUrl });
          const previewDataUrl =
            (file?.type || "").startsWith("image/") ? dataUrl : pdfImageDataUrl || null;
          showAttachPreview?.({
            file,
            fileDataUrl: previewDataUrl,
            fileName: file?.name,
            fileMime: file?.type,
            state: "ready",
          });

          update?.();
          renderPreview?.();
          syncSendDisabled();
          ensure();
          requestAnimationFrame(scrollToBottom);
        } catch (err) {
          console.error(err);
        }
      },
    });

    // final
    try { update?.(); } catch {}
    try { renderPreview?.(); } catch {}
    syncSendDisabled();

    if (DEBUG) console.log("[coreui] bound");
  };
}
