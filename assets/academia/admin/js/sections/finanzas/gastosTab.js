import { CATEGORIAS_GASTO, totalGasto } from "./mockData.js";
import { buildIcon } from "../../icons.js";

function buildStatCard(label, value) {
  const card = document.createElement("div");
  card.className = "ac-stat-card";
  const lbl = document.createElement("div");
  lbl.className = "ac-stat-label";
  lbl.textContent = label;
  const val = document.createElement("div");
  val.className = "ac-stat-value";
  val.textContent = value;
  card.append(lbl, val);
  return card;
}

function buildStats(gastos) {
  const totales = gastos.map(totalGasto);
  const total = totales.reduce((s, t) => s + t, 0);
  const ivaSoportado = gastos.reduce((s, g) => s + (g.baseImponible * g.ivaPct) / 100, 0);
  const ticketMedio = gastos.length ? total / gastos.length : 0;

  const row = document.createElement("div");
  row.className = "ac-stats-row";
  row.append(
    buildStatCard("Total", `${total.toFixed(2)} €`),
    buildStatCard("IVA soportado", `${ivaSoportado.toFixed(2)} €`),
    buildStatCard("Ticket medio", `${ticketMedio.toFixed(2)} €`)
  );
  return row;
}

function buildRepartoCategoria(gastos) {
  const wrap = document.createElement("div");
  wrap.style.marginBottom = "18px";
  const porCategoria = new Map(CATEGORIAS_GASTO.map((c) => [c, 0]));
  for (const gasto of gastos) {
    porCategoria.set(gasto.categoria, (porCategoria.get(gasto.categoria) || 0) + totalGasto(gasto));
  }
  const max = Math.max(1, ...porCategoria.values());

  for (const [categoria, importe] of porCategoria) {
    if (!importe) continue;
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "10px";
    row.style.marginBottom = "6px";

    const label = document.createElement("span");
    label.style.width = "110px";
    label.style.flexShrink = "0";
    label.style.fontSize = "12px";
    label.textContent = categoria;

    const barTrack = document.createElement("div");
    barTrack.style.flex = "1";
    barTrack.style.height = "10px";
    barTrack.style.borderRadius = "6px";
    barTrack.style.background = "rgba(242,237,229,0.08)";
    const bar = document.createElement("div");
    bar.style.height = "100%";
    bar.style.borderRadius = "6px";
    bar.style.background = "var(--copper, #c4834a)";
    bar.style.width = `${Math.round((importe / max) * 100)}%`;
    barTrack.appendChild(bar);

    const valueLabel = document.createElement("span");
    valueLabel.style.fontSize = "12px";
    valueLabel.style.width = "80px";
    valueLabel.style.textAlign = "right";
    valueLabel.textContent = `${importe.toFixed(2)} €`;

    row.append(label, barTrack, valueLabel);
    wrap.appendChild(row);
  }
  return wrap;
}

// Envuelve título+tabla en una tarjeta — sin esto el contenido queda
// directamente sobre la foto de fondo del panel.
function buildPanelBlock(hijos) {
  const panel = document.createElement("div");
  panel.className = "ac-panel";
  panel.style.marginBottom = "18px";
  panel.append(...hijos);
  return panel;
}

function buildGastosTable(gastos) {
  const wrap = document.createElement("div");
  wrap.className = "ac-table-wrap";
  const table = document.createElement("table");
  table.className = "ac-table";
  table.innerHTML = "<thead><tr><th>Fecha</th><th>Proveedor</th><th>Concepto</th><th>Categoría</th><th>Base</th><th>IVA</th><th>Total</th></tr></thead>";
  const tbody = document.createElement("tbody");
  for (const gasto of gastos) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${gasto.fecha}</td><td>${gasto.proveedor}</td><td>${gasto.concepto}</td><td>${gasto.categoria}</td><td>${gasto.baseImponible.toFixed(2)} €</td><td>${gasto.ivaPct}%</td><td>${totalGasto(gasto).toFixed(2)} €</td>`;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

export function renderGastosTab(container, gastos, { onAñadirGasto }) {
  container.innerHTML = "";
  container.appendChild(buildStats(gastos));

  const head = document.createElement("div");
  head.className = "ac-section-head";
  const titulo = document.createElement("h3");
  titulo.className = "ac-section-title";
  titulo.textContent = "REPARTO POR CATEGORÍA";
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "ac-btn primary sm";
  addBtn.append(buildIcon("plus", { size: 13 }), document.createTextNode(" Añadir gasto"));
  addBtn.addEventListener("click", onAñadirGasto);
  head.append(titulo, addBtn);

  container.appendChild(buildPanelBlock([head, buildRepartoCategoria(gastos)]));
  container.appendChild(buildPanelBlock([buildGastosTable(gastos)]));
}
