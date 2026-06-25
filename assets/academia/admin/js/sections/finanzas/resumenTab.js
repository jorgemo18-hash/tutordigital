import { MESES, totalGasto } from "./mockData.js";
import { buildBarChart } from "./barChart.js";

function mesesConDatos(ingresosPorMes, gastosPorMes) {
  let n = 0;
  for (let i = 0; i < ingresosPorMes.length; i += 1) {
    if (ingresosPorMes[i] || gastosPorMes[i]) n = i + 1;
  }
  return Math.max(n, 1);
}

function buildLeyenda() {
  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.gap = "16px";
  wrap.style.marginBottom = "10px";
  for (const [color, label] of [["#c4834a", "Ingresos"], ["rgba(242,237,229,0.35)", "Gastos"]]) {
    const item = document.createElement("span");
    item.style.display = "inline-flex";
    item.style.alignItems = "center";
    item.style.gap = "6px";
    item.style.fontSize = "12px";
    const dot = document.createElement("span");
    dot.style.width = "8px";
    dot.style.height = "8px";
    dot.style.borderRadius = "2px";
    dot.style.background = color;
    item.append(dot, document.createTextNode(label));
    wrap.appendChild(item);
  }
  return wrap;
}

// Envuelve título+contenido en una tarjeta — sin esto el contenido queda
// directamente sobre la foto de fondo del panel.
function buildPanelBlock(hijos) {
  const panel = document.createElement("div");
  panel.className = "ac-panel";
  panel.style.marginBottom = "18px";
  panel.append(...hijos);
  return panel;
}

function buildFiscalTable({ ingresos, gastosDeducibles }) {
  const rendimientoNeto = ingresos - gastosDeducibles;
  const pagoFraccionado = Math.max(0, rendimientoNeto * 0.2);

  const wrap = document.createElement("div");
  wrap.className = "ac-table-wrap";
  const table = document.createElement("table");
  table.className = "ac-table";
  const rows = [
    ["Ingresos", `${ingresos.toFixed(2)} €`],
    ["Gastos deducibles", `${gastosDeducibles.toFixed(2)} €`],
    ["Rendimiento neto", `${rendimientoNeto.toFixed(2)} €`],
    ["Pago fraccionado IRPF 20% (Modelo 130)", `${pagoFraccionado.toFixed(2)} €`],
  ];
  const tbody = document.createElement("tbody");
  for (const [label, value] of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${label}</td><td style="text-align:right">${value}</td>`;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

export function renderResumenTab(container, data) {
  container.innerHTML = "";

  const n = mesesConDatos(data.ingresosPorMes, data.gastosPorMes);
  const labels = MESES.slice(0, n);
  const ingresos = data.ingresosPorMes.slice(0, n);
  const gastosTotalPorMes = data.gastosPorMes.slice(0, n);

  const titulo = document.createElement("h3");
  titulo.className = "ac-section-title";
  titulo.textContent = "INGRESOS VS GASTOS";
  titulo.style.marginBottom = "10px";
  const chart = buildBarChart({
    labels,
    series: [
      { color: "#c4834a", values: ingresos },
      { color: "rgba(242,237,229,0.35)", values: gastosTotalPorMes },
    ],
  });
  container.appendChild(buildPanelBlock([titulo, buildLeyenda(), chart]));

  const tituloFiscal = document.createElement("h3");
  tituloFiscal.className = "ac-section-title";
  tituloFiscal.textContent = "RESUMEN FISCAL";
  tituloFiscal.style.marginBottom = "10px";

  const ingresosTotales = ingresos.reduce((s, v) => s + v, 0);
  const gastosDeducibles = data.gastos.reduce((s, g) => s + totalGasto(g), 0);
  container.appendChild(
    buildPanelBlock([tituloFiscal, buildFiscalTable({ ingresos: ingresosTotales, gastosDeducibles })])
  );
}
