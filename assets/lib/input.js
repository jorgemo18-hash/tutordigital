// assets/lib/input.js
// Helpers de inserción en el input (cursor-aware) y teclados.

export function createInputHelpers({ inp, update, renderPreview, ensureInteractive } = {}) {
  function triggerInput() {
    try { inp && inp.dispatchEvent(new Event("input", { bubbles: true })); } catch {}
  }

  function afterInsertFocus() {
    if (!inp || typeof inp.value !== "string") return;
    try { inp && inp.focus(); } catch {}
    try { typeof update === "function" && update(); } catch {}
    try { typeof renderPreview === "function" && renderPreview(); } catch {}
    try { triggerInput(); } catch {}
    // refuerzo: si algún flujo lo bloquea, lo reactivamos
    try { queueMicrotask(() => typeof ensureInteractive === "function" && ensureInteractive()); } catch {}
    try { setTimeout(() => typeof ensureInteractive === "function" && ensureInteractive(), 0); } catch {}
  }

  function insertAtCursor(value, cursorOffset = 0) {
    if (!inp || typeof inp.value !== "string") return;

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
    if (!inp || typeof inp.value !== "string") return;

    const start = typeof inp.selectionStart === "number" ? inp.selectionStart : inp.value.length;
    const end = typeof inp.selectionEnd === "number" ? inp.selectionEnd : inp.value.length;

    const before = inp.value.slice(0, start);
    const after = inp.value.slice(end);

    inp.value = before + text + after;

    const pos = Math.max(0, Math.min(start + cursorAt, inp.value.length));
    try { inp.setSelectionRange(pos, pos); } catch {}

    afterInsertFocus();
  }

  function replaceSelection(prefix, suffix, cursorOffset = 0) {
    if (!inp || typeof inp.value !== "string") return;
    const start = typeof inp.selectionStart === "number" ? inp.selectionStart : inp.value.length;
    const end = typeof inp.selectionEnd === "number" ? inp.selectionEnd : inp.value.length;

    const before = inp.value.slice(0, start);
    const selected = inp.value.slice(start, end);
    const after = inp.value.slice(end);

    const next = before + String(prefix ?? "") + selected + String(suffix ?? "") + after;
    inp.value = next;

    const basePos = (before + String(prefix ?? "") + selected).length;
    const pos = Math.max(0, Math.min(basePos + cursorOffset, inp.value.length));
    try { inp.setSelectionRange(pos, pos); } catch {}

    afterInsertFocus();
  }

  return { insertAtCursor, insertWithCursor, replaceSelection };
}
