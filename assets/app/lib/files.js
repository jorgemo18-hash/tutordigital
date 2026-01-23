// assets/app/lib/files.js
// Detección/validación centralizada de adjuntos.

const PDF_MIME = "application/pdf";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function extOf(name = "") {
  const m = String(name).toLowerCase().match(/\.([a-z0-9]+)$/i);
  return m ? m[1] : "";
}

/**
 * Devuelve info normalizada del archivo.
 * @param {File} file
 * @returns {{
 *  kind: "image"|"pdf"|"docx"|"unknown",
 *  name: string,
 *  type: string,
 *  isImage: boolean,
 *  isPDF: boolean,
 *  isDocx: boolean,
 *  isWord: boolean,
 *  isSupported: boolean,
 *  suggestedMime: string
 * }}
 */
export function getFileKind(file) {
  const type = String(file?.type || "");
  const name = String(file?.name || "");
  const ext = extOf(name);

  const isImage = /^image\//.test(type) || (!type && /^(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i.test(ext));
  const isPDF = type === PDF_MIME || (!type && ext === "pdf");
  const isDocx = type === DOCX_MIME || (!type && ext === "docx");

  let kind = "unknown";
  if (isImage) kind = "image";
  else if (isPDF) kind = "pdf";
  else if (isDocx) kind = "docx";

  const isSupported = kind === "image" || kind === "pdf" || kind === "docx";
  const suggestedMime =
    type ||
    (kind === "pdf"
      ? PDF_MIME
      : kind === "docx"
        ? DOCX_MIME
        : "");

  return {
    kind,
    name,
    type,
    isImage: kind === "image",
    isPDF: kind === "pdf",
    isDocx: kind === "docx",
    isWord: kind === "docx",
    isSupported,
    suggestedMime,
  };
}

export const detectFileKind = getFileKind;

/**
 * Decide si el archivo se acepta para adjuntar.
 * @param {File} file
 */
export function isAcceptedFile(file) {
  if (!file) return false;
  return !!getFileKind(file).isSupported;
}
