import { fetchHistorialIngresos } from "../../../apiFinanzas.js";
import { MESES } from "../calculos.js";

const ESTADO_LABEL = { pagado: "PAGADO", enviado: "ENVIADO", borrador: "BORRADOR" };

function capitaliza(str) {
  return str ? str[0].toUpperCase() + str.slice(1) : str;
}

function buildHistorialTable(recibos) {
  const wrap = document.createElement("div");
  wrap.className = "ac-table-wrap";
  const table = document.createElement("table");
  table.className = "ac-table";
  table.innerHTML = "<thead><tr><th>Período</th><th>Familia</th><th>Importe</th><th>Fecha pago</th><th>Estado</th></tr></thead>";
  const tbody = document.createElement("tbody");
  for (const recibo of recibos) {
    const tr = document.createElement("tr");
    const tdPeriodo = document.createElement("td");
    tdPeriodo.textContent = `${capitaliza(MESES[recibo.mes - 1])} ${recibo.anio}`;
    const tdFamilia = document.createElement("td");
    tdFamilia.textContent = recibo.familia_nombre;
    const tdImporte = document.createElement("td");
    tdImporte.textContent = `${recibo.importe.toFixed(2)} €`;
    const tdFecha = document.createElement("td");
    tdFecha.textContent = recibo.fecha_pago ? new Date(recibo.fecha_pago).toLocaleDateString("es-ES") : "—";
    const tdEstado = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `ac-estado-badge ${recibo.estado}`;
    badge.textContent = ESTADO_LABEL[recibo.estado] || recibo.estado.toUpperCase();
    tdEstado.appendChild(badge);
    tr.append(tdPeriodo, tdFamilia, tdImporte, tdFecha, tdEstado);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

// Todos los recibos ya enviados o pagados, de cualquier mes/año — a
// diferencia de "Vista general" (que solo mira el período seleccionado),
// esta vista no tiene selector de período.
export function renderVistaHistorial(container) {
  container.innerHTML = "";
  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando…";
  container.appendChild(cargando);

  fetchHistorialIngresos()
    .then((recibos) => {
      container.innerHTML = "";
      if (!recibos.length) {
        const empty = document.createElement("p");
        empty.className = "ac-empty";
        empty.textContent = "Todavía no se ha enviado ningún recibo.";
        container.appendChild(empty);
        return;
      }
      const panel = document.createElement("div");
      panel.className = "ac-panel";
      panel.appendChild(buildHistorialTable(recibos));
      container.appendChild(panel);
    })
    .catch((err) => {
      container.innerHTML = "";
      const p = document.createElement("p");
      p.className = "ac-error";
      p.textContent = err.message || "No se pudo cargar el historial.";
      container.appendChild(p);
    });
}
