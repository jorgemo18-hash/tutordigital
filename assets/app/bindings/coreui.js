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

  // chat renderer (index.js YA lo pasa, aquí lo recibimos)
  add,
} = {}) {
  let __ttdBound = false;

  return function bindOnce() {
    if (__ttdBound) return;
    __ttdBound = true;

    const ensure = () => {
      try { ensureComposerInteractive && ensureComposerInteractive(); } catch {}
    };

    const isNearBottom = () => {
      try {
        if (!scrollEl) return true;
        const threshold = 120; // px
        return scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - threshold;
      } catch {
        return true;
      }
    };

    const scrollToBottom = () => {
      try {
        try { if (STATE?.isRecording) stopMic(); } catch {}
        if (!scrollEl) return;
        // Solo auto-scroll si el usuario ya estaba cerca del final.
        // Así no “saltamos” y no tapamos la agenda al iniciar/seleccionar modo.
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
      try {
        if (typeof add === "function" && msg) add("assistant", msg);
      } catch {}
      try {
        if (typeof getHistory === "function" && typeof setHistory === "function" && msg) {
          const h = getHistory();
          h.push({ role: "assistant", content: msg });
          setHistory(h);
        }
      } catch {}
      requestAnimationFrame(scrollToBottom);
    };

    // layout inicial
    try { updatePadLayout && updatePadLayout(); } catch {}

    // ===== INPUT =====
    if (inp) {
inp.addEventListener("input", (e) => {
  try {
    // Si el usuario edita a mano (no estamos grabando), deja de ser borrador de dictado
    if (!STATE?.isRecording && e?.isTrusted) {
      STATE.fromDictation = false;
    }
  } catch {}

  try { update?.(); } catch {}
  try { renderPreview?.(); } catch {}
  try { autoGrowInput?.(); } catch {}
  ensure();
});

      inp.addEventListener("keydown", async (e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          try { stopMic?.(); } catch {}
          await safeSend?.();
          ensure();
        }
      });
    }

    // ===== ENVIAR =====
    if (btn) {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        try { stopMic?.(); } catch {}
        await safeSend?.();

        // UX: tras enviar, deja el cursor listo para seguir escribiendo
        try {
          inp && inp.focus && inp.focus();
          try { inp && inp.setSelectionRange && inp.setSelectionRange(0, 0); } catch {}
        } catch {}

        ensure();
      });
    }

        // ===== KBD (∑) / PAD =====
    const setPadOpen = (open) => {
      if (!pad) return;
      pad.classList.toggle("show", !!open);              // ✅ tu CSS usa .show
      pad.setAttribute("aria-hidden", open ? "false" : "true");
      try { updatePadLayout && updatePadLayout(); } catch {}
      try { update && update(); } catch {}
      try { renderPreview?.(); } catch {}
      requestAnimationFrame(scrollToBottom);
      ensure();
    };

    // estado inicial: cerrado
    setPadOpen(false);

    if (kbd) {
      kbd.addEventListener("click", (e) => {
        e.preventDefault();
        try { if (STATE?.isRecording) stopMic?.(); } catch {}
        const isOpen = !!pad?.classList?.contains("show");
        setPadOpen(!isOpen);
      });
    }
    // ===== MIC =====
    if (micBtn) {
    micBtn.addEventListener("click", (e) => {
  e.preventDefault();

  const wasRecording = !!STATE?.isRecording;

  toggleMic?.({
    focusOnStop: true,
    onLiveText: () => {
      try { update?.(); } catch {}
      try { autoGrowInput?.(); } catch {}
    },
  });

  if (wasRecording) {
    try {
      inp && inp.focus && inp.focus();
      const pos = (inp && typeof inp.value === "string") ? inp.value.length : 0;
      try { inp && inp.setSelectionRange && inp.setSelectionRange(pos, pos); } catch {}
    } catch {}
  }

  ensure();
});
    }

    if (pad) {
      // Delegación: cualquier botón con data-i inserta
      pad.addEventListener("click", (e) => {
        const el = e.target?.closest?.("button[data-i]");
        if (!el) return;
        e.preventDefault();
        try { if (STATE?.isRecording) stopMic?.(); } catch {}

        const raw = String(el.getAttribute("data-i") || "");
        if (!raw) return;

        // Cursor dentro de paréntesis/llaves cuando toca
        let cursorOffset = 0;
        if (raw === "()" || raw === "√()" || raw.endsWith("()")) cursorOffset = -1;
        if (raw === "^{}") cursorOffset = -1;

        // Fracción "partido": inserta ()/() y deja el cursor dentro del numerador
        if (raw === "()/()") cursorOffset = -4;

        // Notación científica: inserta ×10^{} y deja el cursor dentro del exponente
        if (raw === "*10^{}" || raw === "×10^{}") cursorOffset = -1;

        try { insertAtCursor?.(raw, cursorOffset); } catch {}
        try { update?.(); } catch {}
        try { renderPreview?.(); } catch {}
        try { autoGrowInput?.(); } catch {}
        ensure();
      });
    }

    // ===== AGENDA =====
    const bindAgenda = (button, mode, label) => {
      if (!button) return;
      button.addEventListener("click", async (e) => {
        e.preventDefault();

        // Elegimos modo
        try { await chooseMode?.(mode, { inp }); } catch {}

        // Feedback en el chat (si add existe)
        if (label) {
          pushAssistant(`Perfecto, vamos con **${label}**. Dime qué tienes que hacer o qué duda te ha salido.`);
        }
        // 📱 UX móvil: si el usuario estaba arriba y pulsa Deberes/Examen/Trabajo,
        // queremos bajar al final SIEMPRE (no usar la heurística de isNearBottom).
        try {
          requestAnimationFrame(scrollToBottomForce);
        } catch {}

        ensure();
      });
    };

    bindAgenda(btnDeberes, MODES?.DEBERES, "Deberes");
    bindAgenda(btnExamen, MODES?.EXAMEN, "Examen");
    bindAgenda(btnTrabajo, MODES?.TRABAJO, "Trabajo");

    // ===== ADJUNTOS =====
    initAttach?.({
      onFile: async (file) => {
        try {
          const dataUrl = await fileToDataURL(file);
          setPendingImage?.({ file, dataUrl });
          showAttachPreview?.(file);
          update?.();
          renderPreview?.();
          ensure();
          requestAnimationFrame(scrollToBottom);
        } catch (err) {
          console.error(err);
        }
      },
    });

    try { update?.(); } catch {}
    try { renderPreview?.(); } catch {}
  };
}