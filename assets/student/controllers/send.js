// assets/app/controllers/send.js

import { getFileKind } from "../lib/files.js";
import { pushAssistant, pushUser } from "../lib/chatlog.js";

function normalizeStudentCourse(raw = "") {
  const s = String(raw || "").trim();
  if (!s) return "";
  // Normaliza espacios y mayúsculas
  return s
    .replace(/\s+/g, " ")
    .replace(/eso/gi, "ESO")
    .replace(/bach/gi, "Bach")
    .replace(/bachillerato/gi, "Bachillerato")
    .replace(/primaria/gi, "Primaria")
    .trim();
}

function extractStudentCourseFromText(text = "") {
  const t = String(text || "").trim();
  if (!t) return "";

  // Ejemplos que queremos captar:
  // "3 eso", "3º eso", "4 primaria", "4º primaria", "2 bach", "2º bachillerato"
  const m1 = t.match(/\b([4-6])\s*º?\s*(primaria)\b/i);
  if (m1) return normalizeStudentCourse(`${m1[1]} Primaria`);

  const m2 = t.match(/\b([1-4])\s*º?\s*(eso)\b/i);
  if (m2) return normalizeStudentCourse(`${m2[1]} ESO`);

  const m3 = t.match(/\b([1-2])\s*º?\s*(bach|bachillerato)\b/i);
  if (m3) return normalizeStudentCourse(`${m3[1]} Bachillerato`);

  // Si el alumno escribe algo tipo "3ESO" sin espacio:
  const m4 = t.match(/\b([1-4])\s*º?\s*ESO\b/i);
  if (m4) return normalizeStudentCourse(`${m4[1]} ESO`);

  return "";
}

function getStoredStudentCourse() {
  try {
    return normalizeStudentCourse(localStorage.getItem("ttd_studentCourse") || "");
  } catch {
    return "";
  }
}

function storeStudentCourse(course = "") {
  const c = normalizeStudentCourse(course);
  if (!c) return;
  try {
    localStorage.setItem("ttd_studentCourse", c);
  } catch {}
}

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

