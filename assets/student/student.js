// assets/student/student.js
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
import createAttachmentUI from "./attachments/attachmentsui.js";
import { setupIframeBridge } from "./bridge/iframebridge.js";
import { createSendController, installAttachInvalidHandler, installMicErrorHandler } from "./controllers/send.js";
import { createInitialScrollLock, runInitialBoot } from "./boot/initial.js";
import { installMicGuards, installBackStopsMic, installEnterToSend } from "./boot/guards.js";
import { setupIOSViewportFix } from "../shared/js/iosviewportfix.js";
import { askGPT } from "../shared/js/chatapi.js";
import { bindCoreUI } from "./bindings/coreui.js";
import { initBoard } from "./board.js";
import { pushUser } from "./lib/chatlog.js";
import { createThreadPicker } from "./features/threadPicker/threadPicker.js";
import { initStudentBootstrap, applyStudentVersionTag } from "./js/bootstrap/studentBootstrap.js";
import { createMetaMode } from "./controllers/meta-mode.js";
import { logout, apiFetch } from "../shared/js/auth.js";
import { getActiveTaskContext } from "./features/agenda/taskContext.js";
import { getDebugFlag } from "./js/api/studentApiHelpers.js";
import { initStudentAgendaFeature } from "./js/features/agenda.js";
import { initTeacherTicketCTAFeature } from "./js/features/tickets.js";
import { pdfFirstPageToPngDataURL, fileToDataURL } from "./js/features/tasks.js";

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

const DEBUG_STUDENT_BOOT =
  Boolean(window.RUNTIME_CONFIG?.DEBUG_STUDENT_BOOT) ||
  (typeof localStorage !== "undefined" && localStorage.getItem("ttd_debug_student_boot") === "1");

function dlog(...args) { if (DEBUG_STUDENT_BOOT) console.log(...args); }

try {
  dlog("[STUDENT_BOOT] path/search", window.location.pathname, window.location.search);
  dlog("[STUDENT_BOOT] ttd_activeTenantSlug", localStorage.getItem("ttd_activeTenantSlug"));
  if (DEBUG_STUDENT_BOOT) {
    window.addEventListener("beforeunload", () => {
      dlog("[STUDENT_BOOT] beforeunload", window.location.pathname);
    });
  }
} catch {}

applyStudentVersionTag(APP_VERSION);

const tenantBoot = await initStudentBootstrap();
const {
  getTenant,
  loadActiveUser,
  canInitStudentApp,
} = tenantBoot;
// Re-leer después de ensureStudentApproval() para obtener displayName actualizado
const ACTIVE_USER = loadActiveUser();

if (canInitStudentApp) {

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
installMicGuards({ stopMic });

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
  btnDeberes,
  btnExamen,
  btnTrabajo,
} = DOM;

let onFinishedRef = async (_kind) => {};

const metaMode = createMetaMode({
  onLogout: async () => { await logout(); },
  onFinished: async (kind) => onFinishedRef(kind),
});

initStudentAgendaFeature({ getTenant, ACTIVE_USER, btnDeberes, btnExamen, btnTrabajo, selectTask: (...args) => selectTaskRef(...args) });

try {
  initBoard({ filePickEl: filePick });
} catch (e) {
  console.warn("initBoard() falló:", e);
}

// =========================
//  Stop mic when clicking "Inicio" back button in header
// =========================
installBackStopsMic({ stopMic });

const scrollEl = chat; // main con scroll
const chatList = messages || chat; // donde pintamos burbujas
// Estado adjunto actual (imagen)
let pendingImage = null;
let autoScrollUnlocked = false;
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
const __TTD_DEBUG = getDebugFlag();

// =========================
//  Threaded history (por tarea)
// =========================
let sendText = async () => {};
let addTopicChipsRef = null;
let renderFromHistoryRef = () => {};
let addRef = (...args) => {};
let selectTaskRef = async () => {};

const threadPicker = createThreadPicker({
  chatList,
  scrollEl,
  MODE_KEYS,
  MODE_LABEL,
  computeItemsForMode,
  normalizeItem,
  getThreadHistory,
  setThreadHistory,
  ensureThread,
  setActiveThreadForMode,
  setSelectedTopic,
  getPendingFirstQuestion,
  clearPendingFirstQuestion,
  pushUser,
  chooseMode,
  setWaitingForMode,
  setPendingFirstQuestion,
  addTopicChips: (...args) => addTopicChipsRef && addTopicChipsRef(...args),
  renderFromHistory: () => renderFromHistoryRef(),
  sendText: (...args) => sendText(...args),
  inp,
  add: (...args) => addRef(...args),
});

