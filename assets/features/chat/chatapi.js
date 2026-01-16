// assets/features/chat/chatapi.js
// Cliente ligero para /api/chat (robusto: maneja 404/HTML y fallback desde iframe)

import { getHistory } from "../../lib/storage.js";

function buildCandidates() {
  // Normal: misma origin
  const here = new URL("/api/chat", window.location.origin).toString();

  // Si estamos dentro de un iframe, a veces conviene intentar la origin del padre
  // (solo funciona si es same-origin; si no, lo ignoramos).
  let topOriginUrl = null;
  try {
    const topOrigin = window.top && window.top.location && window.top.location.origin;
    if (topOrigin) topOriginUrl = new URL("/api/chat", topOrigin).toString();
  } catch {
    topOriginUrl = null;
  }

  // De-dup
  const out = [here, topOriginUrl].filter(Boolean);
  return Array.from(new Set(out));
}

async function fetchJsonOrText(url, payload) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  // Puede devolver HTML (404/500). Intentamos JSON pero caemos a texto.
  let data = null;
  let rawText = "";
  try {
    data = await r.json();
  } catch {
    try {
      rawText = await r.text();
    } catch {}
  }

  return { r, data, rawText };
}

export async function askGPT({ text, imageDataUrl, mode } = {}) {
  const hist = getHistory();
  const messages = hist.map((m) => ({ role: m.role, content: m.content }));

  const payload = { messages, text: text || "", mode: mode || "" };
  if (imageDataUrl) payload.image = imageDataUrl;

  const candidates = buildCandidates();
  let lastErr = null;

  for (const url of candidates) {
    try {
      const { r, data, rawText } = await fetchJsonOrText(url, payload);

      if (!r.ok) {
        const msg =
          (data && (data.error || data.message)) ||
          (rawText ? rawText.slice(0, 160) : "") ||
          `HTTP ${r.status}`;

        const err = new Error(msg);
        err.status = r.status;
        err.url = url;
        throw err;
      }

      const answer = data && typeof data.text === "string" ? data.text : "";
      return answer || "No he podido responder ahora mismo.";
    } catch (e) {
      lastErr = e;
      // probamos siguiente candidato
    }
  }

  // Log útil para debug en consola
  try {
    console.error("askGPT fallo:", {
      message: String(lastErr && lastErr.message),
      status: lastErr && lastErr.status,
      url: lastErr && lastErr.url,
    });
  } catch {}

  throw lastErr || new Error("API error");
}
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