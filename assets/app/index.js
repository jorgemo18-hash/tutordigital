// assets/app/index.js
import { DOM, STATE, APP_VERSION } from "../lib/state.js";
import { getHistory, setHistory, ensureToday } from "../lib/storage.js";
import { asciiToLatex, looksMath } from "../lib/math.js";
import { toggleMic, stopMic } from "../lib/mic.js";
import { initAttach, detectFileKind } from "../features/attach/attach.js";
import { createPreviewRenderer } from "../lib/preview.js";
import { createInputHelpers } from "../lib/input.js";
import { createTyping } from "./typing.js";
import { createChatRenderer, createComposerHelpers } from "./modes.js";
import { createAttachmentUI } from "./attachmentsui.js";
import { setupIframeBridge } from "./iframebridge.js";
import { setupIOSViewportFix } from "../ui/iosviewportfix.js";
import { askGPT } from "../features/chat/chatapi.js";
import { bindCoreUI } from "./bindings/coreui.js";

import {
  MODES,
  currentMode,
  modeChosen,
  showModeQuestion,
  chooseMode,
  setPendingFirstQuestion,
} from "../features/mode/mode.js";

console.log("✅ index.js imports OK");
console.log("✅ app.js cargado");

// Version (visible en UI y útil para QA)
try {
  console.log(`📌 Tutordigital v${APP_VERSION}`);
  const subEl = document.querySelector("header .sub");
  if (subEl && !subEl.textContent.includes(`v${APP_VERSION}`)) {
    subEl.textContent = `${subEl.textContent} · v${APP_VERSION}`;
  }
} catch {}

// =========================
//  iOS: mantener el composer visible incluso con teclado abierto
// =========================
try {
  setupIOSViewportFix();
} catch (e) {
  console.warn("setupIOSViewportFix() falló (no bloquea la app):", e);
}

// =========================
//  Stop mic when leaving / minimizing / closing
// =========================
try {
  // When tab/iframe becomes hidden (minimize, change tab, close modal)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      try { stopMic(); } catch {}
    }
  });

  // When window/iframe loses focus
  window.addEventListener("blur", () => {
    try { stopMic(); } catch {}
  });
} catch {}

const {
  chat,
  messages,
  inp,
  btn,
  kbd,
  pad,
  eqPreview,
  micBtn,
  agenda,
  initialRow,
  btnDeberes,
  btnExamen,
  btnTrabajo,
} = DOM;

// =========================
//  Stop mic when clicking "Inicio" back button in header
// =========================
try {
  const backBtn = document.querySelector("header .back");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      try { stopMic(); } catch {}
    });
  }
} catch {}

const scrollEl = chat; // main con scroll
const chatList = messages || chat; // donde pintamos burbujas
// Estado adjunto actual (imagen)
let pendingImage = null;

// =========================
//  Helpers: adjuntos (detección única)
// =========================
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

function getPendingAttachmentInfo(p) {
  const file = p?.file || null;
  const has = !!file;
  const type = String(file?.type || "");
  const name = String(file?.name || "");

  const isImage = /^image\//.test(type);

  const isPDF = type === "application/pdf" || (!type && /\.pdf$/i.test(name));

  const isDocx = type === DOCX_MIME || (!type && /\.docx$/i.test(name));

  // “Aceptamos” (UX) pero NO soportamos aún en backend:
  const isXlsx = type === XLSX_MIME || (!type && /\.xlsx$/i.test(name));
  const isPptx = type === PPTX_MIME || (!type && /\.pptx$/i.test(name));

  const isWord = isDocx;

  // Solo esto lo tratamos como soportado para enviar al backend:
  const isSupportedForBackend = isImage || isPDF || isWord;

  return {
    has,
    file,
    type,
    name,
    isImage,
    isPDF,
    isDocx,
    isWord,
    isXlsx,
    isPptx,
    isSupportedForBackend,
  };
}

function safeStopMic() {
  try { stopMic(); } catch {}
}
// =========================
//  Composer helpers (extraídos)
// =========================
const __composer = createComposerHelpers({
  inp,
  btn,
  pad,
  getModeChosen: () => modeChosen,
  getPendingImage: () => pendingImage,
});

