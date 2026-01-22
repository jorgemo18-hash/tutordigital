<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>Tutordigital</title>
  <link rel="stylesheet" href="/assets/app/app.css" />
</head>
<body>
  <div class="wrap">
    <div class="shell">

      <header>
        <button class="back" type="button" aria-label="Inicio">← Inicio</button>
        <div>
          <div class="title">Tutordigital</div>
          <div class="sub">Modo alumno · Demo</div>
        </div>
      </header>

      <main id="chat" class="chat" aria-label="Chat">
        <div class="chatWrap">

          <section id="agenda" class="agendaCard" aria-label="Agenda">
            <div class="agendaHead">Agenda de hoy</div>

            <div class="agendaBody">
              <button id="btnDeberes" class="blockBtn" type="button" aria-label="Deberes de mañana">
                <div class="blockTitle">📘 Deberes de mañana</div>
                <ul class="items">
                  <li>Lengua · Ejercicios 3 y 4</li>
                  <li>Tecnología · Ejercicios 1 y 2</li>
                  <li>Matemáticas · Problema 5</li>
                </ul>
              </button>

              <button id="btnExamen" class="blockBtn" type="button" aria-label="Próximos exámenes">
                <div class="blockTitle">📝 Próximos exámenes</div>
                <ul class="items">
                  <li>Matemáticas · viernes</li>
                </ul>
              </button>

              <button id="btnTrabajo" class="blockBtn" type="button" aria-label="Trabajo">
                <div class="blockTitle">📁 Trabajo</div>
                <ul class="items">
                  <li>Historia · entrega en 15 días</li>
                </ul>
              </button>
            </div>

            <div id="initialRow" class="initialRow" aria-hidden="true"></div>
          </section>

          <div id="messages" class="messages" aria-live="polite"></div>

        </div>
      </main>

      <footer id="footer" class="footer">
        <div id="eqPreview" class="eqPreview" aria-hidden="true"></div>
        <div id="attachRow" class="attachRow" aria-hidden="true"></div>

        <div class="footerRow">
          <div class="bottomRow">

            <div class="toolsRow">
              <button id="kbd" class="send" type="button" aria-label="Teclado matemático">Σ</button>

              <!-- IDs nuevos (more/filePick) para adjuntos -->
              <button id="more" class="send" type="button" aria-label="Adjuntar">+</button>
              <input id="filePick" type="file" hidden />

              <!-- ID legacy por compatibilidad -->
              <button id="attachBtn" class="send" type="button" aria-label="Adjuntar" style="display:none;">+</button>
            </div>

            <div class="inpWrap">
              <textarea id="inp" placeholder="Escribe aquí..." rows="1" aria-label="Escribe aquí"></textarea>
            </div>

            <div class="actionsRow">
              <!-- Dos IDs para compatibilidad (solo uno visible) -->
              <button id="micBtn" class="send" type="button" aria-label="Micrófono">🎤</button>
              <button id="mic" class="send" type="button" aria-label="Micrófono" style="display:none;">🎤</button>

              <!-- Dos IDs para compatibilidad (solo uno visible) -->
              <button id="btn" class="send" type="button" aria-label="Enviar">↑</button>
              <button id="sendIn" class="send" type="button" aria-label="Enviar" style="display:none;">↑</button>
            </div>

          </div>
        </div>

        <div id="pad" class="pad" aria-hidden="true"></div>
      </footer>

    </div>
  </div>

  <script type="module" src="/assets/app/index.js"></script>
</body>
</html>

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