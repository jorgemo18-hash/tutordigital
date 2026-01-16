// assets/features/chat/chatapi.js
// Cliente ligero para /api/chat

import { getHistory } from "../../lib/storage.js";

export async function askGPT({ text, imageDataUrl, mode } = {}) {
  const hist = getHistory();
  const messages = hist.map((m) => ({ role: m.role, content: m.content }));

  const payload = { messages, text: text || "", mode: mode || "" };
  if (imageDataUrl) payload.image = imageDataUrl;

  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || "API error");
  return data?.text ? data.text : "No he podido responder ahora mismo.";
}