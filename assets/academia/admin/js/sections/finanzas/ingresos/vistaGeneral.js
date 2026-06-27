import { buildPeriodoSelector } from "../../envioFamilias/periodoSelector.js";
import { fetchResumenIngresos, fetchGridIngresos, fetchRecibosDelMesFinanzas, marcarReciboPagado, marcarReciboPendiente } from "../../../apiFinanzas.js";
import { MESES } from "../calculos.js";

function periodoActual() {
  const hoy = new Date();
  return { mes: hoy.getMonth() + 1, anio: hoy.getFullYear() };
}

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

function buildStats(resumen) {
  const row = document.createElement("div");
  row.className = "ac-stats-row";
  row.append(
    buildStatCard("Cobrado este mes", `${resumen.cobrado_mes.toFixed(2)} €`, { copper: true }),
    buildStatCard("Familias al día", `${resumen.familias_al_dia} / ${resumen.total_familias}`),
    buildStatCard("Pendiente", `${resumen.pendiente.toFixed(2)} €`),
    buildStatCard("Total curso", `${resumen.total_curso.toFixed(2)} €`)
  );
  return row;
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

// Checkbox por celda: marcado = pagado, desmarcado = pendiente/enviado
// (clicable, alterna), sin recibo = deshabilitado y sin marcar. El click
// llama a marcar-pagado/pendiente sobre el recibo de ESA celda y refresca
// toda la vista (los importes de Pendiente/Cobrado cambian).
function buildCeldaMes(celda, onCambiado) {
  const td = document.createElement("td");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = celda.estado === "pagado";
  checkbox.disabled = !celda.recibo_id;
  checkbox.addEventListener("change", async () => {
    checkbox.disabled = true;
    try {
      if (checkbox.checked) await marcarReciboPagado(celda.recibo_id);
      else await marcarReciboPendiente(celda.recibo_id);
      await onCambiado();
    } catch (err) {
      checkbox.checked = !checkbox.checked;
      window.alert(err.message || "No se pudo actualizar el recibo.");
      checkbox.disabled = false;
    }
  });
  td.appendChild(checkbox);
  return td;
}

function buildGridTable(filas, onCambiado) {
  const wrap = document.createElement("div");
  wrap.className = "ac-table-wrap";
  const table = document.createElement("table");
  table.className = "ac-table";

  const thead = document.createElement("thead");
  const trHead = document.createElement("tr");
  trHead.innerHTML = "<th>Familia</th><th>Alumno</th><th>Cuota</th>";
  for (const c of filas[0]?.meses || []) {
    const th = document.createElement("th");
    th.textContent = MESES[c.mes - 1];
    trHead.appendChild(th);
  }
  thead.appendChild(trHead);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const fila of filas) {
    const tr = document.createElement("tr");
    const tdFamilia = document.createElement("td");
    tdFamilia.textContent = fila.familia_nombre;
    const tdAlumno = document.createElement("td");
    tdAlumno.textContent = fila.nombre_alumno;
    const tdCuota = document.createElement("td");
    tdCuota.textContent = `${fila.cuota.toFixed(2)} €`;
    tr.append(tdFamilia, tdAlumno, tdCuota);
    for (const celda of fila.meses) tr.appendChild(buildCeldaMes(celda, onCambiado));
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

const ESTADO_LABEL = { pagado: "PAGADO", enviado: "ENVIADO", borrador: "BORRADOR" };

function buildRecibosTable(recibos) {
  const wrap = document.createElement("div");
  wrap.className = "ac-table-wrap";
  const table = document.createElement("table");
  table.className = "ac-table";
  table.innerHTML = "<thead><tr><th>Familia</th><th>Importe</th><th>Fecha envío</th><th>Estado</th></tr></thead>";
  const tbody = document.createElement("tbody");
  for (const recibo of recibos) {
    const tr = document.createElement("tr");
    const tdFamilia = document.createElement("td");
    tdFamilia.textContent = recibo.familia_nombre;
    const tdImporte = document.createElement("td");
    tdImporte.textContent = `${recibo.importe.toFixed(2)} €`;
    const tdFecha = document.createElement("td");
    tdFecha.textContent = recibo.fecha_envio ? new Date(recibo.fecha_envio).toLocaleDateString("es-ES") : "—";
    const tdEstado = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `ac-estado-badge ${recibo.estado}`;
    badge.textContent = ESTADO_LABEL[recibo.estado] || recibo.estado.toUpperCase();
    tdEstado.appendChild(badge);
    tr.append(tdFamilia, tdImporte, tdFecha, tdEstado);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

// Vista general de Ingresos — KPIs + selector de período + grid de cobros
// por alumno + recibos del mes, todo conectado a datos reales. Mantiene su
// propio estado de período (se reinicia al mes actual si se vuelve a
// montar, igual que el resto de pestañas de Finanzas).
export function renderVistaGeneral(container) {
  let { mes, anio } = periodoActual();

  async function cargar() {
    container.innerHTML = "";
    const cargando = document.createElement("p");
    cargando.className = "ac-loading";
    cargando.textContent = "Cargando…";
    container.appendChild(cargando);

    let resumen, filas, recibos;
    try {
      [resumen, filas, recibos] = await Promise.all([
        fetchResumenIngresos({ mes, anio }),
        fetchGridIngresos({ mes, anio }),
        fetchRecibosDelMesFinanzas({ mes, anio }),
      ]);
    } catch (err) {
      container.innerHTML = "";
      const p = document.createElement("p");
      p.className = "ac-error";
      p.textContent = err.message || "No se pudieron cargar los ingresos.";
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

    const tituloCobros = document.createElement("h3");
    tituloCobros.className = "ac-section-title";
    tituloCobros.textContent = "COBROS MENSUALES POR ALUMNO";
    tituloCobros.style.marginBottom = "10px";
    container.appendChild(buildPanelBlock([tituloCobros, buildGridTable(filas, cargar)]));

    const tituloRecibos = document.createElement("h3");
    tituloRecibos.className = "ac-section-title";
    tituloRecibos.textContent = "RECIBOS DEL MES";
    tituloRecibos.style.marginBottom = "10px";
    container.appendChild(buildPanelBlock([tituloRecibos, buildRecibosTable(recibos)]));
  }

  cargar();
}