const {
  autoGrowInput,
  update,
  ensureComposerInteractive,
  updatePadLayout,
} = __composer;

// iOS/layout: el footer sube exactamente lo que mida el pad
window.__ttdUpdateLayout = updatePadLayout;
try {
  window.addEventListener("resize", () => requestAnimationFrame(updatePadLayout));
} catch {}
try {
  requestAnimationFrame(updatePadLayout);
} catch {}

// Placeholders de UI (se inicializan más abajo)
let showTyping = () => {};
let hideTyping = () => {};
let showAttachPreview = () => {};
let hideAttachPreview = () => {};

// aplica ya al cargar
ensureComposerInteractive();
update();

// =========================
//  Helpers (preview + inserción)
// =========================
const { renderPreview } = createPreviewRenderer({
  inp,
  eqPreview,
  looksMath,
  asciiToLatex,
});

const { insertAtCursor } = createInputHelpers({
  inp,
  update,
  renderPreview,
  ensureInteractive: ensureComposerInteractive,
});

// =========================
//  UI helpers (renderer): extraídos a mod.js
// =========================
const __chatUI = createChatRenderer({
  chatList,
  scrollEl,
  looksMath,
  asciiToLatex,
  getHistory,
  setHistory,
});

const add = __chatUI.add;
const addImageAttachment = __chatUI.addImageAttachment;
const renderFromHistory = __chatUI.renderFromHistory;
const rerenderPendingMath = __chatUI.rerenderPendingMath;

// Mensaje inicial (si no hay historial)
queueMicrotask(() => {
  try {
    const hist = getHistory();
    if (!Array.isArray(hist) || hist.length === 0) {
      const msg = "¿En qué te ayudo hoy? Elige una opción arriba.";
      add("assistant", msg);
      const h = getHistory();
      h.push({ role: "assistant", content: msg });
      setHistory(h);
      // ✅ En móvil, algunos renders hacen auto-scroll al añadir el primer mensaje.
      // Fuerza arriba varias veces (RAF + timeouts) para neutralizar ese empujón.
      try {
        requestAnimationFrame(() => {
          try { scrollEl.scrollTop = 0; } catch {}
        });
        setTimeout(() => { try { scrollEl.scrollTop = 0; } catch {} }, 60);
        setTimeout(() => { try { scrollEl.scrollTop = 0; } catch {} }, 220);
      } catch {}
    }
  } catch (e) {
    console.warn("No se pudo mostrar el mensaje inicial:", e);
  }
});

