// Envuelve contenido en una tarjeta — mismo patrón que gastosTab.js/
// resumenTab.js, compartido aquí entre los 3 modelos para no repetirlo
// una tercera vez dentro de fiscal/.
export function buildPanelBlock(hijos) {
  const panel = document.createElement("div");
  panel.className = "ac-panel";
  panel.style.marginBottom = "18px";
  panel.append(...hijos);
  return panel;
}

// Título de sub-sección dentro de una pestaña de modelo (p.ej. "TRIMESTRAL",
// "ANUAL — MODELO 180") — usado por modelo115.js y modelo111.js.
export function buildTitulo(texto) {
  const h = document.createElement("h3");
  h.className = "ac-section-title";
  h.textContent = texto;
  return h;
}
