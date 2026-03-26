import Anthropic from "@anthropic-ai/sdk";
import * as mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { z } from "zod";

function isValidBase64(input = "") {
  const cleaned = String(input || "").replace(/\s/g, "");
  if (!cleaned) return false;
  if (!/^[A-Za-z0-9+/=]+$/.test(cleaned)) return false;
  if (cleaned.length % 4 !== 0) return false;
  if (/={3,}$/.test(cleaned)) return false;
  return true;
}

function getBase64FromMaybeDataUrl(input = "") {
  const s = String(input || "").trim();
  if (!s) return null;

  const idx = s.indexOf("base64,");
  if (idx !== -1) {
    const b64 = s.slice(idx + "base64,".length).replace(/\s/g, "");
    return isValidBase64(b64) ? b64 : null;
  }

  const cleaned = s.replace(/\s/g, "");
  if (isValidBase64(cleaned)) return cleaned;
  return null;
}

function approxBase64Bytes(base64 = "") {
  const s = String(base64 || "");
  let padding = 0;
  if (s.endsWith("==")) padding = 2;
  else if (s.endsWith("=")) padding = 1;
  return Math.max(0, Math.floor((s.length * 3) / 4) - padding);
}

function truncateText(input = "", max = 120_000) {
  const t = String(input || "");
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n\n[...contenido truncado...]`;
}

const MAX_TEXT_CHARS = 5000;
const MAX_FILENAME_CHARS = 120;
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const ALLOWED_FILE_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const ALLOWED_MODES = new Set(["deberes", "examen", "examenes", "trabajo"]);

function normalizeModeKey(mode = "") {
  return String(mode || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeTutorMode(mode = "") {
  const m = String(mode || "").trim().toUpperCase();
  if (m === "DEBERES") return "deberes";
  if (m === "EXAMEN") return "examen";
  if (m === "TRABAJO") return "trabajo";

  const low = normalizeModeKey(mode);
  if (low === "deberes") return "deberes";
  if (low === "examen" || low === "examenes") return "examen";
  if (low === "trabajo") return "trabajo";
  return "deberes";
}

function buildTutorInstructions(modo, taskContext, attemptsSameError, sesion) {
  return `Eres un tutor académico para estudiantes españoles de Primaria, ESO y Bachillerato.

Tu única función es guiar al alumno para que llegue a la respuesta por sí mismo. Nunca das la respuesta directa.

REGLA ABSOLUTA ANTES DE RESPONDER:
Cuando el alumno envía un paso matemático, compara ese paso con la ecuación original que está en el historial. Si el paso es incorrecto, dilo explícitamente antes de hacer cualquier otra cosa. No preguntes si es un paso o una ecuación nueva. No preguntes qué quiere hacer. Di que hay un error y haz una sola pregunta que le ayude a encontrarlo por sí mismo.

Ejemplo:
Alumno tiene: 2x + 5 = 9
Alumno escribe: 2x = 9 + 5
Respuesta correcta: "Ese paso tiene un error. Fíjate en lo que le pasa a un número cuando cruza el igual. ¿Qué crees que debería cambiar?"
Respuesta incorrecta: "Cuando un término cambia de lado su signo cambia." ← esto es dar la respuesta, nunca lo hagas.

CÓMO RESPONDER SIEMPRE:
- Una sola pregunta por respuesta. Nunca dos.
- Si el paso es correcto, confírmalo brevemente y haz la siguiente pregunta.
- Si el paso es incorrecto, señala que hay un error y haz una pregunta que lleve al alumno a descubrirlo él solo. Nunca expliques la regla ni des la operación correcta.
- Respuestas cortas. Máximo 3-4 líneas.
- Tono natural, como un profesor en persona. Sin listas, sin etiquetas, sin estructura fija.
- Si el alumno comete el mismo error dos veces seguidas, no repitas la misma pregunta. Ve a algo más básico: "¿Qué crees que significa el signo igual en una ecuación?"

CONTEXTO DE SESIÓN:
- Alumno: ${sesion?.alumno_nombre || 'el alumno'}
- Nivel: ${sesion?.nivel_educativo || modo || 'ESO'}
- Asignatura: ${sesion?.asignatura || taskContext?.subject || 'no especificada'}
- Modo: ${modo?.toUpperCase() || 'DEBERES'}
- Tarea: ${taskContext?.title || 'sin título'}
- Intentos mismo error: ${attemptsSameError || 0}`;
}

function procesarRespuestaTutor(respuesta, sesionInfo) {
  const regexEscalado = /\[ESCALAR_PROFESOR:\s*(.+?)\]/;
  const match = respuesta.match(regexEscalado);

  if (match) {
    const motivo = match[1].trim();
    const respuestaLimpia = respuesta.replace(regexEscalado, '').trim();

    // TODO: conectar a Supabase cuando implementemos la vista del profesor
    console.log('[ESCALADO AL PROFESOR]', {
      alumno: (sesionInfo && sesionInfo.alumno_nombre) || 'desconocido',
      asignatura: (sesionInfo && sesionInfo.asignatura) || 'desconocida',
      tarea: (sesionInfo && sesionInfo.tarea_titulo) || 'sin título',
      motivo,
      timestamp: new Date().toISOString()
    });

    return respuestaLimpia;
  }

  return respuesta;
}

const ChatSchema = z
  .object({
    text: z.string().max(MAX_TEXT_CHARS).optional(),
    mode: z.string().max(40).optional(),
    model: z.string().max(80).optional(),
    temperature: z.number().min(0).max(2).optional(),
    attemptsSameError: z.number().int().min(0).max(10).optional(),
    image: z.string().optional(),
    imageDataUrl: z.string().optional(),
    fileDataUrl: z.string().optional(),
    fileDataURL: z.string().optional(),
    fileName: z.string().max(MAX_FILENAME_CHARS).optional(),
    filename: z.string().max(MAX_FILENAME_CHARS).optional(),
    fileMime: z.string().optional(),
    mime: z.string().optional(),
    file: z
      .object({
        dataUrl: z.string(),
        name: z.string().max(MAX_FILENAME_CHARS).optional(),
        mime: z.string().optional(),
      })
      .optional(),
    messages: z
      .array(
        z.object({
          role: z.string().max(20),
          content: z.string().max(2000),
        })
      )
      .max(60)
      .optional(),
    taskContext: z
      .object({
        title: z.string().max(300).optional(),
        description: z.string().max(1000).optional(),
        attachmentUrls: z
          .array(z.object({ url: z.string().max(2048), mime: z.string().max(100) }))
          .max(10)
          .optional(),
      })
      .optional(),
  })
  .passthrough();

export function validateChatBody(rawBody = {}) {
  const parsed = ChatSchema.safeParse(rawBody || {});
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      code: "invalid_body",
      message: "Petición no válida.",
      issues: parsed.error.issues,
    };
  }

  const body = parsed.data;
  const text = String(body.text || "").trim();
  const mode = String(body.mode || "").trim();

  const imageDataUrl = body.image || body.imageDataUrl || null;

  const fileDataUrl = body.file?.dataUrl || body.fileDataUrl || body.fileDataURL || null;
  const fileName = body.file?.name || body.fileName || body.filename || "";
  let fileMime = body.file?.mime || body.fileMime || body.mime || "";

  if (fileDataUrl) {
    const base64 = getBase64FromMaybeDataUrl(fileDataUrl);
    if (!base64) {
      return {
        ok: false,
        status: 400,
        code: "invalid_base64",
        message: "No he podido leer el archivo. Vuelve a guardarlo e inténtalo de nuevo.",
      };
    }

    const approxBytes = approxBase64Bytes(base64);
    if (approxBytes > MAX_FILE_BYTES) {
      return {
        ok: false,
        status: 413,
        code: "payload_too_large",
        message: "El archivo es demasiado grande. Prueba con uno más pequeño.",
      };
    }

    if (!fileMime) {
      const lower = String(fileName || "").toLowerCase();
      const ext = lower.includes(".") ? lower.split(".").pop() : "";
      if (ext === "pdf") fileMime = "application/pdf";
      else if (ext === "docx") fileMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }

    if (!fileMime || !ALLOWED_FILE_MIMES.has(fileMime)) {
      return {
        ok: false,
        status: 415,
        code: "unsupported_mime",
        message: "Tipo de archivo no soportado.",
      };
    }
  }

  if (imageDataUrl) {
    const imageBase64 = getBase64FromMaybeDataUrl(imageDataUrl);
    if (!imageBase64) {
      return {
        ok: false,
        status: 400,
        code: "invalid_image",
        message: "No he podido leer la imagen. Prueba a reenviarla.",
      };
    }

    const approxBytes = approxBase64Bytes(imageBase64);
    if (approxBytes > MAX_IMAGE_BYTES) {
      return {
        ok: false,
        status: 413,
        code: "payload_too_large",
        message: "La imagen es demasiado grande. Prueba con una más pequeña.",
      };
    }

    if (String(imageDataUrl).startsWith("data:") && !/^data:image\//i.test(String(imageDataUrl))) {
      return {
        ok: false,
        status: 415,
        code: "unsupported_mime",
        message: "Tipo de imagen no soportado.",
      };
    }
  }

  if (mode) {
    const modeKey = normalizeModeKey(mode);
    if (!ALLOWED_MODES.has(modeKey) && !["DEBERES", "EXAMEN", "TRABAJO"].includes(String(mode).toUpperCase())) {
      return {
        ok: false,
        status: 400,
        code: "invalid_mode",
        message: "Modo no válido.",
      };
    }
  }

  const hasMessages = Array.isArray(body.messages) && body.messages.length > 0;
  if (!text && !imageDataUrl && !fileDataUrl && !hasMessages) {
    return {
      ok: false,
      status: 400,
      code: "missing_text_or_file",
      message: "Falta texto o adjunto.",
    };
  }

  return {
    ok: true,
    data: {
      text,
      mode,
      model: body.model || "",
      temperature: Number.isFinite(body.temperature) ? Number(body.temperature) : null,
      attemptsSameError: Number.isFinite(body.attemptsSameError) ? Number(body.attemptsSameError) : null,
      imageDataUrl,
      fileDataUrl,
      fileName,
      fileMime,
      messages: Array.isArray(body.messages) ? body.messages : [],
      taskContext: body.taskContext || null,
    },
  };
}

function userFacingMessage(status, code) {
  if (status === 401) return "Error de autenticación con el proveedor. Avísanos (ID incluido).";
  if (status === 413) return "El archivo es demasiado grande. Prueba con uno más pequeño.";
  if (status === 429) return "Ahora mismo hay demasiadas peticiones. Prueba en unos segundos.";
  if (status >= 500) return "Ha ocurrido un error al procesar tu petición.";
  if (code === "invalid_request_error") return "Petición no válida. Revisa el archivo o el texto.";
  return "No he podido procesar tu petición.";
}

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

  if (!isPDF && !isDocx) {
    return [];
  }

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
      .map((m) => ({
        role: m.role,
        content: m.content.trim()
      }));

    // Anthropic exige que el array empiece siempre por 'user' y alterne roles
    // Si el primer mensaje es 'assistant', lo descartamos
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
    const historialRecortado = historialLimpio.slice(-20);

    messages.push(...historialRecortado);
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
    const textoRespuesta = procesarRespuestaTutor(
      textBlock?.text || '',
      null
    );
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