// =========================
//  Envío robusto (mínimo)
// =========================
async function safeSend() {
  // Si el dictado está activo, lo paramos para evitar resultados tardíos que pisan el envío
  try { if (STATE?.isRecording) stopMic(); } catch {}

  const text = (inp?.value || "").trim();
  const a = getPendingAttachmentInfo(pendingImage);
  const hasFile = a.hasAttach;

  // Defensa extra: si entra un adjunto raro, no llamamos al backend.
  if (hasFile && !(a.isImage || a.isPDF || a.isWord)) {
    const name = String(a.name || "archivo");
    const msg =
      `No puedo leer ese archivo ("${name}"). ` +
      `Prueba a exportarlo como foto, DOCX o PDF. ` +
      `Si quieres, dime qué formato es y te ayudo a convertirlo.`;

    try { add("assistant", msg); } catch {}
    try {
      const h = getHistory();
      h.push({ role: "assistant", content: msg });
      setHistory(h);
    } catch {}

    pendingImage = null;
    try { hideAttachPreview(); } catch {}
    try { update(); } catch {}
    try { renderPreview(); } catch {}
    return;
  }

  if (!text && !hasFile) return;

  // Limpia el input YA (UX)
  try {
    inp.value = "";
    update();
    renderPreview();
  } catch {}

  // Ajusta altura del textarea tras limpiar (especialmente en iOS)
  try {
    if (inp) inp.style.height = "auto";
    autoGrowInput();
  } catch {}

  // Confirmación visual inmediata si hay adjunto
  try {
    if (hasFile) {
      if (a.isImage) {
        addImageAttachment(a.file);
        if (text) {
          add("user", text);
          const hU = getHistory();
          hU.push({ role: "user", content: text });
          setHistory(hU);
        }
      } else if (a.isPDF || a.isWord) {
        const name = String(a.name || (a.isPDF ? "PDF" : "Word"));
        add("user", name);
        const hU = getHistory();
        hU.push({ role: "user", content: name });
        setHistory(hU);

        if (text) {
          add("user", text);
          const hU2 = getHistory();
          hU2.push({ role: "user", content: text });
          setHistory(hU2);
        }
      }
      try { hideAttachPreview(); } catch {}
    }
  } catch {}

  // Al enviar, siempre tratamos el contenido como texto normal (no dictado)
  STATE.fromDictation = false;

  // Si no han elegido modo, guardamos su primera pregunta y pedimos elección
  if (!modeChosen) {
    try { setPendingFirstQuestion(text); } catch {}
    try { showModeQuestion({ add }); } catch {}
    return;
  }

  // Envío real
  try {
    if (typeof sendText === "function") {
      if (hasFile) {
        const userText = text;
        const internal = a.isImage
          ? (
              "Analiza la imagen adjunta y ayúdame con ello. " +
              "Resume lo importante y contesta la pregunta si la hay." +
              (userText ? `\n\nTexto del alumno: ${userText}` : "")
            )
          : (
              "Analiza el archivo adjunto (PDF/Word) y ayúdame con ello. " +
              "Resume lo importante y contesta la pregunta si la hay." +
              (userText ? `\n\nPregunta/nota del alumno: ${userText}` : "")
            );
        await sendText(internal, { silentUser: true });
      } else {
        await sendText(text);
      }

      setTimeout(() => {
        try { inp && inp.focus(); } catch {}
      }, 0);
      return;
    }
  } catch (err) {
    console.error("sendText() falló:", err);
  }

  // último recurso: pinta la burbuja del usuario para no perderlo
  try {
    if (text) {
      add("user", text);
      const hist = getHistory();
      hist.push({ role: "user", content: text });
      setHistory(hist);
    }
    inp.value = "";
    update();
    renderPreview();
  } catch (e) {
    console.error("No se pudo enviar ni pintar el mensaje:", e);
  }
}
// =========================
//  UI módulos (typing + adjuntos + bridge iframe)
// =========================
const __typing = createTyping({ chatList, scrollEl });
showTyping = __typing.showTyping;
hideTyping = __typing.hideTyping;

const __attachUI = createAttachmentUI({
  inp,
  update,
  onClear: () => {
    pendingImage = null;
  },
});
showAttachPreview = __attachUI.showAttachPreview;
hideAttachPreview = __attachUI.hideAttachPreview;

// Si cambiamos entre móvil/desktop, recoloca el preview donde toca
window.addEventListener("resize", () => {
  try {
    if (typeof __attachUI?.reflowPreview === "function") __attachUI.reflowPreview();
  } catch {}
});

setupIframeBridge({
  inp,
  insertAtCursor,
  update,
  renderPreview,
  safeSend,
  expectedOrigin: window.location.origin,
  debug: false,
});
// ✅ binding único (coreUI.js)
const bindOnce = bindCoreUI({
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

  // storage/history (para mode y para pintar)
  getHistory,
  setHistory,

  // send (coreUI llama a safeSend)
  safeSend,
  sendText,

  // helpers/ui
  ensureComposerInteractive,
  autoGrowInput,
  update,
  renderPreview,
  fileToDataURL,

  // pending image (para que coreUI.js no “toque” variables del index)
  getPendingImage: () => pendingImage,
  setPendingImage: (v) => {
    pendingImage = v;
  },

  // attach preview UI
  showAttachPreview,
  hideAttachPreview,

  // layout
  updatePadLayout,

  // chat renderer
  add,
  addImageAttachment,
});

bindOnce();

