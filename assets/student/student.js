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
import { getActiveTaskContext, setCtxAttachment } from "./features/agenda/taskContext.js";
import { getDebugFlag } from "./js/api/studentApiHelpers.js";
import { initStudentAgendaFeature } from "./js/features/agenda.js";
import { initCtxTools } from "./features/agenda/ctxTools.js";
import { initTeacherTicketCTAFeature } from "./js/features/tickets.js";
import { pdfFirstPageToPngDataURL, fileToDataURL } from "./js/features/tasks.js";
import { startSession, chooseExercise, restoreSession, clearActiveSession, clearSessionCache, getActiveExercises, getActiveSessionId } from "../shared/js/sessionapi.js";
import { createStepMapPanel, injectStepMapCSS } from "./render/stepMap.js";
import { createExercisePicker } from "./features/exercisePicker.js";

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

// Botón "Volver al admin" — solo si el admin abrió este panel desde el panel admin
try {
  if (localStorage.getItem("ttd_admin_return") === "1") {
    const returnBtn = document.createElement("button");
    returnBtn.type = "button";
    returnBtn.id = "adminReturnBtn";
    returnBtn.textContent = "← Admin";
    returnBtn.style.cssText = [
      "position:fixed", "top:10px", "left:10px", "z-index:9999",
      "background:rgba(196,131,74,0.18)", "border:1px solid rgba(196,131,74,0.40)",
      "color:rgba(242,237,229,0.85)", "font-size:12px", "font-family:inherit",
      "padding:5px 9px", "border-radius:7px", "cursor:pointer",
      "backdrop-filter:blur(8px)", "-webkit-backdrop-filter:blur(8px)",
      "line-height:1.4",
    ].join(";");
    returnBtn.addEventListener("click", () => {
      try { localStorage.removeItem("ttd_admin_return"); } catch {}
      window.location.href = "/assets/admin/";
    });
    document.body.appendChild(returnBtn);
  }
} catch {}

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

let _refreshTaskContext = null;
initStudentAgendaFeature({
  getTenant, ACTIVE_USER, btnDeberes, btnExamen, btnTrabajo,
  selectTask: (...args) => selectTaskRef(...args),
  onRefreshTaskContext: (fn) => { _refreshTaskContext = fn; },
});

initCtxTools({ filePick, getSendText: () => sendText });

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
let addRef = (..._args) => {};
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

// threadPicker.showTypePicker / startTypeSelection not used in sidebar flow
const getHistory = threadPicker.getHistory;
const setHistory = threadPicker.setHistory;
const _origSelectTask = threadPicker.selectTask;
selectTaskRef = async (mode, opts) => {
  autoScrollUnlocked = true; // task switch always enables scroll before renderFromHistory
  stepMapPanel?.hide();
  if (_stepsPlaceholder) _stepsPlaceholder.hidden = false;
  exercisePicker?.hide();
  await _origSelectTask(mode, opts);
  metaMode.showTutor(opts?.title || "", ACTIVE_USER?.displayName || "");
  const taskId = opts?.taskId;
  if (taskId) __send.initSession(taskId, mode);
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
const getStudentInitials = () => {
  const name = ACTIVE_USER?.displayName || '';
  const parts = name.trim().split(/\s+/);
  return (parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : (parts[0]?.[0] || '?')).toUpperCase();
};

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
  getStudentInitials,
});

const add = __chatUI.add;
const addTeacherCTA = __chatUI.addTeacherCTA;

injectStepMapCSS();
// Monta el panel en la columna izquierda (aside), dentro de #ctxSubSteps.
// El placeholder "Los pasos aparecerán aquí" se oculta cuando llegan los pasos.
const _ctxSubSteps = document.getElementById("ctxSubSteps");
const stepMapPanel = createStepMapPanel(_ctxSubSteps);
stepMapPanel.hide();
const _stepsPlaceholder = _ctxSubSteps?.querySelector(".ctx-sub-steps-placeholder") || null;

// Indicador de carga del Guía en la columna izquierda
const _sessionLoadingEl = (() => {
  const el = document.createElement("p");
  el.textContent = "Leyendo el enunciado…";
  el.style.cssText = "font-family:'IBM Plex Sans',system-ui,sans-serif;font-size:12px;color:rgba(242,237,229,0.50);margin:8px 0 0 0;padding:0 2px;";
  el.hidden = true;
  try { _ctxSubSteps?.appendChild(el); } catch {}
  return el;
})();
const exercisePicker = createExercisePicker(_ctxSubSteps);
const addImageAttachment = __chatUI.addImageAttachment;
const addFileAttachment = __chatUI.addFileAttachment;
const addTopicChips = __chatUI.addTopicChips;
const renderFromHistory = __chatUI.renderFromHistory;
const rerenderPendingMath = __chatUI.rerenderPendingMath;

addTopicChipsRef = addTopicChips;
renderFromHistoryRef = renderFromHistory;
addRef = add;

