// assets/features/chat/chatapi.js
// Cliente ligero para /api/v1/chat

import { getHistory } from "../../student/state/storage.js";
import { apiFetch } from "./auth.js";

const DEBUG = (() => {
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

const DEFAULT_TIMEOUT_MS = 25000;

function buildPayload({ text, mode, studentCourse, imageDataUrl, pdfImageDataUrl, fileDataUrl, fileName, fileMime } = {}) {
  const hist = getHistory();
  const messages = Array.isArray(hist)
    ? hist.map((m) => ({ role: m.role, content: m.content }))
    : [];

  const payload = {
    messages,
    text: text || "",
    mode: mode || "",
    attemptsSameError: 0,
    studentCourse: studentCourse || "",
  };

  if (imageDataUrl) payload.image = imageDataUrl;
  if (pdfImageDataUrl) payload.pdfImageDataUrl = pdfImageDataUrl;

  if (fileDataUrl) {
    payload.file = {
      dataUrl: fileDataUrl,
      name: fileName || (fileMime === "application/pdf" ? "archivo.pdf" : "archivo"),
      mime: fileMime || undefined,
    };
  }

  return payload;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await apiFetch(url, { ...options, signal: controller.signal });
    return r;
  } finally {
    try { clearTimeout(id); } catch {}
  }
}

async function parseResponse(r) {
  let data = null;
  let rawText = "";
  const ctype = String(r.headers.get("content-type") || "");
  if (ctype.includes("application/json")) {
    try { data = await r.json(); } catch {}
  } else {
    try { rawText = await r.text(); } catch {}
  }

  if (!data && !rawText) {
    try { rawText = await r.text(); } catch {}
  }

  return { data, rawText };
}

export async function askGPT({
  text,
  mode,
  studentCourse,
  imageDataUrl,
  pdfImageDataUrl,
  fileDataUrl,
  fileName,
  fileMime,
  timeoutMs,
} = {}) {
  const payload = buildPayload({ text, mode, studentCourse, imageDataUrl, pdfImageDataUrl, fileDataUrl, fileName, fileMime });
  if (DEBUG) {
    try { console.debug("[chatapi] payload", payload); } catch {}
  }

  let r;
  try {
    r = await fetchWithTimeout("/api/v1/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }, Number(timeoutMs) > 0 ? Number(timeoutMs) : DEFAULT_TIMEOUT_MS);
  } catch (err) {
    const e = new Error("El servidor no responde ahora mismo. Prueba otra vez.");
    e.status = 0;
    e.code = err?.name === "AbortError" ? "timeout" : "network_error";
    e.request_id = null;
    e._raw = { err };
    throw e;
  }

  const { data, rawText } = await parseResponse(r);

  if (!r.ok) {
    const errObj = data && typeof data.error === "object" ? data.error : null;
    const errMsg =
      (errObj && errObj.message) ||
      (data && data.message) ||
      (rawText && rawText.slice(0, 160)) ||
      `Error ${r.status}`;

    const code = (errObj && errObj.code) || (data && (data.code || data.error_code));
    const requestId =
      (data && (data.requestId || data.request_id || data.req_id)) ||
      r.headers.get("x-request-id");

    // Mensaje “humano” + ID para buscar en logs
    const human =
      (code ? `[${code}] ` : "") +
      errMsg +
      (requestId ? ` (ID: ${requestId})` : "");

    const e = new Error(human);
    e.status = data?.status || r.status;
    e.code = code || null;
    e.request_id = requestId || null;
    // Conserva el payload por si quieres debug en dev
    e._raw = { data, rawText };
    throw e;
  }

  const textOut =
    (data && (data.text || data.answer || data.response)) ||
    (data && data.data && (data.data.reply || data.data.text)) ||
    "";
  if (data && typeof data === "object") {
    return { ...data, text: textOut };
  }
  return textOut;
}
