import { trimestreActual } from "../periodoTrimestralSelector.js";
import { renderModelo180 } from "./modelo180.js";
import { renderModelo390 } from "./modelo390.js";

// Modelos anuales según régimen:
//   autonomo → 180
//   sociedad  → 180, 390
const SUBTABS_ANUALES = {
  autonomo: [{ id: "180", label: "Modelo 180" }],
  sociedad:  [{ id: "180", label: "Modelo 180" }, { id: "390", label: "Modelo 390" }],
};

const RENDERERS_ANUALES = {
  180: renderModelo180,
  390: renderModelo390,
};

function buildSelectAnio(anioSeleccionado, anioActual) {
  const sel = document.createElement("select");
  sel.className = "ac-select ac-fiscal-selector-anio";
  for (let a = 2024; a <= anioActual + 1; a++) {
    const opt = document.createElement("option");
    opt.value = String(a);
    opt.textContent = String(a);
    opt.selected = a === anioSeleccionado;
    sel.appendChild(opt);
  }
  return sel;
}

function buildSubtabs(subtabs, activeId, onSelect) {
  const wrap = document.createElement("div");
  wrap.className = "ac-list-tabs";
  wrap.style.marginBottom = "18px";
  const buttons = new Map();
  for (const tab of subtabs) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ac-list-tab";
    btn.textContent = tab.label;
    btn.addEventListener("click", () => onSelect(tab.id));
    wrap.appendChild(btn);
    buttons.set(tab.id, btn);
  }
  function setActive(id) {
    for (const [tid, btn] of buttons) btn.classList.toggle("active", tid === id);
  }
  setActive(activeId);
  return { wrap, setActive };
}

export function renderModoAnual(container, { regimenFiscal }) {
  const subtabs = SUBTABS_ANUALES[regimenFiscal];
  if (!subtabs) { container.innerHTML = ""; return; }

  let anio = trimestreActual().anio;
  let activeSubtab = subtabs[0].id;
  let contentEl = null;

  function renderActiveSubtab() {
    if (!contentEl) return;
    RENDERERS_ANUALES[activeSubtab](contentEl, { anio });
  }

  const filaAnio = document.createElement("div");
  filaAnio.className = "ac-fiscal-periodo-row";
  filaAnio.style.marginBottom = "18px";
  const selAnio = buildSelectAnio(anio, trimestreActual().anio);
  selAnio.addEventListener("change", () => { anio = Number(selAnio.value); renderActiveSubtab(); });
  filaAnio.appendChild(selAnio);
  container.appendChild(filaAnio);

  if (subtabs.length > 1) {
    const subtabsCtl = buildSubtabs(subtabs, activeSubtab, (id) => {
      activeSubtab = id;
      subtabsCtl.setActive(id);
      renderActiveSubtab();
    });
    container.appendChild(subtabsCtl.wrap);
  }

  contentEl = document.createElement("div");
  container.appendChild(contentEl);
  renderActiveSubtab();
}
