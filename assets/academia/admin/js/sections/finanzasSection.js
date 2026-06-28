import { createGasto, updateGasto, deleteGasto } from "../apiFinanzas.js";
import { renderIngresosTab } from "./finanzas/ingresosTab.js";
import { renderGastosTab } from "./finanzas/gastosTab.js";
import { renderResumenTab } from "./finanzas/resumenTab.js";
import { createGastoDrawer } from "./finanzas/gastoDrawer.js";

const TABS = [
  { id: "ingresos", label: "Ingresos" },
  { id: "gastos", label: "Gastos" },
  { id: "resumen", label: "Resumen" },
];

function buildTabs(activeId, onSelect) {
  const wrap = document.createElement("div");
  wrap.className = "ac-list-tabs";
  wrap.style.marginBottom = "18px";
  const buttons = new Map();
  for (const tab of TABS) {
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

// El drawer se crea una sola vez, igual que en alumnosSection.js. Guardar
// un gasto llama de verdad al backend (createGasto) y, si sale bien,
// vuelve a renderizar la pestaña activa para que se vean los datos
// nuevos — el drawer no sabe nada de cómo se recargan las pestañas.
export function createFinanzasSection() {
  let activeTabId = "ingresos";
  let tabContentEl = null;

  const gastoDrawer = createGastoDrawer(document.body, {
    onGuardar: async (datosGasto) => {
      await createGasto(datosGasto);
      renderActiveTab();
    },
    onActualizar: async (id, datosGasto) => {
      await updateGasto(id, datosGasto);
      renderActiveTab();
    },
    onEliminar: async (id) => {
      await deleteGasto(id);
      renderActiveTab();
    },
  });

  function renderActiveTab() {
    if (!tabContentEl) return;
    if (activeTabId === "ingresos") renderIngresosTab(tabContentEl);
    else if (activeTabId === "gastos") {
      renderGastosTab(tabContentEl, {
        onAñadirGasto: () => gastoDrawer.open(),
        onAbrirGasto: (gasto) => gastoDrawer.open(gasto),
      });
    } else {
      renderResumenTab(tabContentEl);
    }
  }

  function render(container) {
    container.innerHTML = "";

    const head = document.createElement("div");
    head.className = "ac-body-head";
    const title = document.createElement("h1");
    title.className = "ac-title";
    title.textContent = "Finanzas";
    head.appendChild(title);
    container.appendChild(head);

    const tabsCtl = buildTabs(activeTabId, (tabId) => {
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
