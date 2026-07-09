// assets/student/student.js
//
// Nivel 1 de split aplicado (ver plan de división en 2 niveles): se
// extrajeron los bloques autocontenidos y los callbacks/objetos de config
// más grandes a módulos propios (onTerminadoSeguimos.js, mobileAgendaChips.js,
// changeExerciseHandler.js, sendControllerConfig.js, coreUIConfig.js,
// studentInitials.js, sessionLoadingIndicator.js). Sigue siendo el
// composition root del panel: instancia ~25 controladores en un orden con
// dependencias cruzadas (varios usan el patrón onFinishedRef/addRef para
// resolver referencias circulares). El Nivel 2 (agrupar esa instanciación
// en 1-2 funciones de fase, p.ej. initTutorControllers/initTutorBindings)
// queda pendiente hasta que exista cobertura de tests de UI para este
// flujo — es un cambio de mayor riesgo (reordenar inicialización) que no
// conviene hacer a ciegas.
import { DOM, APP_VERSION } from "./state/state.js";
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
import { stopMic } from "./controllers/mic.js";
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
import { bindCoreUI } from "./bindings/coreui.js";
import { initBoard } from "./board.js";
import { pushUser } from "./lib/chatlog.js";
import { createThreadPicker } from "./features/threadPicker/threadPicker.js";
import { initStudentBootstrap, applyStudentVersionTag } from "./js/bootstrap/studentBootstrap.js";
import { createMetaMode } from "./controllers/meta-mode.js";
import { initHistorial } from "./features/historial/studentHistorial.js";
import { logout, apiFetch } from "../shared/js/auth.js";
import { getActiveTaskContext, setCtxAttachment, setActiveTaskMode, getActiveTaskMode, getActiveTaskAttachments } from "./features/agenda/taskContext.js";
import { getDebugFlag } from "./js/api/studentApiHelpers.js";
import { initStudentAgendaFeature } from "./js/features/agenda.js";
import { initCtxTools } from "./features/agenda/ctxTools.js";
import { initCtxDropZone } from "./features/agenda/ctxDropZone.js";
import { startSesionLibre } from "./features/agenda/sesionLibre.js";
import { initTeacherTicketCTAFeature } from "./js/features/tickets.js";
import { clearActiveSession, clearSessionCache, getActiveSessionId } from "../shared/js/sessionapi.js";
import { createStepMapPanel, injectStepMapCSS } from "./render/stepMap.js";
import { createExercisePicker } from "./features/exercisePicker.js";
import { initAdminReturn } from "./controllers/adminReturn.js";
import { initNotaProfesor } from "./controllers/notaProfesor.js";
import { createOnFinished } from "./controllers/onFinished.js";
import { createOnSessionReady, injectTeacherPin } from "./controllers/onSessionReady.js";
import { initMobileNav } from "./controllers/mobileNav.js";
import { initMobileTutor } from "./controllers/mobileTutor.js";
import { initMobileHomeworkPrep, needsMobileHomeworkPrep } from "./features/agenda/mobileHomeworkPrep/prepScreen.js";
import { createOnTerminadoHandler } from "./controllers/onTerminadoSeguimos.js";
import { initMobileAgendaChips } from "./features/agenda/mobileAgendaChips.js";
import { createChangeExerciseHandler } from "./controllers/changeExerciseHandler.js";
import { buildSendControllerConfig } from "./controllers/sendControllerConfig.js";
import { installStatementUploadedHandler } from "./controllers/statementUploadHandler.js";
import { buildCoreUIConfig } from "./bindings/coreUIConfig.js";
import { getStudentInitials } from "./js/utils/studentInitials.js";
import { buildSessionLoadingIndicator } from "./ui/sessionLoadingIndicator.js";

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
  tenantType,
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
  tenantType,
  onTerminado: createOnTerminadoHandler({
    getRuntime: () => ({
      metaMode, onFinishedRef, showTyping, hideTyping, getHistory, setHistory,
      renderFromHistory, exercisePicker, stepMapPanel,
      ctxSubSteps: _ctxSubSteps, stepsPlaceholder: _stepsPlaceholder,
      sessionLoadingEl: _sessionLoadingEl, showNotaRow, add,
    }),
    setAutoScrollUnlocked: (v) => { autoScrollUnlocked = v; },
  }),
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
initCtxDropZone(document.getElementById("tutorCtxPane"), document.getElementById("ctxFilePick"));

