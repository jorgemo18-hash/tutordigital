// assets/app/index.js
import { DOM, STATE, APP_VERSION } from "./state/state.js";
import {
  ensureToday,
  ensureThread,
  setActiveThreadForMode,
  normalizeItem,
  computeItemsForMode,
  getThreadHistory,
  setThreadHistory,
} from "./state/storage.js";
import { asciiToLatex, looksMath, isMathOnly } from "./controllers/math.js";
import { toggleMic, stopMic } from "./controllers/mic.js";
import { initAttach } from "./attachments/attach.js";
import { createPreviewRenderer } from "./ui/preview.js";
import { createInputHelpers } from "./ui/input.js";
import { createTyping } from "./ui/typing.js";
import { createChatRenderer } from "./render/chatRenderer.js";
import { createComposerHelpers } from "./controllers/composer.js";
import { createAttachmentUI } from "./attachments/attachmentsui.js";
import { setupIframeBridge } from "./bridge/iframebridge.js";
import { createSendController, installAttachInvalidHandler, installMicErrorHandler } from "./controllers/send.js";
import { createInitialScrollLock, runInitialBoot } from "./boot/initial.js";
import { setupIOSViewportFix } from "../ui/iosviewportfix.js";
import { askGPT } from "../features/chat/chatapi.js";
import { bindCoreUI } from "./bindings/coreui.js";
import { initBoard } from "./board.js";
import { getFileKind } from "./lib/files.js";
import { createTicket, appendTicket } from "./lib/tickets.js";
import { pushUser } from "./lib/chatlog.js";

import {
  MODE_KEYS,
  MODE_LABEL,
  currentMode,
  modeChosen,
  waitingForMode,
  chooseMode,
  setPendingFirstQuestion,
  setWaitingForMode,
  getPendingFirstQuestion,
  clearPendingFirstQuestion,
  setSelectedTopic,
  getSelectedTopic,
} from "./controllers/mode.js";

const agendaMock = {
  deberes: [
    { id: "deb-lengua", title: "Lengua", detail: "Ejercicios 3 y 4 (pág. 78)" },
    { id: "deb-tecno", title: "Tecnología", detail: "Ejercicios 1 y 2 (tema 3)" },
    { id: "deb-mates", title: "Matemáticas", detail: "Problema 5 (ficha adjunta)" },
  ],
  examenes: [
    { id: "ex-mates", title: "Matemáticas", detail: "temas 2", meta: "viernes" },
    { id: "ex-lengua", title: "Lengua", detail: "temas 5", meta: "lunes" },
  ],
  trabajos: [
    { id: "tr-hist", title: "Historia", detail: "imperio romano", meta: "entrega en 15 días" },
  ],
};

function buildLabel(item) {
  const { title, detail, meta } = item || {};
  return String(title || "") +
    (detail ? " · " + detail : "") +
    (meta ? " · " + meta : "");
}

function normalizeType(type) {
  if (!type) return type;
  const t = String(type).toLowerCase();
  if (t.includes("deber")) return "deberes";
  if (t.includes("exam")) return "examenes";
  if (t.includes("trab")) return "trabajos";
  return type;
}

function getItemsByType(type) {
  const key = normalizeType(type);
  return agendaMock && agendaMock[key] ? agendaMock[key] : [];
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
  sendIn,
  filePick,
  kbd,
  pad,
  eqPreview,
  micBtn,
  agenda,
  btnDeberes,
  btnExamen,
  btnTrabajo,
} = DOM;

function renderAgendaFromMock() {
  const entries = [
    { btn: btnDeberes, items: getItemsByType("deberes") },
    { btn: btnExamen, items: getItemsByType("examenes") },
    { btn: btnTrabajo, items: getItemsByType("trabajos") },
  ];

  entries.forEach(({ btn, items }) => {
    if (!btn) return;
    let list = btn.querySelector("ul.items");
    if (!list) {
      list = document.createElement("ul");
      list.className = "items";
      btn.appendChild(list);
    }
    list.innerHTML = "";
    items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = buildLabel(item);
      list.appendChild(li);
    });
  });
}

