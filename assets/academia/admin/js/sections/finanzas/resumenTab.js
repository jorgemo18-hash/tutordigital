import { MESES } from "./calculos.js";
import { buildBarChart } from "./barChart.js";
import { buildModoPeriodoSelector } from "./periodo/modoPeriodoSelector.js";
import { buildTrimestreSelector, trimestreActual } from "./periodo/trimestreSelector.js";
import { fetchResumenMensual, fetchResumenFiscal } from "../../apiFinanzas.js";

const MODOS_PERIODO = [
  { id: "anio", label: "Año" },
  { id: "trimestre", label: "Trimestre" },
  { id: "mes", label: "Mes" },
];

function buildSelectAnio(anioSeleccionado) {
  const anioActual = new Date().getFullYear();
  const select = document.createElement("select");
  select.className = "ac-select";
  select.style.width = "100px";
  for (let a = anioActual - 4; a <= anioActual; a += 1) {
    const opt = document.createElement("option");
    opt.value = String(a);
    opt.textContent = String(a);
    opt.selected = a === anioSeleccionado;
    select.appendChild(opt);
  }
  return select;
}

function buildSelectMes(mesSeleccionado) {
  const select = document.createElement("select");
  select.className = "ac-select";
  MESES.forEach((label, i) => {
    const opt = document.createElement("option");
    opt.value = String(i + 1);
    opt.textContent = label;
    opt.selected = i + 1 === mesSeleccionado;
    select.appendChild(opt);
  });
  return select;
}

// Índices (0-based) de MESES/meses correspondientes a un trimestre — para
// recortar el gráfico anual a los 3 meses del trimestre elegido.
function indicesDelTrimestre(trimestre) {
  const inicio = (trimestre - 1) * 3;
  return [inicio, inicio + 1, inicio + 2];
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
  let modo = "anio";
  let mes = new Date().getMonth() + 1;
  let trimestre = trimestreActual().trimestre;

  async function cargar() {
    container.innerHTML = "";
    const cargando = document.createElement("p");
    cargando.className = "ac-loading";
    cargando.textContent = "Cargando…";
    container.appendChild(cargando);

    let meses, fiscal;
    try {
      const periodo = modo === "mes" ? { mes } : modo === "trimestre" ? { trimestre } : {};
      [meses, fiscal] = await Promise.all([fetchResumenMensual(anio), fetchResumenFiscal(anio, periodo)]);
    } catch (err) {
      container.innerHTML = "";
      const p = document.createElement("p");
      p.className = "ac-error";
      p.textContent = err.message || "No se pudo cargar el resumen.";
      container.appendChild(p);
      return;
    }

    container.innerHTML = "";

    const modoWrap = document.createElement("div");
    modoWrap.style.marginBottom = "12px";
    modoWrap.appendChild(
      buildModoPeriodoSelector(MODOS_PERIODO, modo, (nuevoModo) => {
        modo = nuevoModo;
        cargar();
      })
    );
    container.appendChild(modoWrap);

    const selectorWrap = document.createElement("div");
    selectorWrap.style.marginBottom = "18px";
    selectorWrap.style.display = "flex";
    selectorWrap.style.gap = "10px";

    if (modo === "trimestre") {
      selectorWrap.appendChild(
        buildTrimestreSelector({
          anio, trimestre, anioActualSistema: new Date().getFullYear(),
          onChange: (periodo) => { anio = periodo.anio; trimestre = periodo.trimestre; cargar(); },
        })
      );
    } else {
      const selectAnio = buildSelectAnio(anio);
      selectAnio.addEventListener("change", () => { anio = Number(selectAnio.value); cargar(); });
      selectorWrap.appendChild(selectAnio);

      if (modo === "mes") {
        const selectMes = buildSelectMes(mes);
        selectMes.addEventListener("change", () => { mes = Number(selectMes.value); cargar(); });
        selectorWrap.appendChild(selectMes);
      }
    }
    container.appendChild(selectorWrap);

    const mesesGrafico =
      modo === "mes" ? [meses[mes - 1]]
      : modo === "trimestre" ? indicesDelTrimestre(trimestre).map((i) => meses[i])
      : meses;
    const labelsGrafico =
      modo === "mes" ? [MESES[mes - 1]]
      : modo === "trimestre" ? indicesDelTrimestre(trimestre).map((i) => MESES[i])
      : MESES;

    const titulo = document.createElement("h3");
    titulo.className = "ac-section-title";
    titulo.textContent = "INGRESOS VS GASTOS";
    titulo.style.marginBottom = "10px";
    const chart = buildBarChart({
      labels: labelsGrafico,
      series: [
        { color: "#c4834a", values: mesesGrafico.map((m) => m.ingresos) },
        { color: "rgba(242,237,229,0.35)", values: mesesGrafico.map((m) => m.gastos) },
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
