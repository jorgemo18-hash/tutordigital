// Tarjeta de un modelo fiscal — mismo .ac-panel (fondo oscuro var(--panel-bg))
// que el resto del panel admin, no la superficie "papel claro" de un
// rediseño anterior (ya retirada).
export function buildModeloCard(hijos) {
  const card = document.createElement("div");
  card.className = "ac-panel ac-fiscal-form";
  card.append(...hijos);
  return card;
}

// Cabecera de sección dentro de la tarjeta (p.ej. "LIQUIDACIÓN", "TRIMESTRAL").
export function buildSeccionHead(texto) {
  const head = document.createElement("div");
  head.className = "ac-fiscal-seccion-head";
  head.textContent = texto;
  return head;
}
