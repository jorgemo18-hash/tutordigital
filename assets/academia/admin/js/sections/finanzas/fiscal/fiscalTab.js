import { fetchRegimenFiscal } from "../../../apiFinanzas.js";
import { buildPeriodoTrimestralSelector, trimestreActual } from "./periodoTrimestralSelector.js";
import { buildNotaDiscreta } from "./notaDiscreta.js";
import { buildModoSelector } from "./modoSelector.js";
import { renderModelo130 } from "./modelo130.js";
import { renderModelo202 } from "./modelo202.js";
import { renderModelo115 } from "./modelo115.js";
import { renderModelo111 } from "./modelo111.js";
import { renderModelo303 } from "./modelo303.js";
import { renderModoAnual } from "./anuales/modoAnual.js";

const AVISO_LEGAL = "Datos orientativos. Este resumen no tiene validez fiscal oficial. Consulta con tu asesor.";
const AVISO_SIN_REGIMEN = "El régimen fiscal de este centro no está configurado. Contacta con el administrador de TutorDigital.";

const SUBTABS_POR_REGIMEN = {
  autonomo: [
    { id: "130", label: "Modelo 130" },
    { id: "115", label: "Modelo 115" },
    { id: "111", label: "Modelo 111" },
  ],
  sociedad: [
    { id: "202", label: "Modelo 202" },
    { id: "303", label: "Modelo 303" },
    { id: "115", label: "Modelo 115" },
    { id: "111", label: "Modelo 111" },
  ],
};

const RENDERERS = {
  130: renderModelo130,
  202: renderModelo202,
  115: renderModelo115,
  111: renderModelo111,
  303: renderModelo303,
};

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

function renderModoTrimestral(container, { regimenFiscal, desglose_iva }) {
  const subtabs = SUBTABS_POR_REGIMEN[regimenFiscal];
  let { anio, trimestre } = trimestreActual();
  let activeSubtab = subtabs[0].id;
  let contentEl = null;

  function renderActiveSubtab() {
    if (!contentEl) return;
    RENDERERS[activeSubtab](contentEl, { anio, trimestre, desglose_iva });
  }

  container.appendChild(buildNotaDiscreta(AVISO_LEGAL));

  const filaPeriodo = document.createElement("div");
  filaPeriodo.className = "ac-fiscal-periodo-row";
  filaPeriodo.style.marginBottom = "18px";
  filaPeriodo.appendChild(buildPeriodoTrimestralSelector({
    anio, trimestre,
    anioActualSistema: trimestreActual().anio,
    onChange: (p) => { anio = p.anio; trimestre = p.trimestre; renderActiveSubtab(); },
  }));
  container.appendChild(filaPeriodo);

  const subtabsCtl = buildSubtabs(subtabs, activeSubtab, (id) => {
    activeSubtab = id;
    subtabsCtl.setActive(id);
    renderActiveSubtab();
  });
  container.appendChild(subtabsCtl.wrap);

  contentEl = document.createElement("div");
  container.appendChild(contentEl);
  renderActiveSubtab();
}

export async function renderFiscalTab(container, fiscalInfo = null) {
  container.innerHTML = "";
  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando...";
  container.appendChild(cargando);

  try {
    const { regimen_fiscal, desglose_iva } = fiscalInfo ?? await fetchRegimenFiscal();
    container.innerHTML = "";

    if (!regimen_fiscal || !SUBTABS_POR_REGIMEN[regimen_fiscal]) {
      container.appendChild(buildAvisoSinRegimen());
      return;
    }

    let modo = "trimestral";
    const contentModo = document.createElement("div");

    function renderModo() {
      contentModo.innerHTML = "";
      if (modo === "trimestral") {
        renderModoTrimestral(contentModo, { regimenFiscal: regimen_fiscal, desglose_iva });
      } else {
        renderModoAnual(contentModo, { regimenFiscal: regimen_fiscal });
      }
    }

    container.appendChild(buildModoSelector(modo, (nuevoModo) => {
      modo = nuevoModo;
      renderModo();
    }));
    container.appendChild(contentModo);
    renderModo();
  } catch (err) {
    container.innerHTML = "";
    const p = document.createElement("p");
    p.className = "ac-error";
    p.textContent = err.message || "No se pudo cargar la pestanna Fiscal.";
    container.appendChild(p);
  }
}