export function formatChatError(err, { isPDF, isImage, isDocx } = {}) {
  const status = Number(err?.status || err?.statusCode || err?.response?.status || 0) || 0;
  const code = String(err?.code || "").trim();
  const msg = String(err?.message || "").trim();
  const name = String(err?.name || "").toLowerCase();
  const raw = String(err?._raw || "");
  const combined = `${msg} ${code} ${name} ${raw}`.toLowerCase();

  // Fallo típico Safari/Chrome cuando se corta la red / CORS / fetch abort
  if (!status && (
      combined.includes("load failed") ||
      combined.includes("failed to fetch") ||
      combined.includes("network") ||
      combined.includes("internet") ||
      combined.includes("cors")
    )) {
    return "Parece un fallo de conexión. Revisa internet y vuelve a enviar el mensaje.";
  }

  // --- Red / CORS / corte de conexión / fetch ---
  // En browser suele venir como TypeError: Failed to fetch
  // o “Load failed / NetworkError / The network connection was lost”
  const netMsg = (msg || "").toLowerCase();
  const isNetwork =
    status === 0 &&
    (
      netMsg.includes("failed to fetch") ||
      netMsg.includes("load failed") ||
      netMsg.includes("networkerror") ||
      netMsg.includes("network error") ||
      netMsg.includes("connection") ||
      netMsg.includes("conexión") ||
      netMsg.includes("corte") ||
      netMsg.includes("lost") ||
      netMsg.includes("offline") ||
      netMsg.includes("cors")
    );

  if (isNetwork) {
    return "Se ha perdido la conexión (o el servidor no responde). Reintenta en unos segundos. Si estás en móvil, prueba a cambiar de Wi-Fi/datos.";
  }

  // --- Timeouts controlados (tu backend ahora debería devolver 504 server_timeout) ---
  if (status === 504 || /timeout/i.test(code) || /timed out/i.test(msg)) {
    if (isPDF || isDocx) {
      return "Ha tardado demasiado en procesar ese archivo. Prueba con un PDF más pequeño o envíame una foto de la página concreta.";
    }
    if (isImage) {
      return "Ha tardado demasiado en procesar la imagen. Reintenta (si pesa mucho, manda una foto más ligera o recortada).";
    }
    return "Ha tardado demasiado en responder. Reintenta en unos segundos.";
  }

  // --- Errores por archivo / formatos ---
  if (isPDF) {
    if (
      /unsupported|invalid_request|file|mime|format/i.test(code) ||
      /no contiene base64|dataurl|unsupported|invalid|file|pdf/i.test(msg) ||
      status === 400
    ) {
      return "Ese PDF ahora mismo no lo puedo leer. Prueba a exportarlo como PDF otra vez o envíame una foto de la página. Si me dices qué formato era (Word/Excel/etc.), te digo cómo convertirlo.";
    }
    if (status === 413 || /too large|payload too large|maximum/i.test(msg)) {
      return "El PDF es demasiado grande. Prueba con uno más pequeño o envía una foto de la página.";
    }
  }

  if (isDocx) {
    if (
      /unsupported|invalid_request|file|mime|format/i.test(code) ||
      /unsupported|invalid|file|docx|word/i.test(msg) ||
      status === 400
    ) {
      return "Ese DOCX ahora mismo no lo puedo leer bien. Prueba a exportarlo como PDF o envíame una foto de la página. Si me dices desde qué app lo has sacado (Word/Google Docs/etc.), te digo cómo convertirlo.";
    }
    if (status === 413 || /too large|payload too large|maximum/i.test(msg)) {
      return "El DOCX es demasiado grande. Prueba a exportarlo como PDF más pequeño o envía una foto de la página.";
    }
  }

  // --- Auth / rate limit ---
  if (code === "invalid_api_key" || code === "authentication_error" || status === 401) {
    return "Ahora mismo el servicio no puede responder. Inténtalo otra vez en un minuto.";
  }

  if (code === "rate_limit_exceeded" || status === 429) {
    return "Hay mucha carga ahora mismo. Espera unos segundos y prueba otra vez.";
  }

  // --- Errores 5xx genéricos ---
  if (status >= 500) {
    return "Ha ocurrido un error en el servidor. Reintenta en unos segundos.";
  }

  return "No he podido responder ahora mismo.";
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
} = {}) {
  const deps = { add, getHistory, setHistory };

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

      try { if (hasFile) setAttachSending?.(true); } catch {}
      const answer = await askGPT({
        text: modelText,
        imageDataUrl,
        fileDataUrl,
        fileName,
        fileMime,
        pdfImageDataUrl: a.pdfImageDataUrl || undefined,
        mode: typeof getCurrentMode === "function" ? getCurrentMode() : "",
        studentCourse,
      });

      const answerText = typeof answer === "string" ? answer : String(answer?.text || "");
      if (answer && typeof answer === "object" && answer.detectedStudentCourse && !storedCourse) {
        storeStudentCourse(answer.detectedStudentCourse);
      }

      pushAssistant(deps, answerText);

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
      } catch {
        console.error(err);
      }

      let msg = formatChatError(err, { isPDF: a.isPDF, isImage: a.isImage, isDocx: a.isDocx });
      if (err?.request_id) {
        // En producción esto es oro para depurar sin molestar al usuario: es corto.
        msg += ` (ref: ${String(err.request_id).slice(-12)})`;
      }

      pushAssistant(deps, msg);
    } finally {
      try { setAttachSending?.(false); } catch {}
      try { hideTyping?.(); } catch {}
      try { update?.(); } catch {}
      try { renderPreview?.(); } catch {}
      try { autoGrowInput?.(); } catch {}
      try { rerenderPendingMath?.(); } catch {}
      try { if (btn) btn.disabled = false; } catch {}
      try { if (sendIn) sendIn.disabled = false; } catch {}

      setTimeout(() => {
        try { inp && inp.focus(); } catch {}
      }, 0);
    }
  }

  return { safeSend, sendText };
}
