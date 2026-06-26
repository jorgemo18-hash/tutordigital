const MESES = [
  null, "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatFecha(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function buildFila(item, onSeleccionar) {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "ac-historial-row";

  const periodo = document.createElement("span");
  periodo.className = "ac-historial-periodo";
  periodo.textContent = `${MESES[item.mes] || ""} ${item.anio}`;
  row.appendChild(periodo);

  const concepto = document.createElement("span");
  concepto.className = "ac-historial-concepto";
  concepto.textContent = item.concepto || "";
  row.appendChild(concepto);

  const importe = document.createElement("span");
  importe.className = "ac-historial-importe";
  importe.textContent = `${Number(item.total_neto || 0).toFixed(2)} €`;
  row.appendChild(importe);

  const estado = document.createElement("span");
  estado.className = `ac-lv ${item.estado === "enviado" ? "bach" : "pendiente"}`;
  estado.textContent = item.estado === "enviado" ? `ENVIADO ${formatFecha(item.fecha_envio)}` : "BORRADOR";
  row.appendChild(estado);

  row.addEventListener("click", () => onSeleccionar(item));
  return row;
}

// Lista de recibos históricos de un alumno — cada fila es clicable y abre
// la preview+acciones de ese recibo en el drawer (ver historialDrawer.js).
export function buildHistorialLista(historial, { onSeleccionar }) {
  const wrap = document.createElement("div");
  wrap.className = "ac-historial-lista";
  for (const item of historial) wrap.appendChild(buildFila(item, onSeleccionar));
  return wrap;
}
