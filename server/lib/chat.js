import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { getBase64FromMaybeDataUrl, MAX_FILENAME_CHARS } from "./chatValidation.js";
import { buildTutorInstructions, procesarRespuestaTutor } from "./chatPrompt.js";
import { sanitizeControlSignals } from "./sanitizeUserInput.js";
import { createAnthropicClient, SONNET_MODEL } from "./anthropic.js";
import { Sentry } from "./sentry.js";

export { validateChatBody } from "./chatValidation.js";

// ── Utils ──────────────────────────────────────────────────────────────────

function truncateText(input = "", max = 120_000) {
  const t = String(input || "");
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n\n[...contenido truncado...]`;
}

// Defensa en profundidad antes de mammoth.extractRawText() — el body limit
// de la ruta de chat (~250KB, ver chat.routes.js) ya acota esto, pero una
// guarda pegada a la llamada vulnerable no depende de que ese límite no
// cambie. Ver docs/deuda-tecnica.md: la solución real es actualizar o
// sustituir mammoth (vulnerabilidad conocida de underscore en su cadena de
// dependencias).
const MAX_DOCX_BYTES = 10 * 1024 * 1024;

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
  const safeName    = filenameRaw.replace(/[/\\]/g, "_").slice(0, MAX_FILENAME_CHARS);
  const mimeRaw     = String(fileMime || "");
  const lower       = safeName.toLowerCase();
  const ext         = lower.includes(".") ? lower.split(".").pop() : "";

  const isPDF  = mimeRaw === "application/pdf" || (!mimeRaw && ext === "pdf");
  const isDocx =
    mimeRaw === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    (!mimeRaw && ext === "docx");

  if (!isPDF && !isDocx) return [];

  const base64 = getBase64FromMaybeDataUrl(fileDataUrl);
  if (!base64) return [];

  const buf     = Buffer.from(base64, "base64");
  const content = [];

  if (isDocx && buf.length > MAX_DOCX_BYTES) return [];

  if (isDocx) {
    let extracted = "";
    try {
      const result = await mammoth.extractRawText({ buffer: buf });
      extracted = String(result?.value || "").replace(/\r/g, "").trim();
    } catch {}
    if (extracted) {
      content.push({ type: "text", text: `Contenido del Word (${safeName}):\n\n${truncateText(extracted)}` });
    }
  }

  if (isPDF) {
    let extractedPdf = "";
    try {
      const result = await pdfParse(buf);
      extractedPdf = String(result?.text || "").replace(/\r/g, "").trim();
    } catch {}
    if (extractedPdf) {
      content.push({ type: "text", text: `Contenido del PDF (${safeName}):\n\n${truncateText(extractedPdf)}` });
    }
  }

  return content;
}

// ── Anthropic client ───────────────────────────────────────────────────────
// Modelo: Sonnet 4.6 (por defecto). Opus solo se usa en guide.js (Agente 1).
// onChunk: callback(text) — si se pasa, activa streaming SSE token a token.
// stepMap: { steps, currentStep } — inyectado por el orquestador.

export async function askAnthropicChat(
  validatedData = {},
  { apiKey = "", defaultModel = SONNET_MODEL, onChunk = null } = {}
) {
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      code: "missing_anthropic_key",
      message: "Falta configuración del proveedor de IA.",
    };
  }

  const client  = createAnthropicClient(apiKey);
  const text    = String(validatedData.text || "");
  const mode    = String(validatedData.mode || "");
  const model   = String(validatedData.model || "").trim() || defaultModel;
  const stepMap = validatedData.stepMap || null;

  // ── Construir content del mensaje actual ───────────────────────────────

  const content = [];
  const fileContent = await extractFileContent(
    validatedData.fileDataUrl,
    validatedData.fileName,
    validatedData.fileMime
  );
  content.push(...fileContent);

  if (validatedData.imageDataUrl) {
    const imgDataUrl = String(validatedData.imageDataUrl);
    const imgBase64  = getBase64FromMaybeDataUrl(imgDataUrl);
    let mediaType    = "image/jpeg";
    if (imgDataUrl.startsWith("data:")) {
      const match = imgDataUrl.match(/^data:(image\/[^;]+);/);
      if (match) mediaType = match[1];
    }
    if (imgBase64) {
      content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: imgBase64 } });
    }
  }

  const taskAttachmentUrls = Array.isArray(validatedData.taskContext?.attachmentUrls)
    ? validatedData.taskContext.attachmentUrls
    : [];
  for (const att of taskAttachmentUrls) {
    const url  = String(att?.url  || "").trim();
    const mime = String(att?.mime || "").toLowerCase();
    if (!url) continue;
    if (mime.startsWith("image/")) {
      content.push({ type: "image",    source: { type: "url", url } });
    } else if (mime === "application/pdf") {
      content.push({ type: "document", source: { type: "url", url } });
    }
  }

  // Hay documento visual (PDF/imagen) pero sin texto extraído → el Socrático lo ve en los bloques
  const hasVisualDoc =
    taskAttachmentUrls.length > 0 &&
    (validatedData.documentText || "").length < 50;

  const cleanedText = sanitizeControlSignals(String(text || "").trim());
  const hasUserText = cleanedText.length > 0;
  const hasAttachment = Boolean(
    validatedData.fileDataUrl || validatedData.imageDataUrl || taskAttachmentUrls.length
  );
  const fallbackText = hasAttachment
    ? "He recibido un adjunto. Dime el ejercicio exacto (número/página/apartado) y el primer paso que has intentado."
    : "¿Qué necesitas exactamente y en qué curso estás?";

  content.push({ type: "text", text: hasUserText ? cleanedText : fallbackText });

  // ── Construir historial ────────────────────────────────────────────────

  const messages = [];

  if (Array.isArray(validatedData.messages) && validatedData.messages.length > 0) {
    const historial = validatedData.messages
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim().length > 0)
      .map((m) => ({
        role:    m.role,
        content: m.role === "user"
          ? sanitizeControlSignals(m.content.trim())
          : m.content.trim(),
      }));

    while (historial.length > 0 && historial[0].role !== "user") historial.shift();

    const historialLimpio = [];
    for (const msg of historial) {
      if (historialLimpio.length === 0 || historialLimpio[historialLimpio.length - 1].role !== msg.role) {
        historialLimpio.push(msg);
      }
    }
    messages.push(...historialLimpio.slice(-20));
  }

  messages.push({ role: "user", content });

  // ── System prompt (con mapa de pasos si existe) ────────────────────────

  const system = buildTutorInstructions(
    mode,
    validatedData.taskContext || null,
    validatedData.attemptsSameError,
    null,
    stepMap,
    validatedData.documentText || "",
    Array.isArray(validatedData.sessionExercises) ? validatedData.sessionExercises : [],
    hasVisualDoc
  );

  // ── Request params — sin thinking (no compatible con Sonnet) ──────────

  const reqParams = { model, system, messages, max_tokens: 1600 };
  if (Number.isFinite(validatedData.temperature)) {
    reqParams.temperature = validatedData.temperature;
  }

  // ── Llamada a la API ───────────────────────────────────────────────────

  try {
    if (typeof onChunk === "function") {
      // ── Modo streaming ─────────────────────────────────────────────────
      const stream = client.messages.stream(reqParams);
      let fullText = "";

      stream.on("text", (token) => {
        fullText += token;
        onChunk(token);
      });

      const finalMsg = await stream.finalMessage();
      const processed = procesarRespuestaTutor(fullText, null);

      return {
        ok: true,
        data: {
          reply: processed.reply,
          stepsCompleted: processed.stepsCompleted,
          escalate: processed.escalate,
          usage: finalMsg.usage ?? null,
          model,
        },
      };
    } else {
      // ── Modo síncrono ──────────────────────────────────────────────────
      const response = await client.messages.create(reqParams);
      const textBlock = response.content.find((b) => b.type === "text");
      const processed = procesarRespuestaTutor(textBlock?.text || "", null);

      return {
        ok: true,
        data: {
          reply: processed.reply,
          stepsCompleted: processed.stepsCompleted,
          escalate: processed.escalate,
          usage: response?.usage ?? null,
          model,
        },
      };
    }
  } catch (err) {
    const status = err?.status || 500;
    const code   = err?.error?.type || err?.code || "unknown";
    Sentry.captureException(err, {
      extra: { operation: "ask_anthropic_chat", model, mode, sessionId: validatedData.sessionId || null, status, code },
    });
    return {
      ok: false,
      status,
      code,
      message: userFacingMessage(status, code),
      meta: { providerStatus: status, providerType: code },
    };
  }
}
