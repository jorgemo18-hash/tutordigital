// assets/features/chat/chatapi.js
// Cliente ligero para /api/chat

import { getHistory } from "../../lib/storage.js";

/**
 * Llama a /api/chat con el historial + texto + modo (+ imagen opcional).
 * Devuelve el texto de respuesta del backend.
 */
export async function askGPT({ text, imageDataUrl, mode } = {}) {
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