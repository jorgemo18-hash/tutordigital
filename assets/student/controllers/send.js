// assets/app/controllers/send.js

import { getFileKind } from "../lib/files.js";
import { pushAssistant, pushUser } from "../lib/chatlog.js";
import { 
  normalizeStudentCourse, 
  extractStudentCourseFromText, 
  getStoredStudentCourse, 
  storeStudentCourse 
} from "./studentCourse.js";
import { formatChatError } from "../lib/chatErrors.js";
import { initSession as initSessionExternal } from "./sessionInit.js";

export function getPendingAttachmentInfo(pending) {
  const pendingAttachment = pending || null;
  const file = pendingAttachment?.file || null;
  if (!file) {
    return {
      hasAttach: false,
      file: null,
      dataUrl: null,
      pdfImageDataUrl: null,
      name: "",
      type: "",
      suggestedMime: "",
      isImage: false,
      isPDF: false,
      isDocx: false,
      isWord: false,
      isSupportedForBackend: false,
    };
  }

  const info = getFileKind(file);
  return {
    hasAttach: true,
    file,
    dataUrl: pendingAttachment?.dataUrl || null,
    pdfImageDataUrl: pendingAttachment?.pdfImageDataUrl || null,
    name: info.name || "",
    type: info.type || "",
    suggestedMime: info.suggestedMime || "",
    isImage: info.isImage,
    isPDF: info.isPDF,
    isDocx: info.isDocx,
    isWord: info.isWord,
    isSupportedForBackend: info.isSupported,
  };
}

export function installAttachInvalidHandler({
  add,
  getHistory,
  setHistory,
  clearPending,
  hideAttachPreview,
  update,
  renderPreview,
} = {}) {
  const deps = { add, getHistory, setHistory };
  const handler = (ev) => {
    const f = ev?.detail?.file;
    const name = String(f?.name || "archivo");
    const msg =
      `No puedo leer ese archivo ("${name}"). ` +
      `Prueba a exportarlo como foto, DOCX o PDF. ` +
      `Si quieres, dime qué formato es y te ayudo a convertirlo.`;

    pushAssistant(deps, msg);
    try { clearPending?.(); } catch {}
    try { hideAttachPreview?.(); } catch {}
    try { update?.(); } catch {}
    try { renderPreview?.(); } catch {}
  };

  try { window.addEventListener("ttd:attach-invalid", handler); } catch {}
  return function cleanup() {
    try { window.removeEventListener("ttd:attach-invalid", handler); } catch {}
  };
}

export function installMicErrorHandler({ add, getHistory, setHistory } = {}) {
  const deps = { add, getHistory, setHistory };
  const handler = (ev) => {
    const msg = String(ev?.detail?.message || "El dictado ha fallado.");
    pushAssistant(deps, msg);
  };

  try { window.addEventListener("ttd:mic-error", handler); } catch {}
  return function cleanup() {
    try { window.removeEventListener("ttd:mic-error", handler); } catch {}
  };
}

