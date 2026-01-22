// assets/lib/files.js
// Detección/validación centralizada de adjuntos.

export const MIME = {
  PDF: "application/pdf",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  DOC: "application/msword",
  XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  PPTX: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

function extOf(name = "") {
  const m = String(name).toLowerCase().match(/\.([a-z0-9]+)$/i);
  return m ? m[1] : "";
}

/**
 * Devuelve info normalizada del archivo.
 * @param {File} file
 * @returns {{kind:string, isImage:boolean, isSupported:boolean, label:string}}
 */
export function getFileKind(file) {
  const type = String(file?.type || "");
  const name = String(file?.name || "");
  const ext = extOf(name);

  const isImage = /^image\//.test(type) || ["png", "jpg", "jpeg", "gif", "webp", "heic"].includes(ext);

  const isPDF = type === MIME.PDF || (!type && ext === "pdf");
  const isDocx = type === MIME.DOCX || (!type && ext === "docx");
  const isDoc = type === MIME.DOC || (!type && ext === "doc");
  const isXlsx = type === MIME.XLSX || (!type && ext === "xlsx");
  const isPptx = type === MIME.PPTX || (!type && ext === "pptx");

  let kind = "unknown";
  if (isImage) kind = "image";
  else if (isPDF) kind = "pdf";
  else if (isDocx) kind = "docx";
  else if (isDoc) kind = "doc";
  else if (isXlsx) kind = "xlsx";
  else if (isPptx) kind = "pptx";

  // ✅ Solo lo que tu app procesa hoy con fiabilidad:
  const isSupported = kind === "image" || kind === "pdf" || kind === "docx";

  const label =
    kind === "image" ? "Imagen" :
    kind === "pdf" ? "PDF" :
    kind === "docx" ? "Word" :
    kind === "doc" ? "Word (.doc)" :
    kind === "xlsx" ? "Excel" :
    kind === "pptx" ? "PowerPoint" :
    "Archivo";

  return { kind, isImage: kind === "image", isSupported, label };
}

/**
 * Decide si el archivo se acepta para adjuntar.
 * @param {File} file
 */
export function isAcceptedFile(file) {
  if (!file) return false;
  return !!getFileKind(file).isSupported;
}