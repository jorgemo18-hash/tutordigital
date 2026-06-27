import { renderVistaGeneral } from "./ingresos/vistaGeneral.js";
import { renderVistaHistorial } from "./ingresos/vistaHistorial.js";

const VISTAS = [
  { id: "general", label: "Vista general", render: renderVistaGeneral },
  { id: "historial", label: "Historial", render: renderVistaHistorial },
];

function buildSubTabs(activeId, onSelect) {
  const wrap = document.createElement("div");
  wrap.className = "ac-list-tabs";
  wrap.style.marginBottom = "18px";
  const botones = new Map();
  for (const vista of VISTAS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ac-list-tab";
    btn.textContent = vista.label;
    btn.addEventListener("click", () => onSelect(vista.id));
    wrap.appendChild(btn);
    botones.set(vista.id, btn);
  }
  function setActive(vistaId) {
    for (const [id, btn] of botones) btn.classList.toggle("active", id === vistaId);
  }
  setActive(activeId);
  return { wrap, setActive };
}

// Ingresos tiene dos vistas navegables: "Vista general" (KPIs + cobros
// mensuales por alumno + recibos del mes, por defecto) e "Historial"
// (todos los recibos ya enviados/pagados, sin filtro de período).
export function renderIngresosTab(container) {
  container.innerHTML = "";
  let activeVistaId = "general";

  const vistaContentEl = document.createElement("div");

  function renderVistaActiva() {
    const vista = VISTAS.find((v) => v.id === activeVistaId);
    vista.render(vistaContentEl);
  }

  const tabsCtl = buildSubTabs(activeVistaId, (vistaId) => {
    activeVistaId = vistaId;
    tabsCtl.setActive(vistaId);
    renderVistaActiva();
  });
  container.appendChild(tabsCtl.wrap);
  container.appendChild(vistaContentEl);
  renderVistaActiva();
}
