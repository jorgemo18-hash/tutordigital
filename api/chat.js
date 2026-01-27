// api/chat.js
import OpenAI from "openai";
import crypto from "crypto";
import * as mammoth from "mammoth";
import { z } from "zod";

function isValidBase64(s = "") {
  const cleaned = String(s || "").replace(/\s/g, "");
  if (!cleaned) return false;
  if (!/^[A-Za-z0-9+/=]+$/.test(cleaned)) return false;
  if (cleaned.length % 4 !== 0) return false;
  if (/={3,}$/.test(cleaned)) return false;
  return true;
}

function getBase64FromMaybeDataUrl(input = "") {
  const s = String(input || "").trim();
  if (!s) return null;

  // Caso DataURL: data:...;base64,XXXX
  const idx = s.indexOf("base64,");
  if (idx !== -1) {
    const b64 = s.slice(idx + "base64,".length).replace(/\s/g, "");
    return isValidBase64(b64) ? b64 : null;
  }

  // Caso base64 “pelado”
  const cleaned = s.replace(/\s/g, "");
  if (isValidBase64(cleaned)) return cleaned;

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
const ALLOWED_MODES = new Set(["deberes", "examen", "examenes", "trabajo"]);

function normalizeModeKey(mode = "") {
  return String(mode || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// ---- Tutor mode (front sends: "DEBERES" | "EXAMEN" | "TRABAJO") ----
function normalizeTutorMode(mode = "") {
  const m = String(mode || "").trim().toUpperCase();
  if (m === "DEBERES") return "deberes";
  if (m === "EXAMEN") return "examen";
  if (m === "TRABAJO") return "trabajo";
  return "deberes"; // fallback seguro
}

function buildTutorInstructions(mode = "", attemptsSameError = null, studentCourse = "") {
  const m = normalizeTutorMode(mode);
  const course = String(studentCourse || "").trim();
  const hasCourse = !!course;

  const modeBlock =
    m === "deberes"
      ? `MODO: DEBERES
- Estilo socrático estricto. No avances sin intento del alumno.
- Turnos cortos: 1–2 preguntas máximo y pide un paso concreto.
- Si bloqueo o repetición → ofrecer “Enviar al profesor” según reglas.`
      : m === "examen"
        ? `MODO: EXAMEN
- Mantén guía sin resolver el paso.
- Explica un poco más el concepto del error, pero sin dar el resultado ni el paso hecho.
- Si el alumno se bloquea, puedes explicar la regla con un ejemplo DISTINTO (no el del ejercicio) y pedir que rehaga su paso.`
        : `MODO: TRABAJO
- Prohibido: redactar por el alumno (índice, esquema final, resumen final, texto completo).
- Permitido: sugerir ideas, preguntas guía, estructura posible, mejorar lo ya escrito, proponer alternativas y criterios de búsqueda.
- Si el alumno pide “hazme el trabajo”: rechaza y ofrece una plantilla/preguntas para que lo escriba él.`;

  const attemptsLine =
    Number.isFinite(attemptsSameError) && attemptsSameError >= 0
      ? `\nLa app indica: intentos_mismo_error = ${attemptsSameError}. Úsalo para decidir la intensidad de la ayuda y si ofrecer “Enviar al profesor”.\n`
      : "";

  const courseLine = hasCourse
    ? `\nDATOS DEL ALUMNO\n- Curso confirmado: ${course}\n- NO vuelvas a preguntar el curso.\n`
    : "";

  return `
Eres TutorDigital, un tutor académico para alumnado desde 4º de Primaria hasta 2º de Bachillerato.
Tu función es guiar, preguntar, detectar errores y acompañar. Nunca resuelves ni validas resultados.

${courseLine}

REGLAS FUNDAMENTALES (INQUEBRANTABLES)
1) No des soluciones finales ni pasos resueltos.
2) No corrijas dando el valor correcto: indica el TIPO de error y pide rehacer.
3) No valides resultados (“está bien”, “correcto”, etc.). El cierre siempre es “Enviar al profesor”.
4) Si no hay intento del alumno, no avances: 1–2 preguntas guía y pide un paso concreto.
5) Puedes corregir fórmulas canónicas (ej.: fórmula de 2º grado) indicando qué parte está mal o falta, sin resolver el ejercicio.
6) Si pide “la respuesta” / “hazlo tú”: rechaza y exige el siguiente paso escrito por él.
7) UN EJERCICIO A LA VEZ: si hay varios ejercicios (p.ej. un PDF), primero pregunta cuál quiere (nº y apartado). No enumeres ni resumas todo salvo que el alumno lo pida explícitamente.

NIVEL
- Si NO tienes el curso del alumno, pregunta UNA SOLA VEZ: “¿En qué curso estás (4º Primaria – 2º Bachillerato)?”
- Si el curso ya está indicado en DATOS DEL ALUMNO, NO vuelvas a preguntarlo y adapta la profundidad a ese curso.
- Si el alumno ya ha dicho su curso en el historial (p.ej., “3 ESO”, “1 Bach”, “6 Primaria”), NO lo vuelvas a preguntar. Interpreta esas respuestas como curso válido.

ESCALADO (usa intentos_mismo_error si te lo damos)
- 0–1: pista leve + pregunta
- 2: pista más concreta (signos, paréntesis, operación inversa…)
- 3: mini-explicación breve + pide rehacer
- >=4: ofrece “Enviar al profesor” (incluye historial)
${attemptsLine}

FORMATO DE RESPUESTA (OBLIGATORIO)
A) Qué estamos haciendo (1 frase).
B) Pregunta guía (1–2 preguntas).
C) Pista breve (opcional, 0–1 frase).
D) “Escribe tu siguiente paso / pega tu línea exacta”.

CIERRE
Si el alumno cree que ha terminado:
- No validar.
- Di: “Perfecto, ya tienes un procedimiento completo. Envíalo al profesor para confirmación final.”
- Pide: “Envíame foto del ejercicio completo (o pega el final) y te activo ‘Enviar al profesor’.”

${modeBlock}
`.trim();
}

const ChatSchema = z.object({
  text: z.string().max(MAX_TEXT_CHARS).optional(),
  mode: z.string().max(40).optional(),
  attemptsSameError: z.number().int().min(0).max(20).optional(),
  studentCourse: z.string().max(40).optional(),
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
    role: z.string().max(20),
    content: z.string().max(2000),
  })).max(60).optional(),
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
  const attemptsSameError =
    Number.isFinite(body.attemptsSameError) ? Number(body.attemptsSameError) : null;
  const studentCourse = String(body.studentCourse || "").trim();

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

  if (mode) {
    const modeKey = normalizeModeKey(mode);
    if (!ALLOWED_MODES.has(modeKey)) {
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
      attemptsSameError,
      studentCourse,
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
    const attemptsSameError = body.attemptsSameError;
    const studentCourse = body.studentCourse;

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
      studentCourse: studentCourse || null,
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
    historyText = truncateText(historyText, 20000);

    const content = [];

    // -------- ARCHIVO (PDF o DOCX) --------
    if (file && file.dataUrl) {
      const filenameRaw = String(file.name || "archivo");
      const safeName = filenameRaw.replace(/[\/\\]/g, "_").slice(0, MAX_FILENAME_CHARS);
      const mimeRaw = String(file.mime || "");
      const lower = safeName.toLowerCase();
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
            `No puedo leer ese archivo ("${safeName}"). ` +
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
        ? safeName
        : isPDF
          ? `${safeName}.pdf`
          : `${safeName}.docx`;

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
          text: `Contenido del Word (${filename}):\n\n${truncateText(extracted)}`,
        });
      }

      if (isPDF) {
        logLine({
          at: new Date().toISOString(),
          request_id,
          event: "pdf.input_file.base64",
          filename,
          approxBytes,
        });

        // Enviamos el PDF directamente al modelo como input_file base64
        // (evita parseo y evita subir a Files API, más robusto en Vercel).
        content.push({
          type: "input_file",
          filename,
          file_data: `data:application/pdf;base64,${base64}`,
        });
      }
    }

    // -------- IMAGEN --------
    if (image) {
      content.push({ type: "input_image", image_url: String(image) });
    }

    // -------- TEXTO (una vez, al final) --------
    const cleanedText = String(text || "").trim();

    // NO metas [Modo: ...] aquí. El modo ya va en `instructions`.
    const userText = cleanedText;

    // Detecta si hay adjunto REAL (aunque lo hayamos convertido a input_text tras extraer PDF/DOCX)
    const hasAttachment = !!image || !!(file && file.dataUrl);

    // Fallback: NO resume, NO “contesta la pregunta” (porque puede no haber). Pregunta primero.
    const fallbackText = hasAttachment
      ? `He recibido un adjunto. Antes de empezar, dime qué necesitas exactamente:
1) Entenderlo (explicación guiada)
2) Sacar ideas clave (solo si me lo pides)
3) Resolver un ejercicio (tú haces los pasos y yo los reviso)
4) Preparar un examen (teoría + ejercicios guiados)
5) Trabajo (te ayudo a mejorar lo que escribas, sin hacerlo por ti)

¿En qué curso estás (4º Primaria a 2º Bachillerato) y qué opción eliges?`
      : `¿Qué necesitas exactamente y en qué curso estás (4º Primaria a 2º Bachillerato)? Escríbeme el enunciado o sube una foto.`;

    content.push({
      type: "input_text",
      text: hasUserText ? userText : fallbackText,
    });

    const input = [];
    if (historyText) {
      input.push({
        role: "user",
        content: [{ type: "input_text", text: `Contexto previo (chat):\n${historyText}` }],
      });
    }
    input.push({ role: "user", content });

    const instructions = buildTutorInstructions(mode, attemptsSameError, studentCourse);
    const response = await client.responses.create({ model, input, instructions });

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
