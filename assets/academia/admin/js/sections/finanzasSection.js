import { createGasto, updateGasto, deleteGasto, uploadFotoGasto, fetchRegimenFiscal } from "../apiFinanzas.js";
import { renderIngresosTab } from "./finanzas/ingresosTab.js";
import { renderGastosTab } from "./finanzas/gastosTab.js";
import { renderResumenTab } from "./finanzas/resumenTab.js";
import { renderFiscalTab } from "./finanzas/fiscal/fiscalTab.js";
import { createGastoDrawer } from "./finanzas/gastoDrawer.js";

const TABS_BASE = [
  { id: "ingresos", label: "Ingresos" },
  { id: "gastos",   label: "Gastos" },
  { id: "resumen",  label: "Resumen" },
  { id: "fiscal",   label: "Fiscal" },
];

function buildTabs(tabs, activeId, onSelect) {
  const wrap = document.createElement("div");
  wrap.className = "ac-list-tabs";
  wrap.style.marginBottom = "18px";
  const buttons = new Map();
  for (const tab of tabs) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ac-list-tab";
    btn.textContent = tab.label;
    btn.addEventListener("click", () => onSelect(tab.id));
    wrap.appendChild(btn);
    buttons.set(tab.id, btn);
  }
  function setActive(tabId) {
    for (const [id, btn] of buttons) btn.classList.toggle("active", id === tabId);
  }
  setActive(activeId);
  return { wrap, setActive };
}

export function createFinanzasSection() {
  let activeTabId = "ingresos";
  let tabContentEl = null;
  let fiscalInfo = null;

  const gastoDrawer = createGastoDrawer(document.body, {
    // Crear PRIMERO, subir la foto DESPUÉS: hasta que el gasto no existe no
    // hay id contra el que subirla, y el orden inverso es justo el que
    // dejaba archivos huérfanos en Storage bajo un id inventado. Si la foto
    // falla, el gasto ya está creado y eso no se deshace: se devuelve un
    // aviso y el admin la adjunta reabriéndolo.
    onGuardar: async (datosGasto, archivo) => {
      const gasto = await createGasto(datosGasto);
      let avisoFoto = null;
      if (archivo) {
        try {
          await uploadFotoGasto(gasto.id, archivo);
        } catch {
          avisoFoto = "Gasto guardado, pero no se pudo adjuntar la foto. Ábrelo y súbela de nuevo.";
        }
      }
      // Una sola recarga, y al final: así la lista ya muestra la foto.
      renderActiveTab();
      return { gasto, avisoFoto };
    },
    onActualizar: async (id, datosGasto) => { await updateGasto(id, datosGasto); renderActiveTab(); },
    onEliminar: async (id) => { await deleteGasto(id); renderActiveTab(); },
  });

  function renderActiveTab() {
    if (!tabContentEl) return;
    if (activeTabId === "ingresos") {
      renderIngresosTab(tabContentEl);
    } else if (activeTabId === "gastos") {
      renderGastosTab(tabContentEl, {
        onAñadirGasto: () => gastoDrawer.open(),
        onAbrirGasto: (gasto) => gastoDrawer.open(gasto),
      });
    } else if (activeTabId === "resumen") {
      renderResumenTab(tabContentEl);
    } else if (activeTabId === "fiscal") {
      // Pasa el fiscalInfo cacheado para evitar un segundo fetch dentro de
      // fiscalTab.js (ya se obtuvo al construir las pestañas).
      renderFiscalTab(tabContentEl, fiscalInfo);
    }
  }

  async function render(container) {
    container.innerHTML = "";

    const head = document.createElement("div");
    head.className = "ac-body-head";
    const title = document.createElement("h1");
    title.className = "ac-title";
    title.textContent = "Finanzas";
    head.appendChild(title);
    container.appendChild(head);

    // Obtener tipo de tenant (para saber si Fiscal aplica) y régimen fiscal
    // (para pasárselo al fiscalTab sin segundo fetch). Se cachea en fiscalInfo.
    if (!fiscalInfo) {
      try { fiscalInfo = await fetchRegimenFiscal(); } catch { fiscalInfo = null; }
    }

    const esAcademia = fiscalInfo?.tenant_type === "academia";
    const tabs = esAcademia ? TABS_BASE : TABS_BASE.filter((t) => t.id !== "fiscal");

    // Si la pestaña activa era "fiscal" y ya no aplica, redirigir a ingresos.
    if (activeTabId === "fiscal" && !esAcademia) activeTabId = "ingresos";

    const tabsCtl = buildTabs(tabs, activeTabId, (tabId) => {
      activeTabId = tabId;
      tabsCtl.setActive(tabId);
      renderActiveTab();
    });
    container.appendChild(tabsCtl.wrap);

    tabContentEl = document.createElement("div");
    container.appendChild(tabContentEl);
    renderActiveTab();
  }

  return { render };
}
