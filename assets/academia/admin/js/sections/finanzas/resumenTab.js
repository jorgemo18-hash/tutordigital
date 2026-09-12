import { MESES } from "./calculos.js";
import { aniosDisponibles } from "../../aniosDisponibles.js";
import { buildBarChart } from "./barChart.js";
import { buildModoPeriodoSelector } from "./periodo/modoPeriodoSelector.js";
import { buildTrimestreSelector, trimestreActual } from "./periodo/trimestreSelector.js";
import { fetchResumenMensual, fetchResumenFiscal } from "../../apiFinanzas.js";

const MODOS_PERIODO = [
  { id: "anio", label: "Año" },
  { id: "trimestre", label: "Trimestre" },
  { id: "mes", label: "Mes" },
];

// Se ha quedado fuera del arreglo anterior de los selectores de año: este
// tenía su propio `for (a = anioActual - 4; ...)`, así que Resumen ofrecía
// cinco años y Gastos otros — dos listas distintas para la misma
// contabilidad, en pestañas contiguas.
function buildSelectAnio(anioSeleccionado) {
  const select = document.createElement("select");
  select.className = "ac-select";
  select.style.width = "100px";
  for (const a of aniosDisponibles()) {
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
  // "Cobrado" y no "Ingresos": el gráfico pinta el mismo criterio que la
  // tabla de abajo (ver buildFiscalTable), y llamarlo distinto en la misma
  // pestaña es pedir que se confundan.
  for (const [color, label] of [["#c4834a", "Cobrado"], ["rgba(242,237,229,0.35)", "Gastos"]]) {
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

// "INGRESOS COBRADOS", no "Ingresos", y con lo facturado al lado.
//
// EL PROBLEMA (12/09/2026): la cifra sale de los recibos en estado "pagado"
// —criterio de caja, provisional hasta que conteste el gestor (A4)— y la
// etiqueta no lo decía. Con 0 cobrados y 2.388 € emitidos, esta tabla ponía
// "Ingresos: 0,00 €" en septiembre. Eso se lee como "no he ganado nada este
// año", y de esa misma cifra sale la casilla [01] del Modelo 130.
//
// LAS DOS CIFRAS, NUNCA SUMADAS: la de arriba es la que entra en el cálculo;
// la nota de debajo es la que hace que se entienda. Va como nota y no como
// fila propia a propósito — una fila más en una tabla fiscal se lee como un
// sumando.
function buildFiscalTable(fiscal) {
  const wrap = document.createElement("div");
  wrap.className = "ac-table-wrap";
  const table = document.createElement("table");
  table.className = "ac-table";

  const pendiente = Number(fiscal.pendiente_de_cobro || 0);
  const rows = [
    [
      "Ingresos cobrados", `${fiscal.ingresos.toFixed(2)} €`,
      pendiente > 0
        ? `Emitido en el período: ${Number(fiscal.facturado || 0).toFixed(2)} € · sin cobrar todavía: ${pendiente.toFixed(2)} €`
        : "",
    ],
    [
      "Gastos deducibles", `${fiscal.gastos_deducibles.toFixed(2)} €`,
      // Cero gastos registrados casi nunca significa cero gastos: significa
      // que aún no se han metido, y entonces el rendimiento neto de abajo
      // sale inflado. Decirlo aquí es más barato que descubrirlo al
      // presentar.
      fiscal.gastos_registrados === 0 ? "Sin ningún gasto registrado en este período" : "",
    ],
    ["Rendimiento neto", `${fiscal.rendimiento_neto.toFixed(2)} €`, ""],
    ["Pago fraccionado IRPF 20% (Modelo 130)", `${fiscal.pago_fraccionado.toFixed(2)} €`, ""],
  ];

  const tbody = document.createElement("tbody");
  for (const [label, value, nota] of rows) {
    const tr = document.createElement("tr");
    // Nodos en vez de innerHTML: aquí ya no hay solo literales y no se va a
    // dejar una interpolación sin escapar en la tabla del IRPF.
    const tdLabel = document.createElement("td");
    tdLabel.appendChild(document.createTextNode(label));
    if (nota) {
      const small = document.createElement("div");
      small.className = "ac-table-nota";
      small.textContent = nota;
      tdLabel.appendChild(small);
    }
    const tdValor = document.createElement("td");
    tdValor.style.textAlign = "right";
    tdValor.textContent = value;
    tr.append(tdLabel, tdValor);
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
