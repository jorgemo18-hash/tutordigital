function detectarPdfPorUrl(fotoUrl) {
  const url = fotoUrl.toLowerCase();
  return url.split("?")[0].endsWith(".pdf") || url.includes("%2epdf");
}

// Un iframe es un browsing context aparte: un click dentro de él nunca
// llega a un <a> que lo envuelva, así que para que "toda la preview sea
// clicable" hace falta un enlace transparente superpuesto encima en vez
// de envolver el iframe.
function buildPdfPreview(fotoUrl, alt) {
  const pdfWrap = document.createElement("div");
  pdfWrap.className = "ac-adjunto-foto-pdf-wrap";

  const iframe = document.createElement("iframe");
  iframe.src = fotoUrl;
  iframe.className = "ac-adjunto-foto-pdf-iframe";

  const overlay = document.createElement("a");
  overlay.href = fotoUrl;
  overlay.target = "_blank";
  overlay.rel = "noopener noreferrer";
  overlay.className = "ac-adjunto-foto-pdf-overlay";
  overlay.setAttribute("aria-label", `Abrir ${alt.toLowerCase()} en una pestaña nueva`);

  pdfWrap.append(iframe, overlay);
  return pdfWrap;
}

function buildImgPreview(fotoUrl, alt) {
  const img = document.createElement("img");
  img.src = fotoUrl;
  img.alt = alt;
  img.className = "ac-adjunto-foto-img";
  img.style.cursor = "pointer";
  img.addEventListener("click", () => window.open(fotoUrl, "_blank"));
  return img;
}

// Miniatura de un archivo adjunto (imagen clicable a tamaño completo, o
// iframe si es PDF). La usan la factura de un gasto —tanto el drawer de
// detalle (gastoFotoBlock.js, URL ya subida con extensión real) como el
// flujo de OCR de gasto nuevo (gastoUpload.js, URL de objeto local sin
// extensión, por eso ahí hace falta indicar `esPdf` en vez de inferirlo)—
// y la ficha de inscripción del alumno.
//
// Vivía en sections/finanzas porque solo había facturas. Al guardar también
// la ficha del alumno deja de ser cosa de finanzas: es "enseñar un adjunto",
// y copiarlo habría dejado dos miniaturas que se irían separando.
export function buildFotoDisplay(fotoUrl, { esPdf = detectarPdfPorUrl(fotoUrl), alt = "Adjunto" } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-adjunto-foto-wrap";
  wrap.appendChild(esPdf ? buildPdfPreview(fotoUrl, alt) : buildImgPreview(fotoUrl, alt));
  return wrap;
}
