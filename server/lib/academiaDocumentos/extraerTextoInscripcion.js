import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { getBase64FromMaybeDataUrl, approxBase64Bytes } from "../chatValidation.js";

export const MAX_DOCUMENTO_BYTES = 10 * 1024 * 1024;

const MIME_PDF = "application/pdf";
const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Extrae el texto de un PDF o DOCX subido para la cara trasera de la hoja
// de inscripción (protección de datos) — mismas herramientas que ya usa
// el chat del tutor para adjuntos (mammoth para DOCX, pdf-parse para PDF,
// ver server/lib/chat.js), solo que aquí el resultado se guarda tal cual
// en vez de inyectarse en un prompt. No se guarda el archivo original,
// solo el texto extraído.
export async function extraerTextoDocumento({ base64Input, mime }) {
  if (mime !== MIME_PDF && mime !== MIME_DOCX) {
    return { ok: false, code: "unsupported_mime", motivo: "Solo se aceptan documentos PDF o DOCX." };
  }
  const base64 = getBase64FromMaybeDataUrl(base64Input);
  if (!base64) return { ok: false, code: "invalid_base64", motivo: "Archivo inválido." };
  if (approxBase64Bytes(base64) > MAX_DOCUMENTO_BYTES) {
    return {
      ok: false,
      code: "payload_too_large",
      motivo: `El archivo supera los ${Math.round(MAX_DOCUMENTO_BYTES / (1024 * 1024))}MB permitidos.`,
    };
  }

  const buf = Buffer.from(base64, "base64");
  let texto = "";
  try {
    if (mime === MIME_DOCX) {
      const result = await mammoth.extractRawText({ buffer: buf });
      texto = String(result?.value || "").replace(/\r/g, "").trim();
    } else {
      const result = await pdfParse(buf);
      texto = String(result?.text || "").replace(/\r/g, "").trim();
    }
  } catch {
    return { ok: false, code: "extraction_failed", motivo: "No se pudo extraer el texto del documento." };
  }
  if (!texto) return { ok: false, code: "empty_extraction", motivo: "No se encontró texto en el documento." };

  return { ok: true, texto };
}
