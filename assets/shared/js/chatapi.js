// assets/features/chat/chatapi.js
// Cliente ligero para /api/v1/chat — soporta modo síncrono y streaming SSE.

import { getHistory } from "../../student/state/storage.js";
import { apiFetch } from "./auth.js";
import { getActiveTaskContext, getActiveTaskAttachments } from "../../student/features/agenda/taskContext.js";
import { getActiveSessionId, applyStepMap } from "./sessionapi.js";

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

async function fetchImageAttachmentUrls(attachments = []) {
  const imageAtts = attachments.filter(a => String(a?.mime || "").startsWith("image/") && a?.id);
  if (!imageAtts.length) return [];
  const results = await Promise.all(imageAtts.map(async (att) => {
    try {
      const r = await apiFetch(`/api/v1/attachments/${att.id}/signed-url`);
      if (!r.ok) return null;
      const body = await r.json().catch(() => ({}));
      const url  = body?.data?.url;
      return url ? { url, mime: att.mime } : null;
    } catch {
      return null;
    }
  }));
  return results.filter(Boolean);
}

function buildPayload({ text, mode, studentCourse, imageDataUrl, pdfImageDataUrl, fileDataUrl, fileName, fileMime } = {}) {
  const hist     = getHistory();
  // Truncar a 7999 chars por mensaje para no superar el límite del schema del servidor
  const messages = Array.isArray(hist) ? hist.map((m) => ({ role: m.role, content: String(m.content || "").slice(0, 7999) })) : [];

  const payload = {
    messages,
    text:              text || "",
    mode:              mode || "",
    attemptsSameError: 0,
    studentCourse:     studentCourse || "",
  };

  // Adjuntar sessionId si hay sesión activa
  const sessionId = getActiveSessionId();
  if (sessionId) payload.sessionId = sessionId;

  const taskCtx = getActiveTaskContext();
  if (taskCtx?.title) {
    payload.taskContext = { title: taskCtx.title, description: taskCtx.desc || "" };
  }

  if (imageDataUrl)    payload.image           = imageDataUrl;
  if (pdfImageDataUrl) payload.pdfImageDataUrl = pdfImageDataUrl;
  if (fileDataUrl) {
    payload.file = {
      dataUrl: fileDataUrl,
      name:    fileName || (fileMime === "application/pdf" ? "archivo.pdf" : "archivo"),
      mime:    fileMime || undefined,
    };
  }

  return payload;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await apiFetch(url, { ...options, signal: controller.signal });
  } finally {
    try { clearTimeout(id); } catch {}
  }
}

async function parseResponse(r) {
  let data = null, rawText = "";
  const ctype = String(r.headers.get("content-type") || "");
  if (ctype.includes("application/json")) { try { data = await r.json(); } catch {} }
  else { try { rawText = await r.text(); } catch {} }
  if (!data && !rawText) { try { rawText = await r.text(); } catch {} }
  return { data, rawText };
}

// ── askGPT ─────────────────────────────────────────────────────────────────
// Sin onToken → respuesta síncrona JSON (compatible con código anterior).
// Con onToken + sessionId activo → streaming SSE.

export async function askGPT({
  text, mode, studentCourse, imageDataUrl, pdfImageDataUrl,
  fileDataUrl, fileName, fileMime, timeoutMs,
  onToken,         // callback(token: string) — activa streaming
  onStepCompleted, // callback(stepMap)       — paso completado
  onEscalate,      // callback(reason)        — escalado al profesor
} = {}) {
  const payload = buildPayload({ text, mode, studentCourse, imageDataUrl, pdfImageDataUrl, fileDataUrl, fileName, fileMime });

  const taskAttachments = getActiveTaskAttachments();
  if (taskAttachments.length > 0) {
    const attachmentUrls = await fetchImageAttachmentUrls(taskAttachments);
    if (attachmentUrls.length > 0) {
      if (!payload.taskContext) payload.taskContext = {};
      payload.taskContext.attachmentUrls = attachmentUrls;
    }
  }

  if (DEBUG) { try { console.debug("[chatapi] payload", payload); } catch {} }

  // Streaming — solo si hay sessionId Y callback onToken
  if (typeof onToken === "function" && payload.sessionId) {
    return askGPTStreaming(payload, { onToken, onStepCompleted, onEscalate, timeoutMs });
  }

  // Síncrono
  let r;
  try {
    r = await fetchWithTimeout(
      "/api/v1/chat",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      Number(timeoutMs) > 0 ? Number(timeoutMs) : DEFAULT_TIMEOUT_MS
    );
  } catch (err) {
    const e = new Error("El servidor no responde ahora mismo. Prueba otra vez.");
    e.status = 0; e.code = err?.name === "AbortError" ? "timeout" : "network_error";
    e.request_id = null; e._raw = { err };
    throw e;
  }

  const { data, rawText } = await parseResponse(r);

  if (!r.ok) {
    const errObj    = data && typeof data.error === "object" ? data.error : null;
    const errMsg    = errObj?.message || data?.message || rawText?.slice(0, 160) || `Error ${r.status}`;
    const code      = errObj?.code || data?.code || data?.error_code;
    const requestId = data?.requestId || data?.request_id || r.headers.get("x-request-id");
    const human     = (code ? `[${code}] ` : "") + errMsg + (requestId ? ` (ID: ${requestId})` : "");
    const e = new Error(human);
    e.status = data?.status || r.status; e.code = code || null;
    e.request_id = requestId || null; e._raw = { data, rawText };
    throw e;
  }

  const textOut =
    (data?.text || data?.answer || data?.response) ||
    (data?.data && (data.data.reply || data.data.text)) || "";

  return data && typeof data === "object" ? { ...data, text: textOut } : textOut;
}

// ── Streaming interno ──────────────────────────────────────────────────────

async function askGPTStreaming(payload, { onToken, onStepCompleted, onEscalate, timeoutMs } = {}) {
  let r;
  try {
    r = await fetchWithTimeout(
      "/api/v1/chat",
      {
        method:  "POST",
        headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
        body:    JSON.stringify({ ...payload, stream: true }),
      },
      Number(timeoutMs) > 0 ? Number(timeoutMs) : 60_000
    );
  } catch (err) {
    const e = new Error("El servidor no responde ahora mismo. Prueba otra vez.");
    e.status = 0; e.code = err?.name === "AbortError" ? "timeout" : "network_error";
    throw e;
  }

  if (!r.ok) {
    const b   = await r.json().catch(() => ({}));
    const msg = b?.error?.message || `Stream error ${r.status}`;
    const e   = new Error(msg); e.status = r.status;
    throw e;
  }

  const reader  = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer    = "";
  let fullText  = "";

  while (true) {
    let done, value;
    try { ({ done, value } = await reader.read()); } catch { break; }
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      let event;
      try { event = JSON.parse(line.slice(6)); } catch { continue; }

      if (event.type === "token") {
        fullText += event.text;
        try { onToken(event.text); } catch {}
      } else if (event.type === "step_completed") {
        if (event.stepMap) applyStepMap(event.stepMap);
        try { onStepCompleted?.(event.stepMap); } catch {}
      } else if (event.type === "escalate") {
        try { onEscalate?.(event.reason); } catch {}
      } else if (event.type === "error") {
        const e = new Error(event.message || "Stream error");
        e.code = event.code;
        throw e;
      }
    }
  }

  return { text: fullText, ok: true };
}
