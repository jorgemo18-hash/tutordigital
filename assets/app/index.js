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
import { setupIOSViewportFix } from "./ui/iosViewportFix.js";
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

console.log("✅ index.js imports OK");

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
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      try {
        stopMic();
      } catch {}
    }
  });

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
  micBtn,
  agenda,
  initialRow,
  btnDeberes,
  btnExamen,
  btnTrabajo,
} = DOM;

// --- Compat: si el HTML usa IDs alternativos (mic/send/attach), hacemos fallback aquí.
const __sendBtnEl =
  btn || document.getElementById("sendIn") || document.getElementById("btn");

const __micBtnEl =
  micBtn || document.getElementById("mic") || document.getElementById("micBtn");

// Algunas builds antiguas usaban #more/#filePick; otras #attachBtn.
const __attachBtnEl =
  document.getElementById("more") || document.getElementById("attachBtn");

// Stop mic when clicking "Inicio" back button in header
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

const scrollEl = chat;
const chatList = messages || chat;

let pendingImage = null;

const initialScroll = createInitialScrollLock({
  scrollEl,
  inp,
  micBtn: __micBtnEl,
  kbd,
  btn: __sendBtnEl,
  btnDeberes,
  btnExamen,
  btnTrabajo,
  unlockOnFirstSendOnly: true,
});

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

const __composer = createComposerHelpers({
  inp,
  btn: __sendBtnEl,
  pad,
  getModeChosen: () => modeChosen,
  getPendingImage: () => pendingImage,
});

const { autoGrowInput, update, ensureComposerInteractive, updatePadLayout } =
  __composer;

window.__ttdUpdateLayout = updatePadLayout;
try {
  window.addEventListener("resize", () => requestAnimationFrame(updatePadLayout));
} catch {}
try {
  requestAnimationFrame(updatePadLayout);
} catch {}

let showTyping = () => {};
let hideTyping = () => {};
let showAttachPreview = () => {};
let hideAttachPreview = () => {};

ensureComposerInteractive();
update();

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

const __chatUI = createChatRenderer({
  chatList,
  scrollEl,
  looksMath,
  asciiToLatex,
  getHistory,
  setHistory,
  shouldAutoScroll: () => !!modeChosen,
});

const add = __chatUI.add;
const addImageAttachment = __chatUI.addImageAttachment;
const renderFromHistory = __chatUI.renderFromHistory;
const rerenderPendingMath = __chatUI.rerenderPendingMath;

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
  btn: __sendBtnEl,
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

const bindOnce = bindCoreUI({
  inp,
  btn: __sendBtnEl,
  kbd,
  pad,
  micBtn: __micBtnEl,
  btnDeberes,
  btnExamen,
  btnTrabajo,
  scrollEl,

  STATE,
  stopMic,
  toggleMic,
  insertAtCursor,

  initAttach,
  chooseMode,
  MODES,

  getHistory,
  setHistory,

  safeSend,
  sendText,

  ensureComposerInteractive,
  autoGrowInput,
  update,
  renderPreview,
  fileToDataURL,

  getPendingImage: () => pendingImage,
  setPendingImage: (v) => {
    pendingImage = v;
  },

  showAttachPreview,
  hideAttachPreview,

  updatePadLayout,

  add,
  addImageAttachment,
});

bindOnce();

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