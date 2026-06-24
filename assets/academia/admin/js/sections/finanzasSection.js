import { buildMockFinanzas } from "./finanzas/mockData.js";
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

// El gasto se guarda en memoria (datos de ejemplo, sin backend todavía) y
// el drawer se crea una sola vez, igual que en alumnosSection.js.
export function createFinanzasSection() {
  const data = buildMockFinanzas();
  let activeTabId = "ingresos";
  let tabContentEl = null;

  const gastoDrawer = createGastoDrawer(document.body, {
    onGuardar: (gasto) => {
      data.gastos = [...data.gastos, gasto];
      renderActiveTab();
    },
  });

  function renderActiveTab() {
    if (!tabContentEl) return;
    if (activeTabId === "ingresos") renderIngresosTab(tabContentEl, data);
    else if (activeTabId === "gastos") {
      renderGastosTab(tabContentEl, data.gastos, { onAñadirGasto: () => gastoDrawer.open() });
    } else {
      renderResumenTab(tabContentEl, data);
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
