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
import { initHistorial } from "./features/historial/studentHistorial.js";
import { logout, apiFetch } from "../shared/js/auth.js";
import { getActiveTaskContext, setCtxAttachment } from "./features/agenda/taskContext.js";
import { getDebugFlag } from "./js/api/studentApiHelpers.js";
import { initStudentAgendaFeature } from "./js/features/agenda.js";
import { initCtxTools } from "./features/agenda/ctxTools.js";
import { initTeacherTicketCTAFeature } from "./js/features/tickets.js";
import { pdfFirstPageToPngDataURL, fileToDataURL } from "./js/features/tasks.js";
import { startSession, chooseExercise, branchSession, clearActiveSession, clearSessionCache, getActiveExercises, getActiveSessionId, getWorkedExerciseIndices, getCurrentExerciseIndex } from "../shared/js/sessionapi.js";
import { createStepMapPanel, injectStepMapCSS } from "./render/stepMap.js";
import { createExercisePicker } from "./features/exercisePicker.js";
import { showSeguimosPanel } from "./features/seguimosPanel.js";
import { initAdminReturn } from "./controllers/adminReturn.js";
import { initNotaProfesor } from "./controllers/notaProfesor.js";
import { createOnFinished } from "./controllers/onFinished.js";
import { createOnSessionReady, injectTeacherPin } from "./controllers/onSessionReady.js";
import { initMobileNav } from "./controllers/mobileNav.js";
import { initMobileTutor } from "./controllers/mobileTutor.js";
import { initMobileHomeworkPrep, needsMobileHomeworkPrep } from "./features/agenda/mobileHomeworkPrep/prepScreen.js";

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

initAdminReturn();

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

const historial = initHistorial({ getTenant, ACTIVE_USER });

