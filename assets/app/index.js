// assets/app/index.js
import { DOM, STATE, APP_VERSION } from "./state/state.js";
import { getHistory, setHistory, ensureToday } from "./state/storage.js";
import { asciiToLatex, looksMath } from "./controllers/math.js";
import { toggleMic, stopMic } from "./controllers/mic.js";
import { initAttach } from "./attachments/attach.js";
import { createPreviewRenderer } from "./ui/preview.js";
import { createInputHelpers } from "./ui/input.js";
import { createTyping } from "./ui/typing.js";
import { createChatRenderer } from "./render/chatRenderer.js";
import { createComposerHelpers } from "./controllers/composer.js";
import { createAttachmentUI } from "./attachments/attachmentsui.js";
import { setupIframeBridge } from "./bridge/iframebridge.js";
import {
  createSendController,
  installAttachInvalidHandler,
  installMicErrorHandler,
} from "./controllers/send.js";
import { createInitialScrollLock, runInitialBoot } from "./boot/initial.js";
import { askGPT } from "../features/chat/chatapi.js";
import { bindCoreUI } from "./bindings/coreui.js";

import {
  MODES,
  currentMode,
  modeChosen,
  showModeQuestion,
  chooseMode,
  setPendingFirstQuestion,
} from "./controllers/mode.js";

// =====================================================
// iOS/Safari viewport fix (inline)
// Motivo: en Vercel (Linux) los nombres de fichero son case-sensitive,
// y una discrepancia de mayúsculas/minúsculas en `iosViewportFix.js`
// provoca 404 y `SyntaxError: Unexpected token '<'`.
// Mantenerlo inline evita que el deploy se rompa por casing.
// Expone CSS vars:
//   --kb   (px del teclado)
//   --padH (altura del pad cuando está abierto)
// =====================================================
function setupIOSViewportFix() {
  const vv = window.visualViewport;
  const padEl = document.getElementById("pad");
  let rafId = 0;

  function computeKeyboardPx() {
    if (!vv) return 0;
    return Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
  }

  function updateVars() {
    const kb = computeKeyboardPx();
    const padShown = !!(padEl && padEl.classList.contains("show"));
    const padH = padShown && padEl ? (padEl.offsetHeight || 0) : 0;

    document.documentElement.style.setProperty("--kb", kb + "px");
    document.documentElement.style.setProperty("--padH", padH + "px");
  }

  function scheduleUpdate() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      updateVars();
    });
  }

  const onViewportChange = () => scheduleUpdate();
  const onWindowResize = () => scheduleUpdate();

  if (vv) {
    vv.addEventListener("resize", onViewportChange);
    vv.addEventListener("scroll", onViewportChange);
  }
  window.addEventListener("resize", onWindowResize);

  // Permite que otros módulos re-calculen si lo necesitan
  window.__ttdUpdateLayout = updateVars;

  updateVars();

  return function cleanupIOSViewportFix() {
    try {
      if (vv) {
        vv.removeEventListener("resize", onViewportChange);
        vv.removeEventListener("scroll", onViewportChange);
      }
      window.removeEventListener("resize", onWindowResize);
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    } catch {}
  };
}

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
      try {
        stopMic();
      } catch {}
    }
  });

  // When window/iframe loses focus
  window.addEventListener("blur", () => {
    try {
      stopMic();
    } catch {}
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
  // compat: en algunos HTML el botón se llama #mic (legacy)
  micBtn: __micBtn,
  mic: __micLegacy,
  agenda,
  initialRow,
  btnDeberes,
  btnExamen,
  btnTrabajo,
} = DOM;

const micBtn = __micBtn || __micLegacy || document.getElementById("mic");

// =========================
//  Stop mic when clicking "Inicio" back button in header
// =========================
try {
  const backBtn = document.querySelector("header .back");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      try {
        stopMic();
      } catch {}
    });
  }
} catch {}

const scrollEl = chat; // main con scroll
const chatList = messages || chat; // donde pintamos burbujas
// Estado adjunto actual (imagen)
let pendingImage = null;
const initialScroll = createInitialScrollLock({
  scrollEl,
  inp,
  micBtn,
  kbd,
  btn,
  btnDeberes,
  btnExamen,
  btnTrabajo,
  unlockOnFirstSendOnly: true,
});

// =========================
//  Debug helpers (errores más útiles)
// =========================
const __TTD_DEBUG = (() => {
  try {
    const qs = String(window.location.search || "");
    if (/(?:\?|&)debug=1(?:&|$)/.test(qs)) {
      try {
        localStorage.setItem("ttd_debug", "1");
      } catch {}
      return true;
    }
    try {
      return localStorage.getItem("ttd_debug") === "1";
    } catch {}
  } catch {}
  return false;
})();

// =========================
//  Composer helpers
// =========================
const __composer = createComposerHelpers({
  inp,
  btn,
  pad,
  getModeChosen: () => modeChosen,
  getPendingImage: () => pendingImage,
});

const { autoGrowInput, update, ensureComposerInteractive, updatePadLayout } =
  __composer;

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
//  UI helpers (renderer)
// =========================
const __chatUI = createChatRenderer({
  chatList,
  scrollEl,
  looksMath,
  asciiToLatex,
  getHistory,
  setHistory,
  // Solo autoscroll cuando ya hay modo elegido
  shouldAutoScroll: () => !!modeChosen,
});

const add = __chatUI.add;
const addImageAttachment = __chatUI.addImageAttachment;
const renderFromHistory = __chatUI.renderFromHistory;
const rerenderPendingMath = __chatUI.rerenderPendingMath;

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

const __send = createSendController({
  STATE,
  inp,
  btn,
  getModeChosen: () => modeChosen,
  setPendingFirstQuestion,
  showModeQuestion,
  getPendingImage: () => pendingImage,
  setPendingImage: (v) => {
    pendingImage = v;
  },
  hideAttachPreview,
  update,
  renderPreview,
  autoGrowInput,
  stopMic,
  add,
  addImageAttachment,
  getHistory,
  setHistory,
  ensureToday,
  askGPT,
  getCurrentMode: () => currentMode,
  showTyping,
  hideTyping,
  rerenderPendingMath,
  unlockInitialScroll: initialScroll.unlockInitialScroll,
  debug: __TTD_DEBUG,
});
const safeSend = __send.safeSend;
const sendText = __send.sendText;

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

  // pending image
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
      if (e.key === "Enter" && !e.shiftKey) {
        if (e.isComposing) return;
        e.preventDefault();
        try {
          safeSend();
        } catch {}
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

installAttachInvalidHandler({
  add,
  getHistory,
  setHistory,
  clearPending: () => {
    pendingImage = null;
  },
  hideAttachPreview,
  update,
  renderPreview,
});

installMicErrorHandler({ add, getHistory, setHistory });

runInitialBoot({
  add,
  getHistory,
  setHistory,
  scrollEl,
  renderFromHistory,
  rerenderPendingMath,
  ensureComposerInteractive,
  update,
  renderPreview,
  lockInitialScroll: initialScroll.lockInitialScroll,
});
