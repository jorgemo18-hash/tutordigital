import { MESES } from "./calculos.js";
import { buildBarChart } from "./barChart.js";
import { fetchResumenMensual, fetchResumenFiscal } from "../../apiFinanzas.js";

function buildSelectAnio(anioSeleccionado) {
  const select = document.createElement("select");
  select.className = "ac-select";
  select.style.width = "100px";
  for (let a = 2024; a <= anioSeleccionado + 2; a += 1) {
    const opt = document.createElement("option");
    opt.value = String(a);
    opt.textContent = String(a);
    opt.selected = a === anioSeleccionado;
    select.appendChild(opt);
  }
  return select;
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

function buildFiscalTable(fiscal) {
  const wrap = document.createElement("div");
  wrap.className = "ac-table-wrap";
  const table = document.createElement("table");
  table.className = "ac-table";
  const rows = [
    ["Ingresos", `${fiscal.ingresos.toFixed(2)} €`],
    ["Gastos deducibles", `${fiscal.gastos_deducibles.toFixed(2)} €`],
    ["Rendimiento neto", `${fiscal.rendimiento_neto.toFixed(2)} €`],
    ["Pago fraccionado IRPF 20% (Modelo 130)", `${fiscal.pago_fraccionado.toFixed(2)} €`],
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

// Pestaña Resumen conectada a datos reales (antes: mock en memoria). Año
// fiscal/calendario (ene-dic) — distinto del curso académico que usa
// Ingresos, ver academiaFinanzas/resumenConsultas.js en el backend.
export function renderResumenTab(container) {
  let anio = new Date().getFullYear();

  async function cargar() {
    container.innerHTML = "";
    const cargando = document.createElement("p");
    cargando.className = "ac-loading";
    cargando.textContent = "Cargando…";
    container.appendChild(cargando);

    let meses, fiscal;
    try {
      [meses, fiscal] = await Promise.all([fetchResumenMensual(anio), fetchResumenFiscal(anio)]);
    } catch (err) {
      container.innerHTML = "";
      const p = document.createElement("p");
      p.className = "ac-error";
      p.textContent = err.message || "No se pudo cargar el resumen.";
      container.appendChild(p);
      return;
    }

    container.innerHTML = "";
    const selectorWrap = document.createElement("div");
    selectorWrap.style.marginBottom = "18px";
    const selectAnio = buildSelectAnio(anio);
    selectAnio.addEventListener("change", () => { anio = Number(selectAnio.value); cargar(); });
    selectorWrap.appendChild(selectAnio);
    container.appendChild(selectorWrap);

    const titulo = document.createElement("h3");
    titulo.className = "ac-section-title";
    titulo.textContent = "INGRESOS VS GASTOS";
    titulo.style.marginBottom = "10px";
    const chart = buildBarChart({
      labels: MESES,
      series: [
        { color: "#c4834a", values: meses.map((m) => m.ingresos) },
        { color: "rgba(242,237,229,0.35)", values: meses.map((m) => m.gastos) },
      ],
    });
    container.appendChild(buildPanelBlock([titulo, buildLeyenda(), chart]));

    const tituloFiscal = document.createElement("h3");
    tituloFiscal.className = "ac-section-title";
    tituloFiscal.textContent = "RESUMEN FISCAL";
    tituloFiscal.style.marginBottom = "10px";
    container.appendChild(buildPanelBlock([tituloFiscal, buildFiscalTable(fiscal)]));
  }

  cargar();
}
