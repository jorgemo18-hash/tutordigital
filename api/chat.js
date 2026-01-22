// api/chat.js
import OpenAI from "openai";
import { toFile } from "openai/uploads";
import crypto from "crypto";
import * as mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { z } from "zod";

function getBase64FromMaybeDataUrl(input = "") {
  const s = String(input || "").trim();
  if (!s) return null;

  // Caso DataURL: data:...;base64,XXXX
  const idx = s.indexOf("base64,");
  if (idx !== -1) return s.slice(idx + "base64,".length).replace(/\s/g, "");

  // Caso base64 “pelado”
  const cleaned = s.replace(/\s/g, "");
  if (/^[A-Za-z0-9+/=]+$/.test(cleaned) && cleaned.length > 100) return cleaned;

  return null;
}

function makeRequestId() {
  try {
    return (
      "ttd_" +
      (crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(16).slice(2)}`)
    );
  } catch {
    return "ttd_" + `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

function approxBase64Bytes(base64 = "") {
  const s = String(base64 || "");
  let padding = 0;
  if (s.endsWith("==")) padding = 2;
  else if (s.endsWith("=")) padding = 1;
  return Math.max(0, Math.floor((s.length * 3) / 4) - padding);
}
function truncateText(s = "", max = 120_000) {
  const t = String(s || "");
  if (t.length <= max) return t;
  return t.slice(0, max) + "\n\n[...contenido truncado...]";
}

const MAX_TEXT_CHARS = 5000;
const MAX_FILENAME_CHARS = 120;
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_FILE_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const ChatSchema = z.object({
  text: z.string().max(MAX_TEXT_CHARS).optional(),
  mode: z.string().max(40).optional(),
  image: z.string().optional(),
  imageDataUrl: z.string().optional(),
  fileDataUrl: z.string().optional(),
  fileDataURL: z.string().optional(),
  fileName: z.string().max(MAX_FILENAME_CHARS).optional(),
  filename: z.string().max(MAX_FILENAME_CHARS).optional(),
  fileMime: z.string().optional(),
  mime: z.string().optional(),
  file: z.object({
    dataUrl: z.string(),
    name: z.string().max(MAX_FILENAME_CHARS).optional(),
    mime: z.string().optional(),
  }).optional(),
  messages: z.array(z.object({
    role: z.string(),
    content: z.string(),
  })).optional(),
}).passthrough();

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

  const fileDataUrl =
    body.file?.dataUrl ||
    body.fileDataUrl ||
    body.fileDataURL ||
    null;
  const fileName =
    body.file?.name ||
    body.fileName ||
    body.filename ||
    "";
  let fileMime =
    body.file?.mime ||
    body.fileMime ||
    body.mime ||
    "";

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

  return {
    ok: true,
    data: {
      text,
      mode,
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

function logLine(obj) {
  try {
    console.log(JSON.stringify(obj));
  } catch {
    console.log(obj);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const request_id = makeRequestId();
  const t0 = Date.now();

  try {
    const validation = validateChatBody(req.body || {});
    if (!validation.ok) {
      return res.status(validation.status).json({
        error: validation.message,
        code: validation.code,
        request_id,
        status: validation.status,
      });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const body = validation.data;
    const text = body.text;
    const mode = body.mode;

    const image = body.imageDataUrl || null;

    const file =
      body.fileDataUrl
        ? { dataUrl: body.fileDataUrl, name: body.fileName, mime: body.fileMime }
        : null;

    const messages = body.messages || [];
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    logLine({
      at: new Date().toISOString(),
      request_id,
      event: "chat.request",
      hasImage: !!image,
      hasFile: !!(file && typeof file === "object" && file.dataUrl),
      fileName: file?.name ? String(file.name) : null,
      fileMime: file?.mime ? String(file.mime) : null,
      textChars: text ? text.length : 0,
      mode,
      model,
    });

    // Historial compacto
    let historyText = "";
    if (messages.length) {
      historyText = messages
        .filter((m) => m && m.role && typeof m.content === "string")
        .map((m) => `${String(m.role).toUpperCase()}: ${m.content}`)
        .join("\n");
    }

    const content = [];

    // -------- ARCHIVO (PDF o DOCX) --------
    if (file && file.dataUrl) {
      const filenameRaw = String(file.name || "archivo");
      const mimeRaw = String(file.mime || "");
      const lower = filenameRaw.toLowerCase();
      const ext = lower.includes(".") ? lower.split(".").pop() : "";

      const isPDF = mimeRaw === "application/pdf" || (!mimeRaw && ext === "pdf");
      const isDocx =
        mimeRaw === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        (!mimeRaw && ext === "docx");
      const isDoc = ext === "doc";
      // .doc antiguo no soportado (caerá en unsupported_mime si se intenta)

      if (!isPDF && !isDocx) {
        logLine({ at: new Date().toISOString(), request_id, event: "chat.reject", reason: "unsupported_mime", mimeRaw, ext });
        return res.status(415).json({
          error:
            `No puedo leer ese archivo ("${filenameRaw}"). ` +
            `Prueba a exportarlo como PDF o Word (.docx), o envía una foto.`,
          code: "unsupported_mime",
          request_id,
          status: 415,
        });
      }

      const base64 = getBase64FromMaybeDataUrl(file.dataUrl);
      if (!base64) {
        logLine({ at: new Date().toISOString(), request_id, event: "chat.reject", reason: "bad_file_dataurl" });
        return res.status(400).json({
          error: "No he podido leer el archivo. Vuelve a guardarlo e inténtalo de nuevo.",
          code: "bad_file_dataurl",
          request_id,
          status: 400,
        });
      }

      const filename = lower.includes(".")
        ? filenameRaw
        : isPDF
          ? `${filenameRaw}.pdf`
          : `${filenameRaw}.docx`;

      const approxBytes = approxBase64Bytes(base64);
      if (approxBytes > MAX_FILE_BYTES) {
        logLine({ at: new Date().toISOString(), request_id, event: "chat.reject", reason: "file_too_large", approxBytes, filename });
        return res.status(413).json({
          error: "El archivo es demasiado grande. Prueba con uno más pequeño.",
          code: "file_too_large",
          request_id,
          status: 413,
        });
      }

      const buf = Buffer.from(base64, "base64");

      // DOCX -> texto (Mammoth)
      if (isDocx) {
        logLine({ at: new Date().toISOString(), request_id, event: "docx.extract.start", filename, approxBytes });

        let extracted = "";
        try {
          const r = await mammoth.extractRawText({ buffer: buf });
          extracted = String(r?.value || "").replace(/\r/g, "").trim();
        } catch (e) {
          logLine({ at: new Date().toISOString(), request_id, event: "docx.extract.error", message: String(e?.message || e) });
        }

        if (!extracted) {
          return res.status(400).json({
            error: "No he podido extraer el texto de ese Word. Prueba a exportarlo como PDF o envía una foto.",
            code: "docx_extract_failed",
            request_id,
            status: 400,
          });
        }

        logLine({ at: new Date().toISOString(), request_id, event: "docx.extract.ok", chars: extracted.length });

        content.push({
          type: "input_text",
          text: `Contenido del Word (${filename}):\n\n${extracted}`,
        });
      }

      // PDF -> preferimos extraer texto en server (evita “no puedo abrir adjuntos”)
// Fallback: si no se puede extraer, subimos el PDF a OpenAI y lo referenciamos por file_id.
if (isPDF) {
  logLine({
    at: new Date().toISOString(),
    request_id,
    event: "pdf.extract.start",
    filename,
    approxBytes,
  });

  let extractedPdf = "";
  try {
    const r = await pdfParse(buf);
    extractedPdf = String(r?.text || "").replace(/\r/g, "").trim();
  } catch (e) {
    logLine({
      at: new Date().toISOString(),
      request_id,
      event: "pdf.extract.error",
      message: String(e?.message || e),
    });
  }

  if (extractedPdf) {
    logLine({
      at: new Date().toISOString(),
      request_id,
      event: "pdf.extract.ok",
      chars: extractedPdf.length,
    });

    content.push({
      type: "input_text",
      text: `Contenido del PDF (${filename}):\n\n${truncateText(extractedPdf)}`,
    });
  } else {
    const mime = "application/pdf";

    logLine({
      at: new Date().toISOString(),
      request_id,
      event: "file.upload.start",
      filename,
      mime,
      approxBytes,
    });

    const uploaded = await client.files.create({
      file: await toFile(buf, filename, { type: mime }),
      purpose: "user_data",
    });

    logLine({
      at: new Date().toISOString(),
      request_id,
      event: "file.upload.ok",
      file_id: uploaded?.id || null,
    });

    content.push({
      type: "input_file",
      file_id: uploaded.id,
    });
  }

      }
    }

    // -------- IMAGEN --------
    if (image) {
      content.push({ type: "input_image", image_url: String(image) });
    }

    // -------- TEXTO (una vez, al final) --------
    const userText = [mode ? `[Modo: ${mode}]` : "", text].filter(Boolean).join("\n\n").trim();
    content.push({
      type: "input_text",
      text: userText || "Analiza el adjunto y ayúdame. Resume lo importante y contesta la pregunta si la hay.",
    });

    const input = [];
    if (historyText) {
      input.push({
        role: "user",
        content: [{ type: "input_text", text: `Contexto previo (chat):\n${historyText}` }],
      });
    }
    input.push({ role: "user", content });

    const response = await client.responses.create({ model, input });

    logLine({
      at: new Date().toISOString(),
      request_id,
      event: "chat.ok",
      ms: Date.now() - t0,
    });

    return res.status(200).json({ text: String(response.output_text || "") });
  } catch (err) {
    const info = safeOaiError(err);

    logLine({
      at: new Date().toISOString(),
      request_id,
      event: "chat.error",
      status: info.status,
      code: info.code,
      type: info.type,
      message: info.message,
      ms: Date.now() - t0,
    });

    const msg = userFacingMessage(info.status, info.code);

    return res.status(info.status || 500).json({
      error: msg,
      code: info.code,
      request_id,
      status: info.status,
    });
  }
}