// =========================
//  Enter envía / Shift+Enter salto de línea
// =========================
try {
  if (inp && !inp.dataset.ttdEnterSend) {
    inp.dataset.ttdEnterSend = "1";
    inp.addEventListener("keydown", (e) => {
      // Enter envía; Shift+Enter hace salto de línea
      if (e.key === "Enter" && !e.shiftKey) {
        // Evita interferir con IME / composición
        if (e.isComposing) return;
        e.preventDefault();
        try { safeSend(); } catch {}
      }
    });
  }
} catch {}

// =========================
//  Helpers adjuntos
// =========================
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
try {
  window.addEventListener("ttd:attach-invalid", (ev) => {
    const f = ev?.detail?.file;
    const name = String(f?.name || "archivo");
    // const type = String(f?.type || "");

    const msg =
      `No puedo leer ese archivo ("${name}"). ` +
      `Prueba a exportarlo como foto, DOCX o PDF. ` +
      `Si quieres, dime qué formato es y te ayudo a convertirlo.`;

    try { add("assistant", msg); } catch {}
    try {
      const h = getHistory();
      h.push({ role: "assistant", content: msg });
      setHistory(h);
    } catch {}
    // Importante: si había un adjunto anterior “enganchado”, lo limpiamos para evitar envíos fantasma
pendingImage = null;
try { hideAttachPreview(); } catch {}
try { update(); } catch {}
try { renderPreview(); } catch {}
  });
} catch {}

// =========================
//  Debug helpers (errores más útiles)
// =========================
const __TTD_DEBUG = (() => {
  try {
    const qs = String(window.location.search || "");
    if (/(?:\?|&)debug=1(?:&|$)/.test(qs)) {
      try { localStorage.setItem("ttd_debug", "1"); } catch {}
      return true;
    }
    try { return localStorage.getItem("ttd_debug") === "1"; } catch {}
  } catch {}
  return false;
})();