export function createSendController({
  STATE,
  inp,
  btn,
  sendIn,
  forceScrollToBottom,
  getModeChosen,
  getSelectedTopic,
  setPendingFirstQuestion,
  showModeQuestion,
  getPendingImage,
  setPendingImage,
  hideAttachPreview,
  setAttachSending,
  setAutoScrollUnlocked,
  update,
  renderPreview,
  autoGrowInput,
  stopMic,
  add,
  addImageAttachment,
  addFileAttachment,
  getHistory,
  setHistory,
  askGPT,
  getCurrentMode,
  showTyping,
  hideTyping,
  rerenderPendingMath,
  unlockInitialScroll,
  debug,
  // ── Sesión del tutor IA (Arquitectura de dos agentes) ──────────────────
  startSessionFn,          // fn(taskId, mode) → Promise<{status, sessionId, exercises?, steps?, currentStep?}>
  chooseExerciseFn,        // fn(sessionId, exerciseIndex, exerciseTitle) → Promise<{steps, currentStep}>
  restoreSessionFn,        // fn(taskId) → Promise<{sessionId, steps, currentStep}|null> — restauración rápida
  onSessionReady,          // callback(steps, currentStep, exerciseCtx, isRestore) — renderiza step map
  showSessionLoading,      // fn() — pantalla de carga mientras el Guía trabaja
  hideSessionLoading,      // fn() — oculta pantalla de carga
  onStepCompleted,         // callback(stepMap) — paso completado detectado por Socrático
  onEscalate,              // callback(reason) — escalado al profesor
  showExercisePicker,      // fn(exercises [{index,title}]) → Promise<{index,title}|null>
  // ── Streaming SSE ──────────────────────────────────────────────────────
  startStreamingBubble,    // fn() → { bub, row }
  appendStreamToken,       // fn(bub, token)
  finalizeStreamingBubble, // fn(bub, fullText)
} = {}) {
  const deps = { add, getHistory, setHistory };

  // ── initSession — restauración rápida o creación nueva ──────────────────
  const initSession = (taskId, mode) => initSessionExternal(taskId, mode, {
    startSessionFn,
    restoreSessionFn,
    onSessionReady,
    showSessionLoading,
    hideSessionLoading,
    showExercisePicker,
    chooseExerciseFn
  });

  async function safeSend() {
    try { setAutoScrollUnlocked?.(); } catch {}
    unlockInitialScroll?.();
    try { if (STATE?.isRecording) stopMic?.(); } catch {}

    let text = (inp?.value || "").trim();
    const a = getPendingAttachmentInfo(getPendingImage?.());
    const fromBoard = /^pizarra_/i.test(String(a?.name || ""));
    const hasFile = a.hasAttach;

    if (fromBoard && text) {
      text = `(Origen: pizarra) ${text}`;
    }

    if (hasFile && !a.isSupportedForBackend) {
      const name = String(a.name || "archivo");
      const msg =
        `No puedo leer ese archivo ("${name}"). ` +
        `Prueba a exportarlo como foto, DOCX o PDF. ` +
        `Si quieres, dime qué formato es y te ayudo a convertirlo.`;

      try { pushAssistant(deps, msg); } catch {}

      try { setPendingImage?.(null); } catch {}
      try { hideAttachPreview?.(); } catch {}
      try { update?.(); } catch {}
      try { renderPreview?.(); } catch {}
      return;
    }

    if (!text && !hasFile) return;

    try {
      inp.value = "";
      update?.();
      renderPreview?.();
    } catch {}

    try {
      if (inp) inp.style.height = "auto";
      autoGrowInput?.();
    } catch {}

    try {
      if (hasFile) {
        if (a.isImage) {
          addImageAttachment?.(a.file);
          if (text) {
            pushUser(deps, text);
          }
        } else if (a.isPDF || a.isDocx) {
          const name = String(a.name || (a.isPDF ? "PDF" : "DOCX"));
          addFileAttachment?.({
            name,
            kind: a.isPDF ? "pdf" : "docx",
            thumbDataUrl: a.pdfImageDataUrl || null,
          });
          if (text) pushUser(deps, text);
        }
        hideAttachPreview?.();
      }
    } catch {}

    try { forceScrollToBottom?.(); } catch {}

    STATE.fromDictation = false;

    const modeReady = typeof getModeChosen === "function" ? !!getModeChosen() : true;
    const selectedTopic = typeof getSelectedTopic === "function"
      ? String(getSelectedTopic() || "").trim()
      : "";

    if (!modeReady) {
      if (text) {
        try { pushUser(deps, text); } catch {}
      }
      try { setPendingFirstQuestion?.(text); } catch {}
      try {
        const msg = "Elige qué toca hoy: Deberes, Exámenes o Trabajo.";
        const hist = typeof getHistory === "function" ? getHistory() : [];
        const last = hist[hist.length - 1];
        if (!last || String(last.content || "") !== msg) {
          pushAssistant(deps, msg);
        }
      } catch {}
      try { showModeQuestion?.({ add, getHistory, setHistory }); } catch {}
      return;
    }
    if (!selectedTopic) {
      if (text) {
        try { pushUser(deps, text); } catch {}
      }
      try { setPendingFirstQuestion?.(text); } catch {}
      return;
    }

    try {
      if (typeof sendText === "function") {
        if (hasFile) {
          const userText = text;
          await sendText(userText, { silentUser: true });
        } else {
          await sendText(text);
        }

        setTimeout(() => {
          try { inp && inp.focus(); } catch {}
        }, 0);
        return;
      }
    } catch (err) {
      console.error("sendText() falló:", err);
    }

    try {
      if (text) {
        pushUser(deps, text);
      }
      inp.value = "";
      update?.();
      renderPreview?.();
    } catch (e) {
      console.error("No se pudo enviar ni pintar el mensaje:", e);
    }
  }

  async function sendText(text, opts = {}) {
    const rawText = String(text || "").trim();
    let t = rawText;
    const a = getPendingAttachmentInfo(getPendingImage?.());
    const hasFile = a.hasAttach;
    const fromBoard = /^pizarra_/i.test(String(a?.name || ""));

    if (!t && !hasFile) return;

    if (fromBoard && t) {
      t = `(Origen: pizarra) ${t}`;
    }

    const silentUser = !!opts.silentUser;

    if (hasFile && !a.isSupportedForBackend) {
      if (!silentUser) {
        const name = String(a.name || "archivo");
        const msg =
          `No puedo leer ese archivo ("${name}"). ` +
          `Prueba a exportarlo como foto, DOCX o PDF. ` +
          `Si quieres, dime qué formato es y te ayudo a convertirlo.`;

        try { pushAssistant(deps, msg); } catch {}
      }

      try { setPendingImage?.(null); } catch {}
      try { hideAttachPreview?.(); } catch {}
      try { update?.(); } catch {}
      try { renderPreview?.(); } catch {}
      return;
    }

    const modeReady = typeof getModeChosen === "function" ? !!getModeChosen() : true;
    const selectedTopic = typeof getSelectedTopic === "function"
      ? String(getSelectedTopic() || "").trim()
      : "";

    if (!modeReady && !silentUser) {
      if (t) {
        try { pushUser(deps, t); } catch {}
      }
      try { setPendingFirstQuestion?.(t); } catch {}
      try {
        const msg = "Elige qué toca hoy: Deberes, Exámenes o Trabajo.";
        const hist = typeof getHistory === "function" ? getHistory() : [];
        const last = hist[hist.length - 1];
        if (!last || String(last.content || "") !== msg) {
          pushAssistant(deps, msg);
        }
      } catch {}
      try { showModeQuestion?.({ add, getHistory, setHistory }); } catch {}
      update?.();
      return;
    }
    if (!selectedTopic && !silentUser) {
      if (t) {
        try { pushUser(deps, t); } catch {}
      }
      try { setPendingFirstQuestion?.(t); } catch {}
      update?.();
      return;
    }

    if (!silentUser && t) {
      pushUser(deps, t);
    }

    if (!silentUser && hasFile && !t && a.isImage) {
      try { addImageAttachment?.(a.file); } catch {}
    }

    try { if (btn) btn.disabled = true; } catch {}
    try { if (sendIn) sendIn.disabled = true; } catch {}
    try { showTyping?.(); } catch {}

    let _dailyLimit = false;
    try {
      const storedCourse = getStoredStudentCourse();
      const extractedCourse = (!storedCourse && !silentUser)
        ? extractStudentCourseFromText(rawText)
        : "";
      const studentCourse = storedCourse || extractedCourse;

      if (!storedCourse && extractedCourse) {
        storeStudentCourse(extractedCourse);
      }

      let imageDataUrl = a.isImage ? (a.dataUrl || null) : null;
      if (a.isImage && !imageDataUrl && a.file) {
        imageDataUrl = await new Promise((resolve) => {
          try {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result || ""));
            r.onerror = () => resolve("");
            r.readAsDataURL(a.file);
          } catch {
            resolve("");
          }
        });
        if (!imageDataUrl) imageDataUrl = null;
      }
      // Normalize: mobile browsers can return data:application/octet-stream when
      // file.type is empty. Patch the MIME prefix so chatValidation accepts it.
      if (imageDataUrl && imageDataUrl.startsWith("data:") && !/^data:image\//i.test(imageDataUrl)) {
        const b64idx = imageDataUrl.indexOf("base64,");
        if (b64idx !== -1) imageDataUrl = "data:image/jpeg;base64," + imageDataUrl.slice(b64idx + 7);
      }

      const isFile = a.isPDF || a.isDocx;
      const fileDataUrl = isFile ? (a.dataUrl || null) : null;
      const fileName = isFile
        ? String(a.name || (a.isPDF ? "archivo.pdf" : "archivo.docx"))
        : undefined;

      const fileMime = isFile
        ? (a.type || a.suggestedMime || (a.isPDF
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
        : undefined;

      let modelText = t;
      if (imageDataUrl && !silentUser) {
        modelText =
          "Analiza la imagen adjunta y ayúdame con ello." +
          (t ? `\n\nTexto del alumno: ${t}` : "");
      }
      if (fromBoard) {
        modelText += "\n\nSi una imagen viene de pizarra y no la entiendes, pide que la redibuje o la escriba.";
      }
      if (hasFile) {
        const confirmMsg =
          "Primero, confirma brevemente que ves el adjunto y resume qué contiene (1-2 frases). " +
          "Luego pregunta qué parte quiere trabajar o por qué ejercicio empezar. " +
          "Después responde a lo que haya escrito el alumno, si aplica.\n\n";
        modelText = confirmMsg + (modelText || "El alumno no escribió texto adicional.");
      }

      try { if (hasFile) setAttachSending?.(true); } catch {}

      const hasStreaming =
        typeof startStreamingBubble    === "function" &&
        typeof appendStreamToken       === "function" &&
        typeof finalizeStreamingBubble === "function";

      let streamBub = null;

      if (hasStreaming) {
        // Streaming — crear burbuja vacía antes de llamar a la API.
        // No usamos showTyping porque la burbuja ya actúa de indicador.
        try { hideTyping?.(); } catch {}
        try {
          const { bub } = startStreamingBubble();
          streamBub = bub;
        } catch {}
      }

      const answer = await askGPT({
        text:            modelText,
        imageDataUrl,
        fileDataUrl,
        fileName,
        fileMime,
        pdfImageDataUrl: a.pdfImageDataUrl || undefined,
        mode:            typeof getCurrentMode === "function" ? getCurrentMode() : "",
        studentCourse,
        // Callbacks de streaming — solo activos cuando hasStreaming y hay sessionId
        onToken:         hasStreaming ? (token) => { try { appendStreamToken(streamBub, token); } catch {} } : undefined,
        onStepCompleted: hasStreaming ? (stepMap) => { try { onStepCompleted?.(stepMap); } catch {} } : undefined,
        onEscalate:      hasStreaming ? (reason)  => { try { onEscalate?.(reason); }      catch {} } : undefined,
      });

      const answerText = typeof answer === "string" ? answer : String(answer?.text || "");
      if (answer && typeof answer === "object" && answer.detectedStudentCourse && !storedCourse) {
        storeStudentCourse(answer.detectedStudentCourse);
      }

      if (hasStreaming && streamBub) {
        // Finalizar burbuja con texto completo renderizado (HTML + KaTeX)
        try { finalizeStreamingBubble(streamBub, answerText); } catch {}
        // Solo actualizar historial — la UI ya está en el DOM
        try {
          const hist = typeof getHistory === "function" ? getHistory() : [];
          hist.push({ role: "assistant", content: answerText });
          typeof setHistory === "function" && setHistory(hist);
        } catch {}
      } else {
        pushAssistant(deps, answerText);
      }

      try { setPendingImage?.(null); } catch {}
      try { hideAttachPreview?.(); } catch {}

    } catch (err) {
      try {
        console.error("sendText error:", {
          message: err?.message,
          status: err?.status,
          code: err?.code,
          request_id: err?.request_id,
          raw: err?._raw,
        });
        console.error("sendText error (JSON):", JSON.stringify({
          message: err?.message,
          status: err?.status,
          code: err?.code,
          request_id: err?.request_id,
        }));
      } catch {
        console.error(err);
      }

      _dailyLimit = err?.code === "daily_limit_reached";

      let msg = formatChatError(err, { isPDF: a.isPDF, isImage: a.isImage, isDocx: a.isDocx });
      if (!_dailyLimit && err?.request_id) {
        // En producción esto es oro para depurar sin molestar al usuario: es corto.
        msg += ` (ref: ${String(err.request_id).slice(-12)})`;
      }

      pushAssistant(deps, msg);

      if (_dailyLimit) {
        try { if (inp)    inp.style.display    = "none"; } catch {}
        try { if (btn)    btn.style.display    = "none"; } catch {}
        try { if (sendIn) sendIn.style.display = "none"; } catch {}
      }
    } finally {
      try { setAttachSending?.(false); } catch {}
      try { hideTyping?.(); } catch {}
      try { update?.(); } catch {}
      try { renderPreview?.(); } catch {}
      try { autoGrowInput?.(); } catch {}
      try { rerenderPendingMath?.(); } catch {}

      if (!_dailyLimit) {
        try { if (btn)    btn.disabled    = false; } catch {}
        try { if (sendIn) sendIn.disabled = false; } catch {}
        setTimeout(() => {
          try { inp && inp.focus(); } catch {}
        }, 0);
      }
    }
  }

  return { safeSend, sendText, initSession };
}
