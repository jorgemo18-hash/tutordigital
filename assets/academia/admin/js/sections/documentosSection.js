const DOCUMENTOS = [
  { titulo: "Hoja de inscripción", sub: "Plantilla en PDF para captar datos del alumno y la familia" },
  { titulo: "Pack de bienvenida", sub: "Normas del centro, horario tipo y datos de contacto" },
];

function buildCard({ titulo, sub }) {
  const card = document.createElement("div");
  card.className = "ac-doc-card";
  const title = document.createElement("div");
  title.className = "ac-doc-card-title";
  title.textContent = titulo;
  const subEl = document.createElement("div");
  subEl.className = "ac-doc-card-sub";
  subEl.textContent = sub;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ac-btn ghost";
  btn.textContent = "Vista previa";
  btn.addEventListener("click", () => window.alert(`Vista previa de "${titulo}" — próximamente.`));
  card.append(title, subEl, btn);
  return card;
}

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
  for (const doc of DOCUMENTOS) cards.appendChild(buildCard(doc));
  container.appendChild(cards);
}
