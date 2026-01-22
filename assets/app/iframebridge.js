// assets/app/iframebridge.js

/**
 * Configura el puente postMessage entre el iframe (app.html) y el padre (index.html).
 *
 * Seguridad:
 * - Verifica `event.source === window.parent`.
 * - Opcionalmente verifica `event.origin` contra `expectedOrigin`.
 *
 * @param {Object} deps
 * @param {HTMLTextAreaElement|HTMLInputElement} deps.inp
 * @param {(text: string, cursorOffset?: number) => void} deps.insertAtCursor
 * @param {() => void} deps.update
 * @param {() => void} deps.renderPreview
 * @param {() => void|Promise<void>} deps.safeSend
 * @param {string|string[]} [deps.expectedOrigin] - Origen permitido (p.ej. window.location.origin). Si es '*', se permite cualquiera.
 * @param {boolean} [deps.debug=false] - Loguea mensajes entrantes para QA.
 * @returns {() => void} cleanup
 */
export function setupIframeBridge({
  inp,
  insertAtCursor,
  update,
  renderPreview,
  safeSend,
  expectedOrigin,
  debug = false,
} = {}) {
  const allowedOrigins = (() => {
    if (!expectedOrigin) return null;      // comportamiento actual: sin validación por origin
    if (expectedOrigin === "*") return "*";
    const list = Array.isArray(expectedOrigin) ? expectedOrigin : [expectedOrigin];
    return new Set(list.map((s) => String(s || "").trim()).filter(Boolean));
  })();

  function originAllowed(origin) {
    if (!allowedOrigins) return true;
    if (allowedOrigins === "*") return true;
    return allowedOrigins.has(String(origin || ""));
  }

  function focusInput() {
    try { inp && inp.focus && inp.focus(); } catch {}
  }

  function setFullscreen(payload) {
    try {
      const on = !!(payload && payload.fullscreen);
      document.body.classList.toggle("fullscreen", on);
    } catch {}
  }

  function insert(payload) {
    const text = String(payload?.text ?? "");
    const cursorOffset = Number(payload?.cursorOffset || 0) || 0;

    try { typeof insertAtCursor === "function" && insertAtCursor(text, cursorOffset); } catch {}
    try { typeof update === "function" && update(); } catch {}
    try { typeof renderPreview === "function" && renderPreview(); } catch {}
  }

  function moveCursor(payload) {
    try {
      const pos = Number(payload?.pos);
      if (!inp || !Number.isFinite(pos)) return;
      inp.focus && inp.focus();
      inp.setSelectionRange && inp.setSelectionRange(pos, pos);
    } catch {}
  }

  async function sendText(payload) {
    try {
      // El parent puede mandar texto ya puesto, o pedir que se envíe lo que hay.
      const text = typeof payload?.text === "string" ? payload.text : null;

      if (typeof text === "string" && inp) {
        inp.value = text;
        try { typeof update === "function" && update(); } catch {}
        try { typeof renderPreview === "function" && renderPreview(); } catch {}
      }

      if (typeof safeSend === "function") {
        await safeSend();
      }
    } catch {}
  }

  const handlers = {
    focusInput,
    setFullscreen,
    insert,
    moveCursor,
    sendText,

    // Aliases compatibilidad (por si el padre manda nombres antiguos)
    focus: focusInput,
    setFullScreen: setFullscreen,
    fullscreen: setFullscreen,
  };

  function onMessage(event) {
    // ✅ Seguridad principal: solo aceptamos mensajes del parent
    if (event.source !== window.parent) return;

    // ✅ Seguridad extra (opcional): valida origin
    // OJO: si usas file:// o entornos raros, esto puede bloquear; por eso es opcional.
    if (!originAllowed(event.origin)) return;

    const data = event.data;
    const type = typeof data === "string" ? data : data?.type;
    if (!type) return;

    if (debug) {
      try {
        console.log("[bridge] message", { type, origin: event.origin, data });
      } catch {}
    }

    const fn = handlers[type];
    if (typeof fn !== "function") return;

    try {
      fn(data);
    } catch {}
  }

  window.addEventListener("message", onMessage);

  // Cleanup (por si en el futuro esto vive en una SPA)
  return function cleanupIframeBridge() {
    try { window.removeEventListener("message", onMessage); } catch {}
  };
}