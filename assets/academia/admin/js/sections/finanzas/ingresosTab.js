import { renderVistaPendientes } from "./ingresos/vistaPendientes.js";
import { renderVistaHistorial } from "./ingresos/vistaHistorial.js";

const VISTAS = [
  { id: "pendientes", label: "Pendientes", render: renderVistaPendientes },
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

// Ingresos tiene dos vistas navegables: "Pendientes" (recibos del mes
// seleccionado, agrupados por método de pago de la familia — por
// defecto) e "Historial" (grid anual por alumno, curso académico sep-ago).
export function renderIngresosTab(container) {
  container.innerHTML = "";
  let activeVistaId = "pendientes";

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
