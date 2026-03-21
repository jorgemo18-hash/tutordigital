import OpenAI from "openai";
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

function buildTutorInstructions(mode = "", attemptsSameError = null, taskContext = null) {
  const m = normalizeTutorMode(mode);

  const modeBlock =
    m === "deberes"
      ? `MODO: DEBERES
- Estilo socrático estricto. No avances sin intento del alumno.
- Turnos cortos: 1–2 preguntas máximo y pide un paso concreto.
- Si bloqueo o repetición -> ofrecer "Enviar al profesor" según reglas.`
      : m === "examen"
      ? `MODO: EXAMEN
- Mantén guía sin resolver el paso.
- Explica un poco más el concepto del error, pero sin dar el resultado ni el paso hecho.
- Si el alumno se bloquea, puedes explicar la regla con un ejemplo distinto y pedir que rehaga su paso.`
      : `MODO: TRABAJO
- Prohibido: redactar por el alumno (índice final, resumen final, texto completo).
- Permitido: sugerir ideas, preguntas guía, estructura posible, mejorar lo ya escrito, proponer alternativas y criterios de búsqueda.
- Si el alumno pide "hazme el trabajo": rechaza y ofrece una plantilla/preguntas para que lo escriba él.`;

  const attemptsLine =
    Number.isFinite(attemptsSameError) && attemptsSameError >= 0
      ? `\nLa app indica: intentos_mismo_error = ${attemptsSameError}.\n`
      : "";

  const taskBlock = taskContext?.title
    ? `\nTAREA ACTIVA\nTítulo: ${String(taskContext.title).slice(0, 300)}${taskContext.description ? `\nDescripción: ${String(taskContext.description).slice(0, 1000)}` : ""}\nUsa este contexto para guiar al alumno sobre esta tarea concreta.\n`
    : "";

  return `
Eres TutorDigital, tutor académico para alumnado de Primaria, ESO y Bachillerato.
Tu función es guiar, preguntar, detectar errores y acompañar. Nunca resuelves ni validas resultados.

REGLAS (INQUEBRANTABLES)
1) No des soluciones finales ni pasos resueltos.
2) No corrijas dando el valor correcto: indica el tipo de error y pide rehacer.
3) No valides resultados ("está bien", "correcto").
4) Si no hay intento del alumno, no avances: 1-2 preguntas guía y pide un paso concreto.
5) Puedes corregir fórmulas canónicas indicando qué parte está mal o falta, sin resolver.
6) Si pide "la respuesta" / "hazlo tú": rechaza y exige el siguiente paso escrito por él.
7) Un ejercicio a la vez.

ESCALADO
- 0-1: pista leve + pregunta
- 2: pista más concreta
- 3: mini-explicación breve + pide rehacer
- >=4: ofrece "Enviar al profesor"
${attemptsLine}${taskBlock}
FORMATO DE RESPUESTA
A) Qué estamos haciendo (1 frase).
B) Pregunta guía (1-2 preguntas).
C) Pista breve (opcional).
D) "Escribe tu siguiente paso".

${modeBlock}
`.trim();
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
    },
  };
}

function safeOaiError(err) {
  const status = err?.status || err?.response?.status || 500;
  const oai = err?.error || err?.response?.data?.error || null;
  return {
    status,
    code: oai?.code || err?.code || "unknown",
    type: oai?.type || "unknown",
    message: oai?.message || err?.message || String(err),
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
        type: "input_text",
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
        type: "input_text",
        text: `Contenido del PDF (${safeName}):\n\n${truncateText(extractedPdf)}`,
      });
    }
  }

  return content;
}

export async function askOpenAIChat(validatedData = {}, { apiKey = "", defaultModel = "gpt-4o-mini" } = {}) {
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      code: "missing_openai_key",
      message: "Falta configuración del proveedor de IA.",
    };
  }

  const client = new OpenAI({ apiKey });
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
    content.push({ type: "input_image", image_url: String(validatedData.imageDataUrl) });
  }

  const cleanedText = String(text || "").trim();
  const hasUserText = cleanedText.length > 0;
  const hasAttachment = Boolean(validatedData.fileDataUrl || validatedData.imageDataUrl);

  const fallbackText = hasAttachment
    ? `He recibido un adjunto. Dime el ejercicio exacto (número/página/apartado) y el primer paso que has intentado.`
    : "¿Qué necesitas exactamente y en qué curso estás?";

  content.push({
    type: "input_text",
    text: hasUserText ? cleanedText : fallbackText,
  });

  let historyText = "";
  if (Array.isArray(validatedData.messages) && validatedData.messages.length > 0) {
    historyText = validatedData.messages
      .filter((m) => m && m.role && typeof m.content === "string")
      .map((m) => `${String(m.role).toUpperCase()}: ${m.content}`)
      .join("\n");
  }
  historyText = truncateText(historyText, 20_000);

  const input = [];
  if (historyText) {
    input.push({
      role: "user",
      content: [{ type: "input_text", text: `Contexto previo (chat):\n${historyText}` }],
    });
  }
  input.push({ role: "user", content });

  const instructions = buildTutorInstructions(mode, validatedData.attemptsSameError, validatedData.taskContext || null);
  const req = {
    model,
    input,
    instructions,
  };

  if (Number.isFinite(validatedData.temperature)) {
    req.temperature = validatedData.temperature;
  }

  try {
    const response = await client.responses.create(req);
    return {
      ok: true,
      data: {
        reply: String(response?.output_text || ""),
        usage: response?.usage || null,
        model,
      },
    };
  } catch (err) {
    const info = safeOaiError(err);
    return {
      ok: false,
      status: info.status || 500,
      code: info.code,
      message: userFacingMessage(info.status, info.code),
      meta: {
        providerStatus: info.status,
        providerType: info.type,
      },
    };
  }
}
