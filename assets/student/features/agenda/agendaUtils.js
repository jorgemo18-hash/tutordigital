export function formatFileSize(size) {
  if (!size && size !== 0) return "";
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function inferMimeType(name) {
  const value = String(name || "").toLowerCase();
  if (value.endsWith(".pdf")) return "application/pdf";
  if (value.endsWith(".png")) return "image/png";
  if (value.endsWith(".jpg") || value.endsWith(".jpeg")) return "image/jpeg";
  if (value.endsWith(".webp")) return "image/webp";
  if (value.endsWith(".gif")) return "image/gif";
  return "";
}

export function truncateName(name) {
  if (!name || name.length <= 40) return name;
  return name.slice(0, 20) + "..." + name.slice(-15);
}

export function formatDueDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

export function slugifySubject(name) {
  const map = {
    "matemáticas": "subj-mat", "mates": "subj-mat",
    "lengua": "subj-len", "castellano": "subj-len",
    "historia": "subj-his",
    "inglés": "subj-ing", "ingles": "subj-ing",
    "biología": "subj-bio", "biologia": "subj-bio",
    "física": "subj-fis", "fisica": "subj-fis",
    "tecnología": "subj-tec", "tecnologia": "subj-tec",
  };
  return map[name.toLowerCase().trim()] || "subj-def";
}

/**
 * Renders first PDF page and returns a ready <canvas> element, or null on failure.
 */
export async function renderPdfThumb(file) {
  const pdfjs = window.pdfjsDistBuildPdf;
  if (!pdfjs?.getDocument) {
    console.warn("[agendaUtils] pdfjsDistBuildPdf.getDocument no disponible");
    return null;
  }
  if (pdfjs.PDFJS) pdfjs.PDFJS.disableWorker = true;
  try {
    const ab = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(ab) }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport(1);
    const scale = 440 / viewport.width;
    const scaled = page.getViewport(scale);

    const canvas = document.createElement("canvas");
    canvas.width  = Math.floor(scaled.width);
    canvas.height = Math.floor(scaled.height);
    canvas.style.width        = "100%";
    canvas.style.height       = "auto";
    canvas.style.display      = "block";
    canvas.style.borderRadius = "8px";
    canvas.style.cursor       = "pointer";
    canvas.style.boxShadow    = "0 2px 8px rgba(0,0,0,0.3)";

    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport: scaled }).promise;
    return canvas;
  } catch (e) {
    console.warn("[agendaUtils] PDF thumb error:", e);
    return null;
  }
}