// Wire "Lo he resuelto" / "No he podido" → PATCH status + cleanup + card update
onFinishedRef = async (kind) => {
  const activeCtx = getActiveTaskContext();
  const studentId = ACTIVE_USER?.userId;
  const taskId = activeCtx?.id;
  const duration = metaMode.getSessionSeconds?.() || 0; // capture before any async op
  const newStatus = kind === "resolved" ? "done" : "needs_teacher";

  // PATCH task status (now open to students in tasks.routes.js)
  if (taskId && studentId) {
    try {
      await apiFetch("/api/v1/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, student_id: studentId, student_status: newStatus }),
      });
    } catch {}
  }

  clearActiveSession();
  clearSessionCache(taskId);  // al terminar la tarea, borrar el cache de sesión
  stepMapPanel?.hide();
  if (_stepsPlaceholder) _stepsPlaceholder.hidden = false;
  exercisePicker?.hide();

  // Save tutor session (always when task is known; API requires min 1s)
  if (taskId) {
    try {
      const _d = new Date();
      const sessionDate = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, "0")}-${String(_d.getDate()).padStart(2, "0")}`;
      await apiFetch("/api/v1/tutor-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, duration_seconds: Math.max(1, duration), needs_help: newStatus === "needs_teacher", session_date: sessionDate }),
      });
    } catch {}
  }

  if (kind === "stuck") {
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
    try { add("assistant", "He avisado a tu profesor. Puedes seguir intentándolo aquí o volver a la agenda."); } catch {}
    setTimeout(() => { try { metaMode.showAgenda(); } catch (err) { console.error("[onFinished] showAgenda error:", err); } }, 2500);
  }

  if (kind === "resolved") {
    setCtxAttachment(null);
    if (taskId) { try { localStorage.removeItem(`ctxFiles_${taskId}`); localStorage.removeItem(`ctxFile_${taskId}`); } catch {} }
    try {
      const ctxPreview = document.getElementById("ctxFilePreview");
      const ctxUploadArea = document.getElementById("ctxUploadArea");
      if (ctxPreview) { ctxPreview.innerHTML = ""; ctxPreview.hidden = true; }
      if (ctxUploadArea) ctxUploadArea.hidden = false;
    } catch {}
  }

  // Update card chip in agenda without page reload
  if (taskId) {
    try {
      const card = document.querySelector(`[data-card-task-id="${taskId}"]`);
      if (card) {
        const isDone = newStatus === "done";
        const isNeedsHelp = newStatus === "needs_teacher";
        card.classList.toggle("done", isDone);
        card.classList.toggle("needs-help", isNeedsHelp);
        const doneBtn = card.querySelector(`[data-done-id="${taskId}"]`);
        if (doneBtn) {
          doneBtn.textContent = isDone ? "✓" : isNeedsHelp ? "✗" : "○";
          doneBtn.classList.toggle("is-done", isDone);
          doneBtn.classList.toggle("is-needs-help", isNeedsHelp);
          doneBtn.setAttribute("aria-label", isDone ? "Marcar pendiente" : "Marcar hecho");
        }
      }
    } catch {}
  }
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
  // no-op: context comes from agenda card click
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
  // ── Sesión del tutor IA ────────────────────────────────────────────────
  startSessionFn:     startSession,
  chooseExerciseFn:   chooseExercise,
  restoreSessionFn:   restoreSession,
  onSessionReady:     (steps, cur, exerciseCtx, isRestore = false) => {
    if (_stepsPlaceholder) _stepsPlaceholder.hidden = true;
    stepMapPanel.render(steps, cur);
    stepMapPanel.show();
    if (isRestore) {
      // Bug 1 — historial desaparece en restore: forzar re-render desde localStorage
      try { renderFromHistoryRef(); } catch {}
      // Repoblar el panel izquierdo con el adjunto de la tarea (puede haberse limpiado)
      const taskId = getActiveTaskContext()?.id;
      if (taskId && typeof _refreshTaskContext === "function") {
        _refreshTaskContext(taskId);
      }
    } else {
      // Mensaje inicial solo en sesiones nuevas — no repetir si se restaura
      const label = exerciseCtx?.title || getActiveTaskContext()?.title || "";
      const greeting = label
        ? `Perfecto, vamos con "${label}". ¿Por dónde quieres empezar?`
        : "Perfecto. ¿Por dónde quieres empezar?";
      try { add("assistant", greeting); } catch {}
      try {
        const hist = getHistory();
        hist.push({ role: "assistant", content: greeting });
        setHistory(hist);
      } catch {}
    }
  },
  showSessionLoading: () => { _sessionLoadingEl.hidden = false; },
  hideSessionLoading: () => { _sessionLoadingEl.hidden = true; },
  onStepCompleted:    (stepMap) => stepMapPanel.update(stepMap),
  onEscalate:         () => {},
  showExercisePicker: (exercises) => exercisePicker.show(exercises),
  // ── Streaming SSE ──────────────────────────────────────────────────────
  startStreamingBubble:    __chatUI.startStreamingBubble,
  appendStreamToken:       __chatUI.appendStreamToken,
  finalizeStreamingBubble: __chatUI.finalizeStreamingBubble,
});
const safeSend = __send.safeSend;
sendText = __send.sendText;

// Cablear "Cambiar ejercicio" — se puede activar tras tener acceso a todas las deps
stepMapPanel.setOnChangeExercise(async () => {
  const exercises = getActiveExercises();
  if (!exercises?.length) return;
  stepMapPanel.hide();
  if (_stepsPlaceholder) _stepsPlaceholder.hidden = false;
  const chosen = await exercisePicker.show(exercises);
  if (!chosen) return;
  const sessionId = getActiveSessionId();
  if (!sessionId) return;
  _sessionLoadingEl.hidden = false;
  try {
    const mapResult = await chooseExercise(sessionId, chosen.index, chosen.title);
    if (_stepsPlaceholder) _stepsPlaceholder.hidden = true;
    stepMapPanel.render(mapResult.steps, mapResult.currentStep);
    stepMapPanel.show();
    const greeting = `Perfecto, vamos con "${chosen.title || `Ejercicio ${chosen.index}`}". ¿Por dónde quieres empezar?`;
    try { add("assistant", greeting); } catch {}
    try { const h = getHistory(); h.push({ role: "assistant", content: greeting }); setHistory(h); } catch {}
  } catch (err) {
    console.error("[changeExercise]", err?.message);
  } finally {
    _sessionLoadingEl.hidden = true;
  }
});

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
