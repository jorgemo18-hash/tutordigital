import { buildIcon } from "../../icons.js";
import { buildPeriodoSelector } from "../envioFamilias/periodoSelector.js";
import { fetchResumenGastos, fetchListaGastos, fetchCategoriasGastos } from "../../apiFinanzas.js";

function periodoActual() {
  const hoy = new Date();
  return { mes: hoy.getMonth() + 1, anio: hoy.getFullYear() };
}

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

function buildStats(resumen) {
  const row = document.createElement("div");
  row.className = "ac-stats-row";
  row.append(
    buildStatCard("Total", `${resumen.total.toFixed(2)} €`),
    buildStatCard("IVA soportado", `${resumen.iva_soportado.toFixed(2)} €`),
    buildStatCard("Ticket medio", `${resumen.ticket_medio.toFixed(2)} €`)
  );
  return row;
}

function buildRepartoCategoria(categorias) {
  const wrap = document.createElement("div");
  wrap.style.marginBottom = "18px";
  const max = Math.max(1, ...categorias.map((c) => c.total));

  for (const { categoria, total } of categorias) {
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
    bar.style.width = `${Math.round((total / max) * 100)}%`;
    barTrack.appendChild(bar);

    const valueLabel = document.createElement("span");
    valueLabel.style.fontSize = "12px";
    valueLabel.style.width = "80px";
    valueLabel.style.textAlign = "right";
    valueLabel.textContent = `${total.toFixed(2)} €`;

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

// Las filas son clicables (abren el drawer en modo detalle/edición vía
// `onAbrirGasto`) — el cursor pointer es la única señal visual de eso, no
// hay icono ni hover dedicado todavía.
function buildGastosTable(gastos, onAbrirGasto) {
  const wrap = document.createElement("div");
  wrap.className = "ac-table-wrap";
  const table = document.createElement("table");
  table.className = "ac-table";
  table.innerHTML = "<thead><tr><th>Fecha</th><th>Proveedor</th><th>Concepto</th><th>Categoría</th><th>Base</th><th>IVA</th><th>Total</th></tr></thead>";
  const tbody = document.createElement("tbody");
  for (const gasto of gastos) {
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    const base = Number(gasto.base_imponible || 0);
    tr.innerHTML = `<td>${gasto.fecha}</td><td>${gasto.proveedor || "—"}</td><td>${gasto.concepto}</td><td>${gasto.categoria || "—"}</td><td>${base.toFixed(2)} €</td><td>${gasto.iva_pct || 0}%</td><td>${Number(gasto.importe).toFixed(2)} €</td>`;
    tr.addEventListener("click", () => onAbrirGasto(gasto));
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

// Pestaña Gastos conectada a datos reales (antes: mock en memoria).
// `onAñadirGasto`/`onAbrirGasto` abren el drawer — quien lo crea
// (finanzasSection.js) ya sabe refrescar la pestaña activa tras guardar,
// así que esta función no necesita saber nada de eso.
export function renderGastosTab(container, { onAñadirGasto, onAbrirGasto }) {
  let { mes, anio } = periodoActual();

  async function cargar() {
    container.innerHTML = "";
    const cargando = document.createElement("p");
    cargando.className = "ac-loading";
    cargando.textContent = "Cargando…";
    container.appendChild(cargando);

    let resumen, categorias, gastos;
    try {
      [resumen, categorias, gastos] = await Promise.all([
        fetchResumenGastos({ mes, anio }),
        fetchCategoriasGastos({ mes, anio }),
        fetchListaGastos({ mes, anio }),
      ]);
    } catch (err) {
      container.innerHTML = "";
      const p = document.createElement("p");
      p.className = "ac-error";
      p.textContent = err.message || "No se pudieron cargar los gastos.";
      container.appendChild(p);
      return;
    }

    container.innerHTML = "";
    const selectorWrap = document.createElement("div");
    selectorWrap.style.marginBottom = "18px";
    selectorWrap.appendChild(
      buildPeriodoSelector({
        mes, anio, anioActualSistema: periodoActual().anio,
        onChange: (periodo) => { mes = periodo.mes; anio = periodo.anio; cargar(); },
      })
    );
    container.appendChild(selectorWrap);

    container.appendChild(buildStats(resumen));

    const head = document.createElement("div");
    head.className = "ac-section-head";
    const titulo = document.createElement("h3");
    titulo.className = "ac-section-title";
    titulo.textContent = "REPARTO POR CATEGORÍA";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "ac-btn primary sm";
    addBtn.append(buildIcon("plus", { size: 13 }), document.createTextNode(" Añadir gasto"));
    addBtn.addEventListener("click", () => onAñadirGasto());
    head.append(titulo, addBtn);

    container.appendChild(buildPanelBlock([head, buildRepartoCategoria(categorias)]));
    container.appendChild(buildPanelBlock([buildGastosTable(gastos, onAbrirGasto)]));
  }

  cargar();
}