try {
  initBoard({ filePickEl: filePick });
} catch (e) {
  console.warn("initBoard() falló:", e);
}

// ── Mobile agenda chips ──────────────────────────────────────────────
initMobileAgendaChips();

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
let retryAnalysisRef = () => {};

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
  setActiveTaskMode(mode);

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
  getStudentInitials: () => getStudentInitials(ACTIVE_USER?.displayName),
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
const _sessionLoadingEl = buildSessionLoadingIndicator(_ctxSubSteps);
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

const __send = createSendController(buildSendControllerConfig({
  inp,
  btn,
  sendIn,
  scrollEl,
  getPendingImage: () => pendingImage,
  setPendingImage: (v) => { pendingImage = v; },
  hideAttachPreview,
  setAttachSending: __attachUI.setSending,
  update,
  renderPreview,
  autoGrowInput,
  add,
  addImageAttachment,
  addFileAttachment,
  setAutoScrollUnlocked: () => { autoScrollUnlocked = true; },
  getHistory,
  setHistory,
  showTyping,
  hideTyping,
  rerenderPendingMath,
  unlockInitialScroll: initialScroll.unlockInitialScroll,
  debug: __TTD_DEBUG,
  onSessionReady: createOnSessionReady({
    getActiveTaskContext, chatList, stepsPlaceholder: _stepsPlaceholder,
    stepMapPanel, renderFromHistory,
    refreshTaskContext: (taskId) => _refreshTaskContext?.(taskId),
    getHistory, setHistory, add, showNotaRow,
    onNoSteps: () => mobileTutor?.onStepUpdate([], 0),
    getStudentName: () => ACTIVE_USER?.displayName || "",
    getActiveTaskAttachments,
    onRetryAnalysis: () => retryAnalysisRef(),
  }),
  ctxSubSteps: _ctxSubSteps,
  sessionLoadingEl: _sessionLoadingEl,
  stepMapPanel,
  mobileExercisePicker,
  exercisePicker,
  showModeQuestion: showModePicker,
  startStreamingBubble: __chatUI.startStreamingBubble,
  appendStreamToken: __chatUI.appendStreamToken,
  finalizeStreamingBubble: __chatUI.finalizeStreamingBubble,
}));
const safeSend = __send.safeSend;
sendText = __send.sendText;

retryAnalysisRef = () => {
  const taskId = getActiveTaskContext()?.id;
  if (taskId) __send.initSession(taskId, getActiveTaskMode());
};
installStatementUploadedHandler({ initSession: __send.initSession, getActiveTaskMode });

// Cablear "Cambiar ejercicio" — se puede activar tras tener acceso a todas las deps
stepMapPanel.setOnChangeExercise(createChangeExerciseHandler({
  stepMapPanel,
  stepsPlaceholder: _stepsPlaceholder,
  mobileExercisePicker,
  exercisePicker,
  sessionLoadingEl: _sessionLoadingEl,
  showTyping,
  hideTyping,
  add,
  getHistory,
  setHistory,
}));

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
const bindOnce = bindCoreUI(buildCoreUIConfig({
  inp,
  btn,
  kbd,
  pad,
  micBtn,
  scrollEl,
  insertAtCursor,
  getHistory,
  setHistory,
  safeSend,
  sendText,
  ensureComposerInteractive,
  autoGrowInput,
  update,
  renderPreview,
  getPendingImage: () => pendingImage,
  setPendingImage: (v) => { pendingImage = v; },
  showAttachPreview,
  hideAttachPreview,
  updatePadLayout,
  add,
  addImageAttachment,
}));

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

// Alumno de academia: sin agenda, sin tarea de profesor que clicar — pide
// (o crea) la tarea de sistema "sesión libre" del día y entra al tutor con
// ella por el mismo camino que un click de tarjeta (enterTask). Si falla,
// muestra la agenda (vacía, sin botón de acceso, pero visible) en vez de
// dejar la pantalla en blanco para siempre.
if (tenantType === "academia") {
  startSesionLibre({ apiFetch, selectTaskRef, onFailure: () => metaMode.showAgenda() });
}
}