const metaMode = createMetaMode({
  onLogout: async () => { await logout(); },
  onFinished: async (kind) => onFinishedRef(kind),
  onShowHistorial: () => historial.open(),
  onTerminado: async (kind = "resolved") => {
    const allExercises = getActiveExercises();
    const chatPaneEl   = document.querySelector(".tutor-chat-pane");

    if (!chatPaneEl) {
      if (kind === "resolved") metaMode.showAgenda();
      await onFinishedRef(kind);
      return;
    }

    // Build completedIndices: DB completed sessions + current in-progress exercise
    let completedIndices = new Set();
    const activeCtx = getActiveTaskContext();
    const taskId    = activeCtx?.id;
    if (taskId && allExercises.length > 0) {
      showTyping();
      try {
        const res  = await apiFetch(`/api/v1/tutor-sessions/task-status/${encodeURIComponent(taskId)}`);
        const body = await res.json().catch(() => ({}));
        (body?.data?.completedIndices || []).forEach((i) => completedIndices.add(i));
      } catch {}
      hideTyping();
    }
    // Mark current exercise as done (it's about to be saved)
    const curIdx = getCurrentExerciseIndex();
    if (curIdx != null) completedIndices.add(curIdx);

    const result = await showSeguimosPanel(chatPaneEl, allExercises, completedIndices);

    if (!result || result.type === "back") {
      if (kind === "resolved") metaMode.showAgenda();
      await onFinishedRef(kind);
      return;
    }

    // El alumno eligió otro ejercicio — PATCH sesión actual, luego branch
    const sessionId = getActiveSessionId();
    if (!sessionId) {
      if (kind === "resolved") metaMode.showAgenda();
      await onFinishedRef(kind);
      return;
    }

    const duration = metaMode.getSessionSeconds?.() || 0;

    // 1. PATCH la sesión AI actual con outcome
    if (taskId && sessionId) {
      try {
        await apiFetch(`/api/v1/tutor-sessions/${encodeURIComponent(sessionId)}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ outcome: kind === "resolved" ? "completed" : "abandoned", duration_seconds: Math.max(1, duration), needs_help: kind === "stuck" }),
        });
      } catch {}
    }

    // 2. Limpiar historial del chat y resetear timer
    metaMode.resetTerminadoUI?.();
    metaMode.resetTimer?.();
    setHistory([]);
    autoScrollUnlocked = true;
    try { renderFromHistory?.(); } catch {}

    // 3. Nueva sesión para el ejercicio elegido
    exercisePicker?.hide();
    stepMapPanel.hide();
    if (_ctxSubSteps) _ctxSubSteps.hidden = false;
    if (_stepsPlaceholder) _stepsPlaceholder.hidden = false;
    _sessionLoadingEl.hidden = false;
    try {
      const branchResult = await branchSession(sessionId, result.exercise.index, result.exercise.title);
      if (_ctxSubSteps) _ctxSubSteps.hidden = false;
      if (_stepsPlaceholder) _stepsPlaceholder.hidden = true;
      stepMapPanel.render(branchResult.steps, branchResult.currentStep);
      stepMapPanel.show();
      try { window.__ttdShowNotaRow?.(); } catch {}
      const ex = result.exercise;
      const greeting = ex.index
        ? `Vamos con el ejercicio ${ex.index}: ${ex.title || `Ejercicio ${ex.index}`}. ¿Por dónde quieres empezar?`
        : `Vamos con "${ex.title}". ¿Por dónde quieres empezar?`;
      try { add("assistant", greeting); } catch {}
      try { const h = getHistory(); h.push({ role: "assistant", content: greeting }); setHistory(h); } catch {}
    } catch (err) {
      console.error("[seguimos:branchSession]", err?.message);
      metaMode.resetTerminadoUI?.();
    } finally {
      _sessionLoadingEl.hidden = true;
    }
  },
});

initMobileNav({
  activeUser:       ACTIVE_USER,
  showAgenda:       () => metaMode.showAgenda(),
  onLogout:         async () => { await logout(); },
  onShowHistorial:  () => historial.open(),
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

// ── Mobile agenda chips ──────────────────────────────────────────────
(function initAgendaChips() {
  const chipSemana    = document.getElementById("chipSemana");
  const chipExamenes  = document.getElementById("chipExamenes");
  const chipAtrasadas = document.getElementById("chipAtrasadas");

  const sectionMap = {
    semana:    document.querySelector(".col-semana"),
    examenes:  document.querySelector(".col-examenes-trabajos"),
    atrasadas: document.querySelector(".col-atrasadas"),
  };

  function activateChip(key, chipEl) {
    [chipSemana, chipExamenes, chipAtrasadas].forEach(c => c?.classList.remove("is-active"));
    chipEl?.classList.add("is-active");
    requestAnimationFrame(() => sectionMap[key]?.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" }));
  }

  chipSemana?.addEventListener("click",    () => activateChip("semana",    chipSemana));
  chipExamenes?.addEventListener("click",  () => activateChip("examenes",  chipExamenes));
  chipAtrasadas?.addEventListener("click", () => activateChip("atrasadas", chipAtrasadas));

  // Mirror overdue count onto the chip
  const countEl = document.getElementById("countAtrasadas");
  if (countEl) {
    const syncCount = () => {
      const n = parseInt(countEl.textContent, 10) || 0;
      if (!chipAtrasadas) return;
      chipAtrasadas.innerHTML = n > 0
        ? `Atrasadas · <span class="chip-count">${n}</span>`
        : "Atrasadas";
    };
    syncCount();
    new MutationObserver(syncCount).observe(countEl, { childList: true, characterData: true, subtree: true });
  }
})();

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
  injectTeacherPin(chatList, getActiveTaskContext);
  metaMode.showTutor(opts?.title || "", ACTIVE_USER?.displayName || "", opts?.tipo);
  showNotaRow?.();
  mobileTutor?.onTaskSelected();
  const taskId = opts?.taskId;
  if (!taskId) return;

  const task     = getActiveTaskContext();
  const onMobile = window.matchMedia("(max-width: 768px)").matches;
  if (needsMobileHomeworkPrep({ isMobile: onMobile, tipo: opts?.tipo, attachments: task?.attachments, taskId })) {
    mobileHomeworkPrep.showPrepScreen({
      taskTitle: task?.title || opts?.title || "",
      taskId,
      onStart: () => __send.initSession(taskId, mode),
    });
  } else {
    mobileHomeworkPrep.hidePrepScreen();
    __send.initSession(taskId, mode);
  }
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

// Mobile tutor controller — wraps stepMapPanel hooks for ≤768px
const mobileTutor = initMobileTutor({ onShowHistorial: () => historial.open(), getTaskContext: getActiveTaskContext });
const _origStepRender = stepMapPanel.render.bind(stepMapPanel);
stepMapPanel.render = (steps, cur) => { _origStepRender(steps, cur); mobileTutor.onStepUpdate(steps, cur); };
const _origStepUpdate = stepMapPanel.update.bind(stepMapPanel);
stepMapPanel.update = (sm) => { _origStepUpdate(sm); if (sm) mobileTutor.onStepUpdate(sm.steps ?? [], sm.currentStep ?? 0); };

// Mobile homework prep screen — gated before session start when no teacher attachment
const mobileHomeworkPrep = initMobileHomeworkPrep({ apiFetch, setCtxAttachment });

// Indicador de carga del Guía en la columna izquierda
const _sessionLoadingEl = (() => {
  const el = document.createElement("div");
  el.style.cssText = "display:flex;align-items:center;gap:8px;margin:8px 0 0 0;padding:0 2px;";
  el.innerHTML = `
    <span style="font-family:'IBM Plex Sans',system-ui,sans-serif;font-size:12px;color:rgba(196,131,74,0.85);">Leyendo el ejercicio</span>
    <div class="typingDots" style="gap:4px;" aria-hidden="true"><span></span><span></span><span></span></div>`;
  el.hidden = true;
  try { _ctxSubSteps?.appendChild(el); } catch {}
  return el;
})();
const exercisePicker       = createExercisePicker(_ctxSubSteps);
// Mobile: render exercise picker in the chat list (ctx-pane is hidden at ≤768px)
const mobileExercisePicker = createExercisePicker(chatList);
const addImageAttachment = __chatUI.addImageAttachment;
const addFileAttachment = __chatUI.addFileAttachment;
const addTopicChips = __chatUI.addTopicChips;
const renderFromHistory = __chatUI.renderFromHistory;
const rerenderPendingMath = __chatUI.rerenderPendingMath;

addTopicChipsRef = addTopicChips;
renderFromHistoryRef = renderFromHistory;
addRef = add;

// ── Nota al profesor ────────────────────────────────────────────────────────
const { showNotaRow, hideNotaRow } = initNotaProfesor({ apiFetch, getActiveSessionId });

// Wire "Lo he resuelto" / "No he podido" → PATCH status + cleanup + card update
onFinishedRef = createOnFinished({
  getActiveTaskContext, getActiveSessionId, ACTIVE_USER, metaMode,
  clearActiveSession, clearSessionCache,
  stepMapPanel, exercisePicker, stepsPlaceholder: _stepsPlaceholder,
  setCtxAttachment, getHistory, add, apiFetch, hideNotaRow,
});

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
    // También limpia filePick para que no se re-adjunte en Safari/iOS
    try { if (filePick) filePick.value = ""; } catch {}
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
  startSessionFn:   startSession,
  chooseExerciseFn: chooseExercise,
  onSessionReady:     createOnSessionReady({
    getActiveTaskContext, chatList, stepsPlaceholder: _stepsPlaceholder,
    stepMapPanel, renderFromHistory,
    refreshTaskContext: (taskId) => _refreshTaskContext?.(taskId),
    getHistory, setHistory, add, showNotaRow,
    onNoSteps: () => mobileTutor?.onStepUpdate([], 0),
    getStudentName: () => ACTIVE_USER?.displayName || "",
  }),
  showSessionLoading: () => {
    if (_ctxSubSteps) _ctxSubSteps.hidden = false; // asegurar visibilidad aunque no haya adjunto del profesor
    _sessionLoadingEl.hidden = false;
    if (window.matchMedia("(max-width: 768px)").matches) showTyping();
  },
  hideSessionLoading: () => {
    _sessionLoadingEl.hidden = true;
    if (window.matchMedia("(max-width: 768px)").matches) hideTyping();
  },
  onStepCompleted:    (stepMap) => stepMapPanel.update(stepMap),
  onEscalate:         () => {},
  showExercisePicker: (exercises) => {
    const onMobile = window.matchMedia("(max-width: 768px)").matches;
    return onMobile ? mobileExercisePicker.show(exercises) : exercisePicker.show(exercises);
  },
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
  const _onMob = window.matchMedia("(max-width: 768px)").matches;
  const chosen = await (_onMob ? mobileExercisePicker : exercisePicker).show(exercises);
  if (!chosen) return;
  const sessionId = getActiveSessionId();
  if (!sessionId) return;
  _sessionLoadingEl.hidden = false;
  if (_onMob) showTyping();
  try {
    const mapResult = await chooseExercise(sessionId, chosen.index, chosen.title);
    if (_stepsPlaceholder) _stepsPlaceholder.hidden = true;
    stepMapPanel.render(mapResult.steps, mapResult.currentStep);
    stepMapPanel.show();
    const greeting = chosen.index
      ? `Vamos con el ejercicio ${chosen.index}: ${chosen.title || `Ejercicio ${chosen.index}`}. ¿Por dónde quieres empezar?`
      : `Vamos con "${chosen.title}". ¿Por dónde quieres empezar?`;
    try { add("assistant", greeting); } catch {}
    try { const h = getHistory(); h.push({ role: "assistant", content: greeting }); setHistory(h); } catch {}
  } catch (err) {
    console.error("[changeExercise]", err?.message);
  } finally {
    _sessionLoadingEl.hidden = true;
    if (_onMob) hideTyping();
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
