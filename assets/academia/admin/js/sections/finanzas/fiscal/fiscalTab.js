import { fetchRegimenFiscal } from "../../../apiFinanzas.js";
import { buildPeriodoTrimestralSelector, trimestreActual } from "./periodoTrimestralSelector.js";
import { buildNotaDiscreta } from "./notaDiscreta.js";
import { renderModelo130 } from "./modelo130.js";
import { renderModelo202 } from "./modelo202.js";
import { renderModelo115 } from "./modelo115.js";
import { renderModelo111 } from "./modelo111.js";

const AVISO_LEGAL = "Datos orientativos. Este resumen no tiene validez fiscal oficial. Consulta con tu asesor.";
const AVISO_SIN_REGIMEN = "El régimen fiscal de este centro no está configurado. Contacta con el administrador de TutorDigital.";

// El primer modelo de cada lista cambia según el régimen del tenant
// (130 IRPF autónomo / 202 Impuesto de Sociedades); 115 y 111 son
// comunes a ambos regímenes.
const SUBTABS_POR_REGIMEN = {
  autonomo: [{ id: "130", label: "Modelo 130" }, { id: "115", label: "Modelo 115" }, { id: "111", label: "Modelo 111" }],
  sociedad: [{ id: "202", label: "Modelo 202" }, { id: "115", label: "Modelo 115" }, { id: "111", label: "Modelo 111" }],
};
const RENDERERS = { 130: renderModelo130, 202: renderModelo202, 115: renderModelo115, 111: renderModelo111 };

function buildAvisoSinRegimen() {
  const wrap = document.createElement("div");
  wrap.className = "ac-fiscal-sin-regimen";
  const p = document.createElement("p");
  p.textContent = AVISO_SIN_REGIMEN;
  wrap.appendChild(p);
  return wrap;
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

// Pestaña Fiscal — qué modelos se muestran depende de tenants.regimen_fiscal
// ('autonomo' -> 130, 'sociedad' -> 202, null -> ningún modelo, solo el
// aviso). Selector año+trimestre y aviso legal son comunes a las 3
// sub-pestañas; cada una se renderiza en contentEl, que se vuelve a montar
// entero al cambiar de período o de sub-pestaña (mismo patrón que
// finanzasSection.js con Ingresos/Gastos/Resumen, un nivel más adentro).
export function renderFiscalTab(container) {
  container.innerHTML = "";
  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando…";
  container.appendChild(cargando);

  fetchRegimenFiscal()
    .then((regimenFiscal) => {
      container.innerHTML = "";

      if (!regimenFiscal || !SUBTABS_POR_REGIMEN[regimenFiscal]) {
        container.appendChild(buildAvisoSinRegimen());
        return;
      }

      const subtabs = SUBTABS_POR_REGIMEN[regimenFiscal];
      let { anio, trimestre } = trimestreActual();
      let activeSubtab = subtabs[0].id;
      let contentEl = null;

      function renderActiveSubtab() {
        if (!contentEl) return;
        RENDERERS[activeSubtab](contentEl, { anio, trimestre });
      }

      container.appendChild(buildNotaDiscreta(AVISO_LEGAL));

      const periodoWrap = document.createElement("div");
      periodoWrap.style.marginBottom = "18px";
      periodoWrap.appendChild(
        buildPeriodoTrimestralSelector({
          anio, trimestre, anioActualSistema: trimestreActual().anio,
          onChange: (periodo) => { anio = periodo.anio; trimestre = periodo.trimestre; renderActiveSubtab(); },
        })
      );
      container.appendChild(periodoWrap);

      const subtabsCtl = buildSubtabs(subtabs, activeSubtab, (id) => {
        activeSubtab = id;
        subtabsCtl.setActive(id);
        renderActiveSubtab();
      });
      container.appendChild(subtabsCtl.wrap);

      contentEl = document.createElement("div");
      container.appendChild(contentEl);
      renderActiveSubtab();
    })
    .catch((err) => {
      container.innerHTML = "";
      const p = document.createElement("p");
      p.className = "ac-error";
      p.textContent = err.message || "No se pudo cargar la pestaña Fiscal.";
      container.appendChild(p);
    });
}
