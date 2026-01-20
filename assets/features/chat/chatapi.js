// assets/features/chat/chatapi.js
// Cliente ligero para /api/chat

import { getHistory } from "../../lib/storage.js";

export async function askGPT({
  text,
  mode,
  imageDataUrl,
  fileDataUrl,
  fileName,
  fileMime,
} = {}) {
  const hist = getHistory();
  const messages = Array.isArray(hist)
    ? hist.map((m) => ({ role: m.role, content: m.content }))
    : [];

  const payload = {
    messages,
    text: text || "",
    mode: mode || "",
  };

  if (imageDataUrl) payload.image = imageDataUrl;

  if (fileDataUrl) {
    payload.file = {
      dataUrl: fileDataUrl, // data:application/pdf;base64,...
     name: fileName || (fileMime === "application/pdf" ? "archivo.pdf" : "archivo"),
  }

  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  // Intentamos JSON; si no, caemos a texto
  let data = null;
  let rawText = "";
  try {
    data = await r.json();
  } catch {
    try { rawText = await r.text(); } catch {}
    data = null;
  }

  if (!r.ok) {
    // Backend recomendado: { error, code, status, request_id }
    const errMsg =
      (data && (data.error || data.message)) ||
      (rawText && rawText.slice(0, 160)) ||
      `Error ${r.status}`;

    const code = data && (data.code || data.error_code);
    const requestId = data && (data.request_id || data.requestId || data.req_id);

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

  return (data && (data.text || data.answer || data.response)) || "";
}