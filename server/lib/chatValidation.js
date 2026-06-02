import { z } from "zod";

// ── Constants ──────────────────────────────────────────────────────────────

export const MAX_TEXT_CHARS = 5000;
export const MAX_FILENAME_CHARS = 120;
export const MAX_FILE_BYTES = 12 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const ALLOWED_FILE_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const ALLOWED_MODES = new Set(["deberes", "examen", "examenes", "trabajo"]);

// ── Base64 utils ───────────────────────────────────────────────────────────

export function isValidBase64(input = "") {
  const cleaned = String(input || "").replace(/\s/g, "");
  if (!cleaned) return false;
  if (!/^[A-Za-z0-9+/=]+$/.test(cleaned)) return false;
  if (cleaned.length % 4 !== 0) return false;
  if (/={3,}$/.test(cleaned)) return false;
  return true;
}

export function getBase64FromMaybeDataUrl(input = "") {
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

export function approxBase64Bytes(base64 = "") {
  const s = String(base64 || "");
  let padding = 0;
  if (s.endsWith("==")) padding = 2;
  else if (s.endsWith("=")) padding = 1;
  return Math.max(0, Math.floor((s.length * 3) / 4) - padding);
}

// ── Mode normalization ─────────────────────────────────────────────────────

export function normalizeModeKey(mode = "") {
  return String(mode || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeTutorMode(mode = "") {
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

// ── Schema ─────────────────────────────────────────────────────────────────

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
    sessionId: z.string().uuid().optional(),
    stream: z.boolean().optional(),
    messages: z
      .array(
        z.object({
          role: z.string().max(20),
          content: z.string().max(8000),
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

// ── Validation ─────────────────────────────────────────────────────────────

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
      sessionId: body.sessionId || null,
      stream: body.stream === true,
      imageDataUrl,
      fileDataUrl,
      fileName,
      fileMime,
      messages: Array.isArray(body.messages) ? body.messages : [],
      taskContext: body.taskContext || null,
    },
  };
}
