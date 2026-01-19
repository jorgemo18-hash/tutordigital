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
      name: fileName || "archivo.pdf",
      mime: fileMime || "application/pdf",
    };
  }

  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  let data = {};
  try { data = await r.json(); } catch {}

  if (!r.ok) throw new Error((data && data.error) || "API error");

  return (data && (data.text || data.answer || data.response)) || "";
}