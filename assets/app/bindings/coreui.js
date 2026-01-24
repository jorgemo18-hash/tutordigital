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
  setSelectedTopic,
  getSelectedTopic,
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
  resolveThreadForMode,

  // pending image
  getPendingImage,
  setPendingImage,

  // attach preview UI
  showAttachPreview,

  // layout
  updatePadLayout,

  // chat renderer
  add,
  addTopicChips,
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
    const setSelected = (btn) => {
      const all = [btnDeberes, btnExamen, btnTrabajo].filter(Boolean);
      for (const el of all) {
        el.classList.remove("is-selected");
        try { el.setAttribute("aria-pressed", "false"); } catch {}
      }
      if (btn) {
        btn.classList.add("is-selected");
        try { btn.setAttribute("aria-pressed", "true"); } catch {}
      }
    };

    const buildTopicMessage = (mode, itemText) => {
      const raw = String(itemText || "").trim();
      if (!raw) return "";
      const parts = raw.split("·").map((p) => p.trim()).filter(Boolean);
      const subject = parts[0] || raw;
      const detail = parts.slice(1).join(" · ");
      return detail
        ? `Vamos con ${subject} (${detail}). Empecemos por ahí.`
        : `Vamos con ${subject}. Empecemos por ahí.`;
    };

    const bindAgenda = (button, mode) => {
      if (!button) return;
      button.addEventListener("click", async (e) => {
        e.preventDefault();

        const isDeberes = mode === MODES?.DEBERES;
        const items = isDeberes
          ? Array.from(button.querySelectorAll("li")).map((li) => String(li.textContent || "").trim())
          : [];
        const li = !isDeberes ? e.target?.closest?.("li") : null;
        const itemText = li ? String(li.textContent || "").trim() : "";

        let threadId = "";
        try { threadId = await resolveThreadForMode?.(mode); } catch {}
        if (resolveThreadForMode && !threadId) {
          if (DEBUG) console.warn("[coreui] resolveThreadForMode devolvió vacío", { mode });
        }

        setSelected(button);

        if (isDeberes) {
          const current = typeof getSelectedTopic === "function" ? getSelectedTopic() : "";
          if (current) {
            try {
              await chooseMode?.(mode, {
                inp,
                add,
                getHistory,
                setHistory,
                sendText,
                skipAnnounce: true,
              });
            } catch {}
            try { inp?.focus?.(); } catch {}
            try { requestAnimationFrame(scrollToBottomForce); } catch {}
            ensure();
            return;
          }

          try { setSelectedTopic?.(""); } catch {}
          try {
            await chooseMode?.(mode, {
              inp,
              add,
              getHistory,
              setHistory,
              sendText,
              skipAnnounce: true,
            });
          } catch {}

          if (typeof addTopicChips === "function") {
            addTopicChips(items, {
              onSelect: async ({ subject, detail, full, row }) => {
                const msg = buildTopicMessage(mode, detail ? `${subject} · ${detail}` : subject);
                try { setSelectedTopic?.(full || subject); } catch {}
                if (row && row.remove) {
                  try { row.remove(); } catch {}
                }
                if (msg) {
                  try { await sendText?.(msg); } catch {}
                }
              },
            });
          }

          try { requestAnimationFrame(scrollToBottomForce); } catch {}
          ensure();
          return;
        }

        if (itemText) {
          const current = typeof getSelectedTopic === "function" ? getSelectedTopic() : "";
          if (current && current === itemText) {
            try { inp?.focus?.(); } catch {}
            return;
          }
          try { setSelectedTopic?.(itemText); } catch {}
          try {
            await chooseMode?.(mode, {
              inp,
              add,
              getHistory,
              setHistory,
              sendText,
              skipAnnounce: true,
            });
          } catch {}
          const msg = buildTopicMessage(mode, itemText);
          if (msg) {
            try { await sendText?.(msg); } catch {}
          }
          try { requestAnimationFrame(scrollToBottomForce); } catch {}
          ensure();
          return;
        }

        try {
          await chooseMode?.(mode, { inp, add, getHistory, setHistory, sendText });
        } catch {}

        try { requestAnimationFrame(scrollToBottomForce); } catch {}
        ensure();
      });
    };

    bindAgenda(btnDeberes, MODES?.DEBERES);
    bindAgenda(btnExamen, MODES?.EXAMEN);
    bindAgenda(btnTrabajo, MODES?.TRABAJO);

    // ===== ADJUNTOS =====
    initAttach?.({
      stopRecording: safeStopMic,
      onFile: async (file) => {
        try {
          try { if (STATE?.isRecording) safeStopMic(); } catch {}

          const dataUrl = await fileToDataURL(file);
          setPendingImage?.({ file, dataUrl });
          showAttachPreview?.(file);

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
