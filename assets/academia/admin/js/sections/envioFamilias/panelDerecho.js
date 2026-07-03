import { buildTabInforme } from "./tabInforme.js";
import { buildTabRecibo } from "./tabRecibo.js";

const TABS = [
  { id: "informe", label: "Informe" },
  { id: "recibo", label: "Recibo" },
];

function buildTabButton(tab, activa, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `ac-tab${activa ? " active" : ""}`;
  btn.textContent = tab.label;
  btn.addEventListener("click", () => onClick(tab.id));
  return btn;
}

// Panel derecho de la familia seleccionada: dos tabs (Informe/Recibo,
// mismo patrón .ac-tabs que Ajustes) sobre un cuerpo que se reconstruye al
// cambiar de tab o de familia. Instancia única reutilizada entre
// selecciones (igual que el drawer del diario en el panel profesor) para
// no perder el estado de las tabs al refrescar la lista de la izquierda.
export function buildPanelDerecho() {
  const wrap = document.createElement("div");

  const tabsWrap = document.createElement("div");
  tabsWrap.className = "ac-tabs ef-tabs";

  const body = document.createElement("div");

  let tabActiva = "informe";
  let itemActual = null;
  let ctxActual = null;

  function renderTabs() {
    tabsWrap.innerHTML = "";
    for (const tab of TABS) tabsWrap.appendChild(buildTabButton(tab, tab.id === tabActiva, cambiarTab));
  }

  function renderBody() {
    body.innerHTML = "";
    if (!itemActual) return;
    if (tabActiva === "informe") body.appendChild(buildTabInforme(itemActual, ctxActual));
    else body.appendChild(buildTabRecibo(itemActual, ctxActual));
  }

  function cambiarTab(tabId) {
    tabActiva = tabId;
    renderTabs();
    renderBody();
  }

  function mostrar(item, ctx) {
    itemActual = item;
    ctxActual = ctx;
    tabActiva = "informe";
    tabsWrap.classList.remove("hidden");
    renderTabs();
    renderBody();
  }

  function limpiar(mensajeEl) {
    itemActual = null;
    tabsWrap.classList.add("hidden");
    body.innerHTML = "";
    if (mensajeEl) body.appendChild(mensajeEl);
  }

  renderTabs();
  tabsWrap.classList.add("hidden");
  wrap.append(tabsWrap, body);
  return { wrap, mostrar, limpiar };
}
