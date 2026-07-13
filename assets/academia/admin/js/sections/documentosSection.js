import { buildHojaInscripcionCard } from "./documentos/hojaInscripcionCard.js";
import { buildNormasCard } from "./documentos/normasCard.js";

export function renderDocumentosSection(container) {
  if (!container) return;
  container.innerHTML = "";

  const head = document.createElement("div");
  head.className = "ac-body-head";
  const title = document.createElement("h1");
  title.className = "ac-title";
  title.textContent = "Documentos";
  head.appendChild(title);
  container.appendChild(head);

  const cards = document.createElement("div");
  cards.className = "ac-doc-cards";
  cards.append(buildHojaInscripcionCard(), buildNormasCard());
  container.appendChild(cards);
}
