// assets/lib/input.js
// Helpers de inserción en el input (cursor-aware) y teclados.

export function createInputHelpers({ inp, update, renderPreview, ensureInteractive } = {}) {
  function afterInsertFocus() {
    try { inp && inp.focus(); } catch {}
    try { typeof update === "function" && update(); } catch {}
    try { typeof renderPreview === "function" && renderPreview(); } catch {}
    // refuerzo: si algún flujo lo bloquea, lo reactivamos
    try { queueMicrotask(() => typeof ensureInteractive === "function" && ensureInteractive()); } catch {}
    try { setTimeout(() => typeof ensureInteractive === "function" && ensureInteractive(), 0); } catch {}
  }

  function insertAtCursor(value, cursorOffset = 0) {
    if (!inp) return;

    const v = String(value ?? "");
    const start = typeof inp.selectionStart === "number" ? inp.selectionStart : inp.value.length;
    const end = typeof inp.selectionEnd === "number" ? inp.selectionEnd : inp.value.length;

    const before = inp.value.slice(0, start);
    const after = inp.value.slice(end);
    inp.value = before + v + after;

    const pos = Math.max(0, Math.min((before + v).length + cursorOffset, inp.value.length));
    try { inp.setSelectionRange(pos, pos); } catch {}

    afterInsertFocus();
  }

  function insertWithCursor(text, cursorAt) {
    if (!inp) return;

    const start = typeof inp.selectionStart === "number" ? inp.selectionStart : inp.value.length;
    const end = typeof inp.selectionEnd === "number" ? inp.selectionEnd : inp.value.length;

    const before = inp.value.slice(0, start);
    const after = inp.value.slice(end);

    inp.value = before + text + after;

    const pos = Math.max(0, Math.min(start + cursorAt, inp.value.length));
    try { inp.setSelectionRange(pos, pos); } catch {}

    afterInsertFocus();
  }

  return { insertAtCursor, insertWithCursor };
}