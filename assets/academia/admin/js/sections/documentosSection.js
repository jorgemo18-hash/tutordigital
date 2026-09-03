import { buildHojaInscripcionCard } from "./documentos/hojaInscripcionCard.js";
import { buildNormasCard } from "./documentos/normasCard.js";
import { buildHojaFamiliasCard } from "./documentos/hojaFamiliasCard.js";
import { buildPreviewPanel } from "./documentos/preview/previewPanel.js";

export function renderDocumentosSection(container, { tenantNombre = "" } = {}) {
  if (!container) return;
  container.innerHTML = "";

  const head = document.createElement("div");
  head.className = "ac-body-head";
  const title = document.createElement("h1");
  title.className = "ac-title";
  title.textContent = "Documentos";
  head.appendChild(title);
  container.appendChild(head);

  const preview = buildPreviewPanel();

  const cards = document.createElement("div");
  cards.className = "ac-doc-cards";
  cards.append(
    buildHojaInscripcionCard({ preview, tenantNombre }),
    buildHojaFamiliasCard({ preview, tenantNombre }),
    buildNormasCard({ preview, tenantNombre })
  );
  container.append(cards, preview.el);
}
