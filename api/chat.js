// api/chat.js
import OpenAI from "openai";
import { toFile } from "openai/uploads";
import crypto from "crypto";
import * as mammoth from "mammoth";

function getBase64FromDataUrl(dataUrl = "") {
  const s = String(dataUrl);
  const i = s.indexOf("base64,");
  if (i === -1) return null;
  return s.slice(i + "base64,".length).replace(/\s/g, ""); // quita saltos/espacios
}

function makeRequestId() {
  try {
    return "ttd_" + (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`);
  } catch {
    return "ttd_" + `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

function approxBase64Bytes(base64 = "") {
  const s = String(base64 || "");
  // base64 -> bytes aprox: (len * 3/4) - padding
  let padding = 0;
  if (s.endsWith("==")) padding = 2;
  else if (s.endsWith("=")) padding = 1;
  return Math.max(0, Math.floor((s.length * 3) / 4) - padding);
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
  // 4xx genérico
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
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const body = req.body || {};
    const text = String(body.text || "").trim();
    const mode = String(body.mode || "").trim();

    const image = body.image || null; // data URL imagen

    // Acepta ambas formas: body.file {...} o body.fileDataUrl + nombre/mime
    const file =
      body.file ||
      (body.fileDataUrl
        ? { dataUrl: body.fileDataUrl, name: body.fileName, mime: body.fileMime }
        : null);

    const messages = Array.isArray(body.messages) ? body.messages : [];
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    // Log mínimo útil para depurar (sin contenido sensible)
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

    // Detecta tipo por MIME o por extensión (por si llega vacío u octet-stream)
    if (file && typeof file === "object" && file.dataUrl) {
      const base64 = getBase64FromDataUrl(file.dataUrl);
      if (!base64) {
        logLine({ at: new Date().toISOString(), request_id, event: "chat.reject", reason: "bad_file_dataurl" });
        return res.status(400).json({
          error: "No he podido leer el archivo. Vuelve a guardarlo e inténtalo de nuevo.",
          code: "bad_file_dataurl",
          request_id,
        });
      }

      // Detecta tipo por MIME o por extensión (por si llega vacío u octet-stream)
      const filenameRaw = String(file.name || "archivo");
      const mimeRaw = String(file.mime || "");
      const lower = filenameRaw.toLowerCase();
      const ext = lower.includes(".") ? lower.split(".").pop() : "";

      const isPDF = mimeRaw === "application/pdf" || ext === "pdf";
      const isDocx =
        mimeRaw === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        ext === "docx";
      const isDoc = mimeRaw === "application/msword" || ext === "doc";

      // .doc (Word antiguo) => pedimos conversión (no merece la pena soportarlo ahora)
      if (isDoc) {
        logLine({
          at: new Date().toISOString(),
          request_id,
          event: "chat.reject",
          reason: "unsupported_doc",
          mimeRaw,
          ext,
          filenameRaw,
        });
        return res.status(400).json({
          error:
            `Ese Word antiguo (.doc) no lo puedo leer. Guárdalo como Word (.docx) o PDF y vuelve a subirlo.`,
          code: "unsupported_doc",
          request_id,
          status: 400,
        });
      }

      if (!isPDF && !isDocx) {
        logLine({
          at: new Date().toISOString(),
          request_id,
          event: "chat.reject",
          reason: "unsupported_mime",
          mimeRaw,
          ext,
          filenameRaw,
        });
        return res.status(400).json({
          error:
            `No puedo leer ese archivo ("${filenameRaw}"). ` +
            `Prueba a exportarlo como PDF o Word (.docx), o envía una foto.`,
          code: "unsupported_mime",
          request_id,
          status: 400,
        });
      }

      // Nombre con extensión si viene sin ella
      const filename = (() => {
        if (lower.includes(".")) return filenameRaw;
        return isPDF ? `${filenameRaw}.pdf` : `${filenameRaw}.docx`;
      })();

      // Límite tamaño (aprox)
      const approxBytes = approxBase64Bytes(base64);
      const MAX_BYTES = 12 * 1024 * 1024; // 12 MB
      if (approxBytes > MAX_BYTES) {
        logLine({
          at: new Date().toISOString(),
          request_id,
          event: "chat.reject",
          reason: "file_too_large",
          approxBytes,
          filename,
          mime: isPDF ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });
        return res.status(413).json({
          error: "El archivo es demasiado grande. Prueba con uno más pequeño.",
          code: "file_too_large",
          request_id,
          status: 413,
        });
      }

      const buf = Buffer.from(base64, "base64");

      // DOCX: extraemos texto (el modelo NO lee DOCX como file directamente)
      if (isDocx) {
        logLine({
          at: new Date().toISOString(),
          request_id,
          event: "docx.extract.start",
          filename,
          approxBytes,
        });

        let extracted = "";
        try {
          const r = await mammoth.extractRawText({ buffer: buf });
          extracted = String(r?.value || "").replace(/\r/g, "").trim();
        } catch (e) {
          logLine({
            at: new Date().toISOString(),
            request_id,
            event: "docx.extract.error",
            message: String(e?.message || e),
          });
        }

        if (!extracted) {
          return res.status(400).json({
            error:
              "No he podido extraer el texto de ese Word. Prueba a exportarlo como PDF o envía una foto.",
            code: "docx_extract_failed",
            request_id,
            status: 400,
          });
        }

        logLine({
          at: new Date().toISOString(),
          request_id,
          event: "docx.extract.ok",
          chars: extracted.length,
        });

        content.push({
          type: "input_text",
          text: `Contenido del Word (${filename}):\n\n${extracted}`,
        });
      } else {
        // PDF: subir a OpenAI y referenciar por file_id
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

    // Imagen
    if (image) {
      content.push({ type: "input_image", image_url: String(image) });
    }

    const userText = [mode ? `[Modo: ${mode}]` : "", text].filter(Boolean).join("\n\n").trim();
    if (userText) content.push({ type: "input_text", text: userText });

    if (!userText && (image || (file && file.dataUrl))) {
      content.push({
        type: "input_text",
        text: "Analiza el adjunto y ayúdame. Resume lo importante y contesta la pregunta si la hay.",
      });
    }

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