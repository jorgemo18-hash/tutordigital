import { buildPeriodoTrimestralSelector, trimestreActual } from "./periodoTrimestralSelector.js";
import { buildBannerInfo } from "./bannerInfo.js";
import { renderModelo130 } from "./modelo130.js";
import { renderModelo115 } from "./modelo115.js";
import { renderModelo111 } from "./modelo111.js";

const AVISO_LEGAL = "Datos orientativos. Este resumen no tiene validez fiscal oficial. Consulta con tu asesor.";

const SUBTABS = [
  { id: "130", label: "Modelo 130" },
  { id: "115", label: "Modelo 115" },
  { id: "111", label: "Modelo 111" },
];

function buildSubtabs(activeId, onSelect) {
  const wrap = document.createElement("div");
  wrap.className = "ac-list-tabs";
  wrap.style.marginBottom = "18px";
  const buttons = new Map();
  for (const tab of SUBTABS) {
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

const RENDERERS = { 130: renderModelo130, 115: renderModelo115, 111: renderModelo111 };

// Pestaña Fiscal — selector año+trimestre y aviso legal son comunes a las
// 3 sub-pestañas (Modelo 130/115/111); cada una se renderiza en
// contentEl, que se vuelve a montar entero al cambiar de período o de
// sub-pestaña (mismo patrón que finanzasSection.js con Ingresos/Gastos/
// Resumen, un nivel más adentro).
export function renderFiscalTab(container) {
  let { anio, trimestre } = trimestreActual();
  let activeSubtab = "130";
  let contentEl = null;

  function renderActiveSubtab() {
    if (!contentEl) return;
    RENDERERS[activeSubtab](contentEl, { anio, trimestre });
  }

  function render() {
    container.innerHTML = "";
    container.appendChild(buildBannerInfo(AVISO_LEGAL));

    const periodoWrap = document.createElement("div");
    periodoWrap.style.marginBottom = "18px";
    periodoWrap.appendChild(
      buildPeriodoTrimestralSelector({
        anio, trimestre, anioActualSistema: trimestreActual().anio,
        onChange: (periodo) => { anio = periodo.anio; trimestre = periodo.trimestre; renderActiveSubtab(); },
      })
    );
    container.appendChild(periodoWrap);

    const subtabsCtl = buildSubtabs(activeSubtab, (id) => {
      activeSubtab = id;
      subtabsCtl.setActive(id);
      renderActiveSubtab();
    });
    container.appendChild(subtabsCtl.wrap);

    contentEl = document.createElement("div");
    container.appendChild(contentEl);
    renderActiveSubtab();
  }

  render();
}
