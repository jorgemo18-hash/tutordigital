// sendPayload.js — construye el payload de askGPT (imageDataUrl/fileDataUrl/
// modelText/studentCourse) a partir de un adjunto ya resuelto (ver
// getPendingAttachmentInfo en send.js) — extraído de send.js para dejarle
// margen real bajo las 400 líneas, no solo para cumplir el número.
import {
  getStoredStudentCourse,
  extractStudentCourseFromText,
  storeStudentCourse,
} from "./studentCourse.js";

export async function buildSendPayload(a, { rawText, t, fromBoard, hasFile, silentUser }) {
  const storedCourse = getStoredStudentCourse();
  const extractedCourse = (!storedCourse && !silentUser)
    ? extractStudentCourseFromText(rawText)
    : "";
  const studentCourse = storedCourse || extractedCourse;
  if (!storedCourse && extractedCourse) storeStudentCourse(extractedCourse);

  let imageDataUrl = a.isImage ? (a.dataUrl || null) : null;
  if (a.isImage && !imageDataUrl && a.file) {
    imageDataUrl = await new Promise((resolve) => {
      try {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ""));
        r.onerror = () => resolve("");
        r.readAsDataURL(a.file);
      } catch {
        resolve("");
      }
    });
    if (!imageDataUrl) imageDataUrl = null;
  }
  // Normalize: mobile browsers can return data:application/octet-stream when
  // file.type is empty. Patch the MIME prefix so chatValidation accepts it.
  if (imageDataUrl && imageDataUrl.startsWith("data:") && !/^data:image\//i.test(imageDataUrl)) {
    const b64idx = imageDataUrl.indexOf("base64,");
    if (b64idx !== -1) imageDataUrl = "data:image/jpeg;base64," + imageDataUrl.slice(b64idx + 7);
  }

  const isFile = a.isPDF || a.isDocx;
  const fileDataUrl = isFile ? (a.dataUrl || null) : null;
  const fileName = isFile
    ? String(a.name || (a.isPDF ? "archivo.pdf" : "archivo.docx"))
    : undefined;

  const fileMime = isFile
    ? (a.type || a.suggestedMime || (a.isPDF
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
    : undefined;

  let modelText = t;
  if (imageDataUrl && !silentUser) {
    modelText =
      "Analiza la imagen adjunta y ayúdame con ello." +
      (t ? `\n\nTexto del alumno: ${t}` : "");
  }
  if (fromBoard) {
    modelText += "\n\nSi una imagen viene de pizarra y no la entiendes, pide que la redibuje o la escriba.";
  }
  if (hasFile) {
    const confirmMsg =
      "Primero, confirma brevemente que ves el adjunto y resume qué contiene (1-2 frases). " +
      "Luego pregunta qué parte quiere trabajar o por qué ejercicio empezar. " +
      "Después responde a lo que haya escrito el alumno, si aplica.\n\n";
    modelText = confirmMsg + (modelText || "El alumno no escribió texto adicional.");
  }

  return { imageDataUrl, fileDataUrl, fileName, fileMime, modelText, studentCourse };
}
