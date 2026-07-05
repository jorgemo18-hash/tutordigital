import { setPendingFirstQuestion, getSelectedTopic, currentMode, modeChosen } from "./mode.js";
import { askGPT } from "../../shared/js/chatapi.js";
import { startSession, chooseExercise } from "../../shared/js/sessionapi.js";
import { stopMic } from "./mic.js";
import { STATE } from "../state/state.js";

// Ensambla el objeto de configuración de createSendController — la función
// en sí no cambia, esto solo mueve fuera de student.js la asignación de sus
// ~30 propiedades. Los valores mutables de student.js (pendingImage,
// autoScrollUnlocked...) llegan como getter/setter explícitos; los que solo
// vienen de otro módulo (modo, sesión, mic) se re-importan aquí en vez de
// pasarse como parámetro, porque no son closures sobre el scope de
// student.js.
export function buildSendControllerConfig({
  inp, btn, sendIn, scrollEl,
  getPendingImage, setPendingImage,
  hideAttachPreview, setAttachSending,
  update, renderPreview, autoGrowInput,
  add, addImageAttachment, addFileAttachment,
  setAutoScrollUnlocked,
  getHistory, setHistory,
  showTyping, hideTyping,
  rerenderPendingMath,
  unlockInitialScroll,
  debug,
  onSessionReady,
  ctxSubSteps, sessionLoadingEl,
  stepMapPanel,
  mobileExercisePicker, exercisePicker,
  showModeQuestion,
  startStreamingBubble, appendStreamToken, finalizeStreamingBubble,
}) {
  return {
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
    showModeQuestion,
    getPendingImage,
    setPendingImage,
    hideAttachPreview,
    setAttachSending,
    update,
    renderPreview,
    autoGrowInput,
    stopMic,
    add,
    addImageAttachment,
    addFileAttachment,
    setAutoScrollUnlocked,
    getHistory,
    setHistory,
    askGPT,
    getCurrentMode: () => currentMode,
    showTyping,
    hideTyping,
    rerenderPendingMath,
    unlockInitialScroll,
    debug,
    // ── Sesión del tutor IA ────────────────────────────────────────────────
    startSessionFn:   startSession,
    chooseExerciseFn: chooseExercise,
    onSessionReady,
    showSessionLoading: () => {
      if (ctxSubSteps) ctxSubSteps.hidden = false; // asegurar visibilidad aunque no haya adjunto del profesor
      sessionLoadingEl.hidden = false;
      if (window.matchMedia("(max-width: 768px)").matches) showTyping();
    },
    hideSessionLoading: () => {
      sessionLoadingEl.hidden = true;
      if (window.matchMedia("(max-width: 768px)").matches) hideTyping();
    },
    onStepCompleted: (stepMap) => stepMapPanel.update(stepMap),
    onEscalate: () => {},
    showExercisePicker: (exercises) => {
      const onMobile = window.matchMedia("(max-width: 768px)").matches;
      return onMobile ? mobileExercisePicker.show(exercises) : exercisePicker.show(exercises);
    },
    // ── Streaming SSE ──────────────────────────────────────────────────────
    startStreamingBubble,
    appendStreamToken,
    finalizeStreamingBubble,
  };
}
