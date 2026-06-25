import { metodoPagoLabel } from "../../drawer/familia/familiaFields.js";

const MESES = [
  null, "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatEuros(n) {
  return `${Number(n || 0).toFixed(2)} €`;
}

function formatFecha(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function buildDatoCol(label, valor) {
  const col = document.createElement("div");
  const lab = document.createElement("div");
  lab.className = "ef-preview-label";
  lab.textContent = label;
  const val = document.createElement("div");
  val.className = "ef-preview-valor";
  val.textContent = valor || "—";
  col.append(lab, val);
  return col;
}

function buildLineaRow(linea) {
  const row = document.createElement("tr");
  const nombre = document.createElement("td");
  nombre.textContent = linea.nombre_alumno;
  const concepto = document.createElement("td");
  concepto.textContent = linea.descripcion || "";
  const importe = document.createElement("td");
  importe.className = "ef-preview-importe";
  importe.textContent = formatEuros(linea.precio_bruto);
  row.append(nombre, concepto, importe);
  return row;
}

function buildDescuentoRow(label, valor) {
  const row = document.createElement("div");
  row.className = "ef-preview-descuento-row";
  const lab = document.createElement("div");
  lab.textContent = label;
  const val = document.createElement("div");
  val.textContent = valor;
  row.append(lab, val);
  return row;
}

function buildDescuentosBlock(recibo) {
  if (!(Number(recibo.total_descuento) > 0)) return null;
  const wrap = document.createElement("div");
  const partes = [];
  if (Number(recibo.descuento_hermanos_pct) > 0) partes.push(`hermanos ${recibo.descuento_hermanos_pct}%`);
  if (Number(recibo.descuento_puntual_pct) > 0) partes.push(`puntual ${recibo.descuento_puntual_pct}%`);
  const etiqueta = partes.length ? `Descuento (${partes.join(" + ")})` : "Descuento";
  wrap.append(
    buildDescuentoRow("Subtotal", formatEuros(recibo.total_bruto)),
    buildDescuentoRow(etiqueta, `-${formatEuros(recibo.total_descuento)}`)
  );
  return wrap;
}

// Vista previa del recibo dentro del panel — mismo diseño que el email
// que recibe la familia (ver academiaReciboTemplate.js en el backend).
// `nombreAcademia`/`textoExencionIva` vienen de academia_config, pasados
// explícitamente en vez de leerlos de un scope compartido.
export function buildReciboPreview(recibo, { nombreAcademia = "", textoExencionIva = "", emailEmisor = "" } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ef-preview";

  const banda = document.createElement("div");
  banda.className = "ef-preview-banda";
  const marca = document.createElement("div");
  marca.className = "ef-preview-marca";
  marca.textContent = nombreAcademia || "—";
  const tag = document.createElement("div");
  tag.className = "ef-preview-tag";
  tag.textContent = "Recibo informativo";
  banda.append(marca, tag);
  wrap.appendChild(banda);

  const body = document.createElement("div");
  body.className = "ef-preview-body";

  const titulo = document.createElement("h2");
  titulo.className = "ef-preview-titulo";
  titulo.textContent = recibo.concepto;
  const meta = document.createElement("div");
  meta.className = "ef-preview-meta";
  meta.textContent = `${recibo.numero_recibo || "—"} · emitido ${formatFecha(recibo.created_at)}`;
  body.append(titulo, meta);

  const datosRow = document.createElement("div");
  datosRow.className = "ef-preview-datos";
  datosRow.append(
    buildDatoCol("Familia", recibo.familia?.nombre),
    buildDatoCol("Método de pago", metodoPagoLabel(recibo.familia?.metodo_pago))
  );
  body.appendChild(datosRow);

  const sep = document.createElement("hr");
  sep.className = "ef-preview-sep";
  body.appendChild(sep);

  const tabla = document.createElement("table");
  tabla.className = "ef-preview-tabla";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const texto of ["Alumno", "Concepto", "Importe"]) {
    const th = document.createElement("th");
    th.textContent = texto;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  const tbody = document.createElement("tbody");
  for (const linea of recibo.lineas || []) tbody.appendChild(buildLineaRow(linea));
  tabla.append(thead, tbody);
  body.appendChild(tabla);

  const descuentos = buildDescuentosBlock(recibo);
  if (descuentos) body.appendChild(descuentos);

  const totalRow = document.createElement("div");
  totalRow.className = "ef-preview-total";
  const totalLabel = document.createElement("div");
  totalLabel.textContent = `Total ${MESES[recibo.mes] || ""} ${recibo.anio}`;
  const totalValor = document.createElement("div");
  totalValor.className = "ef-preview-total-valor";
  totalValor.textContent = formatEuros(recibo.total_neto);
  totalRow.append(totalLabel, totalValor);
  body.appendChild(totalRow);

  if (textoExencionIva) {
    const exencion = document.createElement("p");
    exencion.className = "ef-preview-exencion";
    exencion.textContent = textoExencionIva;
    body.appendChild(exencion);
  }

  wrap.appendChild(body);

  const footer = document.createElement("div");
  footer.className = "ef-preview-footer";
  const docLine = document.createElement("div");
  docLine.textContent = "Documento informativo sin validez fiscal.";
  footer.appendChild(docLine);
  if (emailEmisor) {
    const contactoLine = document.createElement("div");
    contactoLine.textContent = `Si desea factura oficial, contacte con ${emailEmisor}.`;
    footer.appendChild(contactoLine);
  }
  wrap.appendChild(footer);

  return wrap;
}
