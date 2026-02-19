export async function pdfFirstPageToPngDataURL(file, { maxWidth = 1400, scale = 1.6 } = {}) {
  try {
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib?.getDocument) return null;

    const ab = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale });
    let targetScale = scale;
    if (viewport.width > maxWidth) {
      targetScale = (maxWidth / viewport.width) * scale;
    }
    const vp = page.getViewport({ scale: targetScale });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: false });
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);

    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    return canvas.toDataURL("image/png");
  } catch (e) {
    console.warn("pdfFirstPageToPngDataURL failed:", e);
    return null;
  }
}

export function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
