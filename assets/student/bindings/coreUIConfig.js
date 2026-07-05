import { STATE } from "../state/state.js";
import { stopMic, toggleMic } from "../controllers/mic.js";
import { initAttach } from "../attachments/attach.js";
import { pdfFirstPageToPngDataURL, fileToDataURL } from "../js/features/tasks.js";

// Ensambla el objeto de configuración de bindCoreUI — mismo tratamiento que
// sendControllerConfig.js: la función bindCoreUI no cambia, solo se mueve
// fuera de student.js la asignación de sus propiedades.
export function buildCoreUIConfig({
  inp, btn, kbd, pad, micBtn, scrollEl,
  insertAtCursor,
  getHistory, setHistory,
  safeSend, sendText,
  ensureComposerInteractive, autoGrowInput, update, renderPreview,
  getPendingImage, setPendingImage,
  showAttachPreview, hideAttachPreview,
  updatePadLayout,
  add, addImageAttachment,
}) {
  return {
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

    // pending image (para que coreUI.js no "toque" variables del index)
    getPendingImage,
    setPendingImage,

    // attach preview UI
    showAttachPreview,
    hideAttachPreview,

    // layout
    updatePadLayout,

    // chat renderer
    add,
    addImageAttachment,
  };
}
