function detectarPdfPorUrl(fotoUrl) {
  const url = fotoUrl.toLowerCase();
  return url.split("?")[0].endsWith(".pdf") || url.includes("%2epdf");
}

// Un iframe es un browsing context aparte: un click dentro de él nunca
// llega a un <a> que lo envuelva, así que para que "toda la preview sea
// clicable" hace falta un enlace transparente superpuesto encima en vez
// de envolver el iframe.
function buildPdfPreview(fotoUrl) {
  const pdfWrap = document.createElement("div");
  pdfWrap.className = "ac-gasto-foto-pdf-wrap";

  const iframe = document.createElement("iframe");
  iframe.src = fotoUrl;
  iframe.className = "ac-gasto-foto-pdf-iframe";

  const overlay = document.createElement("a");
  overlay.href = fotoUrl;
  overlay.target = "_blank";
  overlay.rel = "noopener noreferrer";
  overlay.className = "ac-gasto-foto-pdf-overlay";
  overlay.setAttribute("aria-label", "Abrir factura en una pestaña nueva");

  pdfWrap.append(iframe, overlay);
  return pdfWrap;
}

function buildImgPreview(fotoUrl) {
  const img = document.createElement("img");
  img.src = fotoUrl;
  img.alt = "Factura";
  img.className = "ac-gasto-foto-img";
  img.style.cursor = "pointer";
  img.addEventListener("click", () => window.open(fotoUrl, "_blank"));
  return img;
}

// Miniatura de una factura (imagen clicable a tamaño completo, o iframe si
// es PDF), compartida por el drawer de detalle (gastoFotoBlock.js, URL ya
// subida con extensión real) y el flujo de OCR de gasto nuevo
// (gastoUpload.js, URL de objeto local sin extensión — por eso ahí hace
// falta indicar `esPdf` explícitamente en vez de inferirlo de la URL).
export function buildFotoDisplay(fotoUrl, { esPdf = detectarPdfPorUrl(fotoUrl) } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-gasto-foto-wrap";
  wrap.appendChild(esPdf ? buildPdfPreview(fotoUrl) : buildImgPreview(fotoUrl));
  return wrap;
}