function formatChatError(err, { isPDF, isImage, isDocx } = {}) {
  const status = Number(err?.status || err?.statusCode || err?.response?.status || 0) || 0;
  const code = String(err?.code || "").trim();
  const msg = String(err?.message || "").trim();

  // Casos típicos (mensajes pensados para alumnos)
  if (isPDF) {
    // Archivo no válido / no soportado / no se pudo leer
    if (
      /unsupported|invalid_request|file|mime|format/i.test(code) ||
      /no contiene base64|dataurl|unsupported|invalid|file|pdf/i.test(msg) ||
      status === 400
    ) {
      return "Ese archivo ahora mismo no lo puedo leer. Prueba a exportarlo como PDF otra vez o envíame una foto de la página. Si me dices qué formato era (Word/Excel/etc.), te digo cómo convertirlo.";
    }
    // Archivo demasiado grande
    if (status === 413 || /too large|payload too large|maximum/i.test(msg)) {
      return "El archivo es demasiado grande. Prueba con un PDF más pequeño o envía una foto de la página.";
    }
  }
  if (isDocx) {
  if (
    /unsupported|invalid_request|file|mime|format/i.test(code) ||
    /unsupported|invalid|file|docx|word/i.test(msg) ||
    status === 400
  ) {
    return "Ese Word ahora mismo no lo puedo leer bien. Prueba a exportarlo como PDF o envíame una foto de la página. Si me dices desde qué app lo has sacado (Word/Google Docs/etc.), te digo cómo convertirlo.";
  }
  if (status === 413 || /too large|payload too large|maximum/i.test(msg)) {
    return "El Word es demasiado grande. Prueba a exportarlo como PDF más pequeño o envía una foto de la página.";
  }
}

  // Autenticación / configuración (esto es más de ‘nosotros’ que del alumno)
  if (code === "invalid_api_key" || code === "authentication_error" || status === 401) {
    return "Ahora mismo el servicio no puede responder. Inténtalo otra vez en un minuto.";
  }

  // Rate limit
  if (code === "rate_limit_exceeded" || status === 429) {
    return "Hay mucha carga ahora mismo. Espera unos segundos y prueba otra vez.";
  }

  // Por defecto
  return "No he podido responder ahora mismo.";
}
// =========================
// =========================
//  Backend /api/chat
// =========================
async function sendText(text, opts = {}) {
  ensureToday();

  const t = String(text || "").trim();
  const a = getPendingAttachmentInfo(pendingImage);
  const hasFile = a.hasAttach;

  if (!t && !hasFile) return;

  const silentUser = !!opts.silentUser;

  // Defensa extra: si llega un adjunto no soportado, no intentes llamar al backend.
  if (hasFile && !(a.isImage || a.isPDF || a.isWord)) {
    if (!silentUser) {
      const name = String(a.name || "archivo");
      const msg =
        `No puedo leer ese archivo ("${name}"). ` +
        `Prueba a exportarlo como foto, DOCX o PDF. ` +
        `Si quieres, dime qué formato es y te ayudo a convertirlo.`;

      try { add("assistant", msg); } catch {}
      try {
        const h = getHistory();
        h.push({ role: "assistant", content: msg });
        setHistory(h);
      } catch {}
    }

    pendingImage = null;
    try { hideAttachPreview(); } catch {}
    try { update(); } catch {}
    try { renderPreview(); } catch {}
    return;
  }

  if (!modeChosen && !silentUser) {
    const msg = "Primero elige una opción arriba.";
    add("assistant", msg);
    const h0 = getHistory();
    h0.push({ role: "assistant", content: msg });
    setHistory(h0);
    update();
    return;
  }

  if (!silentUser && t) {
    add("user", t);
    const h = getHistory();
    h.push({ role: "user", content: t });
    setHistory(h);
  }

  if (!silentUser && hasFile && !t && a.isImage) {
    try { addImageAttachment(a.file); } catch {}
  }

  try { btn && (btn.disabled = true); } catch {}
  try { showTyping(); } catch {}

  try {
    const imageDataUrl = a.isImage ? (a.dataUrl || null) : null;

    const isFile = a.isPDF || a.isDocx;
    const fileDataUrl = isFile ? (a.dataUrl || null) : null;
    const fileName = isFile
      ? String(a.name || (a.isPDF ? "archivo.pdf" : "archivo.docx"))
      : undefined;

    const fileMime = isFile
      ? (a.isPDF ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
      : undefined;

    let modelText = t;

    // Si alguien llama sendText() con imagen y sin silentUser (fallback), añade instrucción.
    if (imageDataUrl && !silentUser) {
      modelText =
        "Analiza la imagen adjunta y ayúdame con ello." +
        (t ? `\n\nTexto del alumno: ${t}` : "");
    }

    const answer = await askGPT({
      text: modelText,
      imageDataUrl,
      fileDataUrl,
      fileName,
      fileMime,
      mode: currentMode,
    });

    add("assistant", answer);

    const h2 = getHistory();
    h2.push({ role: "assistant", content: answer });
    setHistory(h2);

    pendingImage = null;
    try { hideAttachPreview(); } catch {}

  } catch (err) {
    try {
      console.error("sendText error:", {
        message: err?.message,
        status: err?.status,
        code: err?.code,
        request_id: err?.request_id,
        raw: err?._raw,
      });
    } catch {
      console.error(err);
    }

    let msg = formatChatError(err, { isPDF: a.isPDF, isImage: a.isImage, isDocx: a.isDocx });

    if (__TTD_DEBUG && err?.request_id) {
      msg += ` (ref: ${String(err.request_id).slice(-12)})`;
    }

    add("assistant", msg);
    const hE = getHistory();
    hE.push({ role: "assistant", content: msg });
    setHistory(hE);

  } finally {
    try { hideTyping(); } catch {}
    try { update(); } catch {}
    try { renderPreview(); } catch {}
    try { autoGrowInput(); } catch {}
    try { rerenderPendingMath(); } catch {}

    setTimeout(() => {
      try { inp && inp.focus(); } catch {}
    }, 0);
  }
}

// =========================
//  BOOT
// =========================
(function boot() {
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
      // (si quieres arrancar arriba del todo)
      // scrollEl.scrollTop = 0;

      // O si prefieres arrancar en el final SOLO la primera vez,
      // coméntalo aquí y ya controlas el scroll con add().
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
})();
