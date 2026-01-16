// assets/app/IframeBridge.js
// Puente con el PADRE (index.html) via postMessage.

export function setupIframeBridge({ inp, insertAtCursor, update, renderPreview, safeSend } = {}) {
  window.addEventListener("message", async (event) => {
    const data = event.data;
    if (!data) return;

    if (data === "focusInput" || data?.type === "focusInput") {
      try { inp && inp.focus(); } catch {}
      return;
    }

    if (data?.type === "setFullscreen") {
      const on = !!data.on;
      try { document.body.classList.toggle("fullscreenApp", on); } catch {}
      return;
    }

    if (data?.type === "insert") {
      try {
        if (typeof insertAtCursor === "function") insertAtCursor(String(data.value ?? ""), 0);
      } catch (e) { console.error(e); }
      return;
    }

    if (data?.type === "moveCursor") {
      const off = Number(data.offset || 0);
      try {
        const pos = (typeof inp.selectionStart === "number" ? inp.selectionStart : inp.value.length) + off;
        const p = Math.max(0, Math.min(pos, inp.value.length));
        inp.setSelectionRange(p, p);
        inp.focus();
        if (typeof update === "function") update();
        if (typeof renderPreview === "function") renderPreview();
      } catch (e) { console.error(e); }
      return;
    }

    if (data?.type === "sendText") {
      try {
        const t = String(data.text ?? "").trim();
        if (!t) return;
        inp.value = t;
        if (typeof update === "function") update();
        if (typeof renderPreview === "function") renderPreview();
        if (typeof safeSend === "function") await safeSend();
      } catch (e) { console.error(e); }
      return;
    }
  });
}