renderAgendaFromMock();

try {
  initBoard({ filePickEl: filePick });
} catch (e) {
  console.warn("initBoard() falló:", e);
}

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
      try { localStorage.setItem("ttd_debug", "1"); } catch {}
      return true;
    }
    try { return localStorage.getItem("ttd_debug") === "1"; } catch {}
  } catch {}
  return false;
})();

// =========================
//  Threaded history (por tarea)
// =========================
let activeThreadId = "";
let typePickerRow = null;
let itemPickerRow = null;

function getHistory() {
  return activeThreadId ? getThreadHistory(activeThreadId) : [];
}

function setHistory(arr) {
  if (!activeThreadId) return;
  setThreadHistory(activeThreadId, arr);
}

function clearTypePicker() {
  if (!typePickerRow) return;
  try { typePickerRow.remove(); } catch {}
  typePickerRow = null;
}

function clearItemPicker() {
  if (!itemPickerRow) return;
  try { itemPickerRow.remove(); } catch {}
  itemPickerRow = null;
}

function showTypePicker() {
  if (!chatList) return;
  setWaitingForMode(true);
  clearTypePicker();
  clearItemPicker();

  const row = document.createElement("div");
  row.className = "row a";
  const bubble = document.createElement("div");
  bubble.className = "bubble threadChooser";

  const title = document.createElement("div");
  title.className = "threadChooserTitle";
  title.textContent = "Elige qué toca hoy:";

  const list = document.createElement("div");
  list.className = "threadChooserList";

  const modes = [MODE_KEYS.DEBERES, MODE_KEYS.EXAMEN, MODE_KEYS.TRABAJO];
  modes.forEach((mode) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "threadChip";
    btn.textContent = MODE_LABEL[mode] || String(mode || "");
    btn.addEventListener("click", () => {
      startTypeSelection(mode);
    });
    list.appendChild(btn);
  });

  bubble.appendChild(title);
  bubble.appendChild(list);
  row.appendChild(bubble);
  typePickerRow = row;
  chatList.appendChild(row);

  try { scrollEl.scrollTop = scrollEl.scrollHeight; } catch {}
}

async function startTypeSelection(mode) {
  clearTypePicker();
  clearItemPicker();
  setWaitingForMode(false);

  try {
    await chooseMode(mode, {
      inp,
      add,
      getHistory,
      setHistory,
      sendText,
      skipAnnounce: true,
    });
  } catch {}

  const items = computeItemsForMode(mode);
  if (items.length <= 1) {
    await selectItem(mode, items[0] || null);
    return;
  }

  if (typeof addTopicChips === "function") {
    const labels = items.map((item) => String(item?.title || "").trim()).filter(Boolean);
    const row = addTopicChips(labels, {
      onSelect: ({ full, row: chipRow }) => {
        const item = items.find((it) => String(it?.title || "").trim() === full) || null;
        selectItem(mode, item);
        if (chipRow && chipRow.remove) {
          try { chipRow.remove(); } catch {}
        }
      },
    });
    itemPickerRow = row;
  }
}

async function selectItem(mode, item) {
  clearItemPicker();

  const title = String(item?.title || MODE_LABEL[mode] || mode || "").trim();
  const itemKey = item?.itemKey || normalizeItem(title) || "default";

  if (title) {
    try { setSelectedTopic(title); } catch {}
  }

  activeThreadId = ensureThread(mode, itemKey, title);
  if (activeThreadId) {
    setActiveThreadForMode(mode, activeThreadId);
    renderFromHistory();
  }

  const pending = getPendingFirstQuestion();
  if (pending) {
    pushUser({ add, getHistory, setHistory }, pending);
    clearPendingFirstQuestion();
  }

  const prompt = pending
    ? (
        `El alumno ha seleccionado ${title}. ` +
        `Mensaje del alumno: "${pending}". ` +
        `Responde empezando con: "Perfecto, vamos con ${title}." ` +
        `Si faltan detalles, pregunta por el enunciado/página/ejercicio concreto.`
      )
    : (
        `El alumno ha seleccionado ${title}. ` +
        `Responde empezando con: "Perfecto, vamos con ${title}." ` +
        `Pregunta por el enunciado/página/ejercicio concreto para continuar.`
      );

  if (prompt) {
    try { await sendText(prompt, { silentUser: true }); } catch {}
  }
}

