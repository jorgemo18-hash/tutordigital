import Anthropic from "@anthropic-ai/sdk";
import * as mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { getBase64FromMaybeDataUrl, MAX_FILENAME_CHARS } from "./chatValidation.js";
import { buildTutorInstructions, procesarRespuestaTutor } from "./chatPrompt.js";

export { validateChatBody } from "./chatValidation.js";

// ── Utils ──────────────────────────────────────────────────────────────────

function truncateText(input = "", max = 120_000) {
  const t = String(input || "");
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n\n[...contenido truncado...]`;
}

function userFacingMessage(status, code) {
  if (status === 401) return "Error de autenticación con el proveedor. Avísanos (ID incluido).";
  if (status === 413) return "El archivo es demasiado grande. Prueba con uno más pequeño.";
  if (status === 429) return "Ahora mismo hay demasiadas peticiones. Prueba en unos segundos.";
  if (status >= 500) return "Ha ocurrido un error al procesar tu petición.";
  if (code === "invalid_request_error") return "Petición no válida. Revisa el archivo o el texto.";
  return "No he podido procesar tu petición.";
}

// ── File extraction ────────────────────────────────────────────────────────

async function extractFileContent(fileDataUrl, fileName = "", fileMime = "") {
  if (!fileDataUrl) return [];

  const filenameRaw = String(fileName || "archivo");
  const safeName = filenameRaw.replace(/[\/\\]/g, "_").slice(0, MAX_FILENAME_CHARS);
  const mimeRaw = String(fileMime || "");
  const lower = safeName.toLowerCase();
  const ext = lower.includes(".") ? lower.split(".").pop() : "";

  const isPDF = mimeRaw === "application/pdf" || (!mimeRaw && ext === "pdf");
  const isDocx =
    mimeRaw === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    (!mimeRaw && ext === "docx");

  if (!isPDF && !isDocx) return [];

  const base64 = getBase64FromMaybeDataUrl(fileDataUrl);
  if (!base64) return [];

  const buf = Buffer.from(base64, "base64");
  const content = [];

  if (isDocx) {
    let extracted = "";
    try {
      const result = await mammoth.extractRawText({ buffer: buf });
      extracted = String(result?.value || "").replace(/\r/g, "").trim();
    } catch {}

    if (extracted) {
      content.push({
        type: "text",
        text: `Contenido del Word (${safeName}):\n\n${truncateText(extracted)}`,
      });
    }
  }

  if (isPDF) {
    let extractedPdf = "";
    try {
      const result = await pdfParse(buf);
      extractedPdf = String(result?.text || "").replace(/\r/g, "").trim();
    } catch {}

    if (extractedPdf) {
      content.push({
        type: "text",
        text: `Contenido del PDF (${safeName}):\n\n${truncateText(extractedPdf)}`,
      });
    }
  }

  return content;
}

// ── Anthropic client ───────────────────────────────────────────────────────

export async function askAnthropicChat(validatedData = {}, { apiKey = "", defaultModel = "claude-sonnet-4-5-20250929" } = {}) {
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      code: "missing_anthropic_key",
      message: "Falta configuración del proveedor de IA.",
    };
  }

  const client = new Anthropic({ apiKey });
  const text = String(validatedData.text || "");
  const mode = String(validatedData.mode || "");
  const model = String(validatedData.model || "").trim() || defaultModel;

  const content = [];
  const fileContent = await extractFileContent(
    validatedData.fileDataUrl,
    validatedData.fileName,
    validatedData.fileMime
  );
  content.push(...fileContent);

  if (validatedData.imageDataUrl) {
    const imgDataUrl = String(validatedData.imageDataUrl);
    const imgBase64 = getBase64FromMaybeDataUrl(imgDataUrl);
    let mediaType = "image/jpeg";
    if (imgDataUrl.startsWith("data:")) {
      const match = imgDataUrl.match(/^data:(image\/[^;]+);/);
      if (match) mediaType = match[1];
    }
    if (imgBase64) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: mediaType, data: imgBase64 },
      });
    }
  }

  // Imágenes adjuntas a la tarea (URL firmada desde Supabase Storage)
  const taskAttachmentUrls = Array.isArray(validatedData.taskContext?.attachmentUrls)
    ? validatedData.taskContext.attachmentUrls
    : [];
  for (const att of taskAttachmentUrls) {
    const url = String(att?.url || "").trim();
    if (url && String(att?.mime || "").startsWith("image/")) {
      content.push({ type: "image", source: { type: "url", url } });
    }
  }

  const cleanedText = String(text || "").trim();
  const hasUserText = cleanedText.length > 0;
  const hasAttachment = Boolean(validatedData.fileDataUrl || validatedData.imageDataUrl || taskAttachmentUrls.length);

  const fallbackText = hasAttachment
    ? `He recibido un adjunto. Dime el ejercicio exacto (número/página/apartado) y el primer paso que has intentado.`
    : "¿Qué necesitas exactamente y en qué curso estás?";

  content.push({
    type: "text",
    text: hasUserText ? cleanedText : fallbackText,
  });

  const messages = [];

  if (Array.isArray(validatedData.messages) && validatedData.messages.length > 0) {
    const historial = validatedData.messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim().length > 0)
      .map((m) => ({ role: m.role, content: m.content.trim() }));

    // Anthropic exige que el array empiece siempre por 'user' y alterne roles
    while (historial.length > 0 && historial[0].role !== 'user') {
      historial.shift();
    }

    // Eliminar turnos consecutivos del mismo rol (no válido en Anthropic)
    const historialLimpio = [];
    for (const mensaje of historial) {
      if (historialLimpio.length === 0 || historialLimpio[historialLimpio.length - 1].role !== mensaje.role) {
        historialLimpio.push(mensaje);
      }
    }

    // Limitar a los últimos 20 turnos para controlar tokens
    messages.push(...historialLimpio.slice(-20));
  }

  // El mensaje actual del alumno siempre va al final
  messages.push({ role: 'user', content });

  const system = buildTutorInstructions(mode, validatedData.taskContext || null, validatedData.attemptsSameError, null);

  const req = {
    model: 'claude-opus-4-6',
    system,
    messages,
    max_tokens: 1600,
    thinking: { type: 'adaptive' }
  };

  if (Number.isFinite(validatedData.temperature)) {
    req.temperature = validatedData.temperature;
  }

  try {
    const response = await client.messages.create(req);
    const textBlock = response.content.find(b => b.type === 'text');
    const textoRespuesta = procesarRespuestaTutor(textBlock?.text || '', null);
    return {
      ok: true,
      data: {
        reply: textoRespuesta,
        usage: response?.usage || null,
        model,
      },
    };
  } catch (err) {
    const status = err?.status || 500;
    const code = err?.error?.type || err?.code || "unknown";
    return {
      ok: false,
      status,
      code,
      message: userFacingMessage(status, code),
      meta: {
        providerStatus: status,
        providerType: code,
      },
    };
  }
}
