import { buildCentroTab } from "./ajustes/tabs/centroTab.js";
import { buildHorarioTab } from "./ajustes/tabs/horarioTab.js";
import { buildFacturacionTab } from "./ajustes/tabs/facturacionTab.js";
import { buildInscripcionTab } from "./ajustes/tabs/inscripcionTab.js";
import { buildMarcaTab } from "./ajustes/tabs/marcaTab.js";

// 5 pestañas que agrupan las tarjetas de Ajustes (antes apiladas en una
// sola rejilla con scroll infinito). `build(opts)` recibe siempre el mismo
// objeto de opciones — solo marcaTab usa onLogoActualizado/onBgActualizado,
// el resto los ignora.
const TABS = [
  { id: "centro", label: "Datos del centro", build: buildCentroTab },
  { id: "horario", label: "Horario", build: buildHorarioTab },
  { id: "facturacion", label: "Facturación", build: buildFacturacionTab },
  { id: "inscripcion", label: "Inscripción", build: buildInscripcionTab },
  { id: "marca", label: "Marca y textos", build: buildMarcaTab },
];

// `onLogoActualizado`/`onBgActualizado` vienen de academiaAdmin.js — se
// reenvían tal cual hasta marcaTab/personalizacionPanel, que son los
// únicos que los necesitan.
export function renderAjustesSection(container, { onLogoActualizado, onBgActualizado } = {}) {
  if (!container) return;
  container.innerHTML = "";

  const head = document.createElement("div");
  head.className = "ac-body-head";
  const title = document.createElement("h1");
  title.className = "ac-title";
  title.textContent = "Ajustes";
  head.appendChild(title);

  const tabsNav = document.createElement("div");
  tabsNav.className = "ac-tabs";
  const botones = new Map();
  head.appendChild(tabsNav);

  const body = document.createElement("div");

  function seleccionarTab(tabId) {
    for (const [id, btn] of botones) btn.classList.toggle("active", id === tabId);
    const tab = TABS.find((t) => t.id === tabId);
    body.innerHTML = "";
    body.appendChild(tab.build({ onLogoActualizado, onBgActualizado }));
  }

  for (const tab of TABS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ac-tab";
    btn.textContent = tab.label;
    btn.addEventListener("click", () => seleccionarTab(tab.id));
    tabsNav.appendChild(btn);
    botones.set(tab.id, btn);
  }

  container.append(head, body);
  seleccionarTab(TABS[0].id);
}