// =========================
//  Composer helpers (extraídos)
// =========================
const __composer = createComposerHelpers({
  inp,
  btn,
  pad,
  getModeChosen: () => modeChosen,
  getWaitingForMode: () => waitingForMode,
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
try { ensureToday?.(); } catch {}

// =========================
//  Helpers (preview + inserción)
// =========================
const { renderPreview } = createPreviewRenderer({
  inp,
  eqPreview,
  looksMath,
  isMathOnly,
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
  // Evita que el boot inicial “se coma” la cabecera de Agenda en móvil.
  // Solo habilitamos autoscroll cuando el alumno ya ha elegido modo.
  shouldAutoScroll: () => !!modeChosen,
});

const add = __chatUI.add;
const addTeacherCTA = __chatUI.addTeacherCTA;
const addImageAttachment = __chatUI.addImageAttachment;
const addTopicChips = __chatUI.addTopicChips;
const renderFromHistory = __chatUI.renderFromHistory;
const rerenderPendingMath = __chatUI.rerenderPendingMath;

function collectLastMessages(limit = 12) {
  try {
    const hist = getHistory();
    if (!Array.isArray(hist)) return [];
    return hist.slice(-limit).map((m) => ({
      role: m?.role === "assistant" ? "assistant" : "user",
      content: String(m?.content || ""),
    }));
  } catch {
    return [];
  }
}

function getAttachmentSnapshot() {
  try {
    const pending = pendingImage;
    const file = pending?.file || null;
    if (!file) return null;
    const info = getFileKind(file);
    return {
      kind: info.kind,
      name: info.name || "",
      mime: info.type || info.suggestedMime || "",
    };
  } catch {
    return null;
  }
}

function createTeacherTicket(type) {
  const ticket = createTicket({
    type,
    mode: currentMode,
    lastMessages: collectLastMessages(12),
    attachment: getAttachmentSnapshot(),
  });
  const res = appendTicket(ticket);
  if (!res.ok) return null;
  try {
    window.dispatchEvent(new CustomEvent("ttd:teacher-ticket", { detail: ticket }));
  } catch {}
  return ticket;
}

function pushTeacherCTA(type) {
  return addTeacherCTA?.(type, {
    onClick: ({ btn }) => {
      const ticket = createTeacherTicket(type);
      try {
        if (btn) {
          btn.textContent = "Enviado ✓";
        }
      } catch {}
      if (!ticket) return;
    },
  });
}

if (__TTD_DEBUG) {
  try {
    window.ttdPushTeacherCTA = (type) => pushTeacherCTA(type);
  } catch {}
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

const showModePicker = () => {
  showTypePicker();
};

const __send = createSendController({
  STATE,
  inp,
  btn,
  sendIn,
  forceScrollToBottom: () => {
    try { scrollEl.scrollTop = scrollEl.scrollHeight; } catch {}
  },
  getModeChosen: () => modeChosen,
  setPendingFirstQuestion,
  showModeQuestion: showModePicker,
  getPendingImage: () => pendingImage,
  setPendingImage: (v) => { pendingImage = v; },
  hideAttachPreview,
  update,
  renderPreview,
  autoGrowInput,
  stopMic,
  add,
  addImageAttachment,
  getHistory,
  setHistory,
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
  startTypeSelection,
  MODES: MODE_KEYS,

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
installAttachInvalidHandler({
  add,
  getHistory,
  setHistory,
  clearPending: () => { pendingImage = null; },
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
