import { fetchHistorialRecibos } from "../api.js";

const MESES = [
  null, "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatFecha(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function buildFila(item) {
  const row = document.createElement("div");
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

  return row;
}

function renderHistorial(body, historial) {
  body.innerHTML = "";
  if (!historial.length) {
    const p = document.createElement("p");
    p.className = "ac-empty";
    p.textContent = "Sin recibos todavía.";
    body.appendChild(p);
    return;
  }
  const lista = document.createElement("div");
  lista.className = "ac-historial-lista";
  for (const item of historial) lista.appendChild(buildFila(item));
  body.appendChild(lista);
}

// Sección "Historial de recibos" del drawer de alumno — solo aplica en modo
// editar (un alumno nuevo no puede tener recibos todavía, ver alumnoDrawer.js).
export function buildHistorialRecibosSection({ alumnoId, fetchHistorialFn = fetchHistorialRecibos }) {
  const wrap = document.createElement("div");
  const title = document.createElement("div");
  title.className = "ac-section-title";
  title.textContent = "HISTORIAL DE RECIBOS";
  wrap.appendChild(title);
  const spacer = document.createElement("div");
  spacer.style.height = "10px";
  wrap.appendChild(spacer);

  const body = document.createElement("div");
  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando historial…";
  body.appendChild(cargando);
  wrap.appendChild(body);

  fetchHistorialFn(alumnoId)
    .then((historial) => renderHistorial(body, historial))
    .catch((err) => {
      body.innerHTML = "";
      const p = document.createElement("p");
      p.className = "ac-error";
      p.textContent = err.message || "No se pudo cargar el historial.";
      body.appendChild(p);
    });

  return { wrap };
}
