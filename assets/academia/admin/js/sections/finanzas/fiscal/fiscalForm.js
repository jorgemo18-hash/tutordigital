// Envoltorio "papel" del contenido de cada modelo — fondo claro, tinta
// oscura, como un formulario oficial impreso (generaliza la paleta que ya
// usa el recibo, .ef-preview, bajo las clases reutilizables .ac-paper/
// .ac-paper-ink, ver _academia-admin-secciones.css).
export function buildPaperForm(hijos) {
  const paper = document.createElement("div");
  paper.className = "ac-paper ac-paper-ink ac-fiscal-form";
  paper.append(...hijos);
  return paper;
}

// Cabecera de sección dentro del papel (p.ej. "LIQUIDACIÓN", "TRIMESTRAL").
export function buildSeccionHead(texto) {
  const head = document.createElement("div");
  head.className = "ac-fiscal-seccion-head";
  head.textContent = texto;
  return head;
}