const showTypePicker = threadPicker.showTypePicker;
const startTypeSelection = threadPicker.startTypeSelection;
const getHistory = threadPicker.getHistory;
const setHistory = threadPicker.setHistory;
const _origSelectTask = threadPicker.selectTask;
selectTaskRef = async (mode, opts) => {
  await _origSelectTask(mode, opts);
  metaMode.showTutor(opts?.title || "", ACTIVE_USER?.displayName || "");
};

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
  // Solo habilitamos autoscroll cuando el alumno envía su primer mensaje.
  shouldAutoScroll: () => autoScrollUnlocked,
});

const add = __chatUI.add;
const addTeacherCTA = __chatUI.addTeacherCTA;
const addImageAttachment = __chatUI.addImageAttachment;
const addFileAttachment = __chatUI.addFileAttachment;
const addTopicChips = __chatUI.addTopicChips;
const renderFromHistory = __chatUI.renderFromHistory;
const rerenderPendingMath = __chatUI.rerenderPendingMath;

addTopicChipsRef = addTopicChips;
renderFromHistoryRef = renderFromHistory;
addRef = add;

// Wire "No he podido" → needs_teacher PATCH + ticket POST + confirmation + back to agenda
onFinishedRef = async (kind) => {
  if (kind !== "stuck") return;
  const activeCtx = getActiveTaskContext();
  const studentId = ACTIVE_USER?.userId;
  const taskId = activeCtx?.id;

  if (taskId && studentId) {
    try {
      await apiFetch("/api/v1/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, student_id: studentId, student_status: "needs_teacher" }),
      });
    } catch {}
  }

  try {
    const hist = getHistory();
    const lastMessages = Array.isArray(hist)
      ? hist.slice(-8).map((m) => `${m.role === "assistant" ? "Tutor" : "Alumno"}: ${m.content}`).join("\n")
      : "";
    await apiFetch("/api/v1/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Alumno necesita ayuda del profesor",
        detail: [
          activeCtx?.title ? `Tarea: ${activeCtx.title}` : "",
          activeCtx?.subject ? `Asignatura: ${activeCtx.subject}` : "",
          lastMessages ? `Conversación:\n${lastMessages}` : "",
        ].filter(Boolean).join("\n\n"),
      }),
    });
  } catch {}

  add({ role: "a", text: "He avisado a tu profesor. Puedes seguir intentándolo aquí o volver a la agenda." });
  setTimeout(() => metaMode.showAgenda(), 2500);
};

initTeacherTicketCTAFeature({
  addTeacherCTA,
  getHistory,
  getPendingImage: () => pendingImage,
  getCurrentMode: () => currentMode,
  debug: __TTD_DEBUG,
});
// =========================
//  UI módulos (typing + adjuntos + bridge iframe)
// =========================
const __typing = createTyping({ chatList, scrollEl });
showTyping = __typing.showTyping;
hideTyping = __typing.hideTyping;

const __attachUI = createAttachmentUI({
  // Donde se pinta la “pastilla” del adjunto (encima del input).
  // Si por lo que sea no existe, caemos al propio composer.
  rootEl: document.getElementById('attachRow') || sendIn,
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
  getSelectedTopic: () => getSelectedTopic(),
  setPendingFirstQuestion,
  showModeQuestion: showModePicker,
  getPendingImage: () => pendingImage,
  setPendingImage: (v) => { pendingImage = v; },
  hideAttachPreview,
  setAttachSending: __attachUI.setSending,
  update,
  renderPreview,
  autoGrowInput,
  stopMic,
  add,
  addImageAttachment,
  addFileAttachment,
  setAutoScrollUnlocked: () => { autoScrollUnlocked = true; },
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
sendText = __send.sendText;

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
});
// ✅ binding único (coreUI.js)
const bindOnce = bindCoreUI({
  // DOM
  inp,
  btn,
  kbd,
  pad,
  micBtn,
  scrollEl,

  // deps
  STATE,
  stopMic,
  toggleMic,
  insertAtCursor,

  // features
  initAttach,

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
  pdfFirstPageToPngDataURL,

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
installEnterToSend({ inp, safeSend });

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
  // No bloqueamos el scroll del usuario; solo desactivamos auto-scroll programático.
});
}
