import { MESES } from "./mockData.js";

function buildStatCard(label, value, { copper = false } = {}) {
  const card = document.createElement("div");
  card.className = "ac-stat-card";
  const lbl = document.createElement("div");
  lbl.className = "ac-stat-label";
  lbl.textContent = label;
  const val = document.createElement("div");
  val.className = copper ? "ac-stat-value copper" : "ac-stat-value";
  val.textContent = value;
  card.append(lbl, val);
  return card;
}

function buildStats(data) {
  const cobrado = data.recibosDelMes.filter((r) => r.estado === "pagado").reduce((s, r) => s + r.importe, 0);
  const pendiente = data.recibosDelMes.filter((r) => r.estado === "pendiente").reduce((s, r) => s + r.importe, 0);
  const alDia = data.recibosDelMes.filter((r) => r.estado === "pagado").length;
  const totalCurso = data.cobros.reduce((s, c) => s + c.importe * c.meses.filter(Boolean).length, 0);

  const row = document.createElement("div");
  row.className = "ac-stats-row";
  row.append(
    buildStatCard("Cobrado este mes", `${cobrado.toFixed(2)} €`, { copper: true }),
    buildStatCard("Familias al día", `${alDia} / ${data.recibosDelMes.length}`),
    buildStatCard("Pendiente", `${pendiente.toFixed(2)} €`),
    buildStatCard("Total curso", `${totalCurso.toFixed(2)} €`)
  );
  return row;
}

function buildCobrosTable(cobros) {
  const wrap = document.createElement("div");
  wrap.className = "ac-table-wrap";
  const table = document.createElement("table");
  table.className = "ac-table";

  const thead = document.createElement("thead");
  const trHead = document.createElement("tr");
  trHead.innerHTML = "<th>Familia</th><th>Alumno</th><th>Cuota</th>";
  for (const mes of MESES.slice(0, cobros[0]?.meses.length || 6)) {
    const th = document.createElement("th");
    th.textContent = mes;
    trHead.appendChild(th);
  }
  thead.appendChild(trHead);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const cobro of cobros) {
    const tr = document.createElement("tr");
    const tdFamilia = document.createElement("td");
    tdFamilia.textContent = cobro.familia;
    const tdAlumno = document.createElement("td");
    tdAlumno.textContent = cobro.alumno;
    const tdImporte = document.createElement("td");
    tdImporte.textContent = `${cobro.importe.toFixed(2)} €`;
    tr.append(tdFamilia, tdAlumno, tdImporte);
    cobro.meses.forEach((pagado, i) => {
      const td = document.createElement("td");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = pagado;
      checkbox.addEventListener("change", () => { cobro.meses[i] = checkbox.checked; });
      td.appendChild(checkbox);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
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

function buildRecibosTable(recibos) {
  const wrap = document.createElement("div");
  wrap.className = "ac-table-wrap";
  const table = document.createElement("table");
  table.className = "ac-table";
  table.innerHTML = "<thead><tr><th>Familia</th><th>Alumno</th><th>Importe</th><th>Fecha</th><th>Estado</th></tr></thead>";
  const tbody = document.createElement("tbody");
  for (const recibo of recibos) {
    const tr = document.createElement("tr");
    const estadoTag = document.createElement("span");
    estadoTag.className = `ac-lv ${recibo.estado === "pagado" ? "bach" : "pendiente"}`;
    estadoTag.textContent = recibo.estado === "pagado" ? "PAGADO" : "PENDIENTE";
    tr.innerHTML = `<td>${recibo.familia}</td><td>${recibo.alumno}</td><td>${recibo.importe.toFixed(2)} €</td><td>${recibo.fecha}</td>`;
    const tdEstado = document.createElement("td");
    tdEstado.appendChild(estadoTag);
    tr.appendChild(tdEstado);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

export function renderIngresosTab(container, data) {
  container.innerHTML = "";
  container.appendChild(buildStats(data));

  const tituloCobros = document.createElement("h3");
  tituloCobros.className = "ac-section-title";
  tituloCobros.textContent = "COBROS MENSUALES POR FAMILIA";
  tituloCobros.style.marginBottom = "10px";
  container.appendChild(buildPanelBlock([tituloCobros, buildCobrosTable(data.cobros)]));

  const tituloRecibos = document.createElement("h3");
  tituloRecibos.className = "ac-section-title";
  tituloRecibos.textContent = "RECIBOS DEL MES";
  tituloRecibos.style.marginBottom = "10px";
  container.appendChild(buildPanelBlock([tituloRecibos, buildRecibosTable(data.recibosDelMes)]));
}
