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

function capitaliza(str) {
  return str ? str[0].toUpperCase() + str.slice(1) : str;
}

// Línea de período + fecha de envío, separada del concepto editable para
// que el mes/año del recibo nunca sea ambiguo aunque se reescriba el
// concepto. La fecha de envío solo aparece una vez enviado.
function buildPeriodoBlock(recibo) {
  const wrap = document.createElement("div");
  const periodo = document.createElement("p");
  periodo.className = "ef-preview-periodo";
  periodo.textContent = `Recibo mes de ${capitaliza(MESES[recibo.mes] || "")} ${recibo.anio}`;
  wrap.appendChild(periodo);
  if (recibo.estado === "enviado" && recibo.fecha_envio) {
    const envio = document.createElement("p");
    envio.className = "ef-preview-periodo";
    envio.textContent = `Fecha de envío: ${formatFecha(recibo.fecha_envio)}`;
    wrap.appendChild(envio);
  }
  return wrap;
}

// Si hay logo configurado (Ajustes › Personalización) se muestra en vez
// del nombre en texto — el nombre sigue siendo el fallback sin logo.
function buildMarca(nombreAcademia, logoUrl) {
  if (logoUrl) {
    const img = document.createElement("img");
    img.className = "ef-preview-logo";
    img.src = logoUrl;
    img.alt = nombreAcademia || "Logo";
    return img;
  }
  const marca = document.createElement("div");
  marca.className = "ef-preview-marca";
  marca.textContent = nombreAcademia || "—";
  return marca;
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

function buildFilaTabla(etiqueta, concepto, importeTexto, { esDescuento = false } = {}) {
  const row = document.createElement("tr");
  if (esDescuento) row.className = "ef-preview-fila-descuento";
  const colEtiqueta = document.createElement("td");
  colEtiqueta.textContent = etiqueta;
  const colConcepto = document.createElement("td");
  colConcepto.textContent = concepto;
  const colImporte = document.createElement("td");
  colImporte.className = "ef-preview-importe";
  colImporte.textContent = importeTexto;
  row.append(colEtiqueta, colConcepto, colImporte);
  return row;
}

// Por cada alumno: su fila normal + una fila adicional por cada descuento
// recurrente que tenga aplicado (ver desglosarDescuentosRecurrentes en el
// backend), con el concepto configurado en Ajustes y su propio importe.
function buildLineaRows(linea) {
  const rows = [buildFilaTabla(linea.nombre_alumno, linea.descripcion || "", formatEuros(linea.precio_bruto))];
  for (const d of linea.descuentos_recurrentes || []) {
    rows.push(buildFilaTabla(`${d.concepto} -${d.porcentaje}%`, "", `-${formatEuros(d.importe)}`, { esDescuento: true }));
  }
  return rows;
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

// Importe en euros del descuento puntual (a nivel de familia, no de
// alumno) — usado tanto por buildDescuentosBlock (para no contarlo dos
// veces dentro de "Descuentos") como por buildDescuentoPuntualBlock (para
// pintar su propia línea).
function puntualImporte(recibo) {
  const pct = Number(recibo.descuento_puntual_pct) || 0;
  if (!(pct > 0)) return 0;
  return Math.round(((Number(recibo.total_bruto) || 0) * pct) / 100 * 100) / 100;
}

// Subtotal + Descuentos (recurrentes, sin desglosar — ya se ve alumno a
// alumno en la tabla) + Total. El descuento de hermanos solo aparece como
// línea aparte en recibos históricos (anteriores a quitar ese descuento
// automático), para no perder esa información; el puntual tiene su propia
// línea aparte (ver buildDescuentoPuntualBlock) — "Descuentos" aquí resta
// ambos para no contarlos dos veces. Con un solo alumno todo este bloque
// es redundante con su fila en la tabla (importe y descuentos ya
// desglosados ahí), así que se omite entero y solo queda visible el Total.
function buildDescuentosBlock(recibo) {
  if (!(Number(recibo.total_descuento) > 0)) return null;
  if ((recibo.lineas || []).length === 1) return null;
  const wrap = document.createElement("div");
  const hermanosPct = Number(recibo.descuento_hermanos_pct) || 0;
  const hermanosImporte = hermanosPct > 0 ? Math.round(((Number(recibo.total_bruto) || 0) * hermanosPct) / 100 * 100) / 100 : 0;
  const descuentosRecurrentes = Math.round((Number(recibo.total_descuento) - hermanosImporte - puntualImporte(recibo)) * 100) / 100;
  wrap.appendChild(buildDescuentoRow("Subtotal", formatEuros(recibo.total_bruto)));
  if (descuentosRecurrentes > 0) wrap.appendChild(buildDescuentoRow("Descuentos", `-${formatEuros(descuentosRecurrentes)}`));
  if (hermanosImporte > 0) wrap.appendChild(buildDescuentoRow(`Descuento hermanos ${hermanosPct}%`, `-${formatEuros(hermanosImporte)}`));
  return wrap;
}

// El descuento puntual es de la FAMILIA, no de un alumno — se muestra como
// su propia línea junto a Subtotal/Total, nunca dentro de la tabla de
// alumnos (ahí parecía pertenecer al último alumno listado, que es
// justo la ambigüedad que evita este bloque). Se muestra siempre que
// aplique, incluso con un solo alumno (a diferencia de
// buildDescuentosBlock, que se omite en ese caso por ser redundante con
// la única fila de la tabla — el puntual nunca lo es, porque no vive en
// ninguna fila de alumno).
function buildDescuentoPuntualBlock(recibo) {
  const importe = puntualImporte(recibo);
  if (!(importe > 0)) return null;
  // Mismo formato "concepto + %" que la línea de hermanos (`Descuento
  // hermanos ${pct}%`), para que las dos lean igual — la nota es un añadido
  // opcional, no un sustituto del porcentaje.
  const pct = Number(recibo.descuento_puntual_pct) || 0;
  const etiqueta = recibo.descuento_puntual_nota
    ? `Descuento familia ${pct}% — ${recibo.descuento_puntual_nota}`
    : `Descuento familia ${pct}%`;
  return buildDescuentoRow(etiqueta, `-${formatEuros(importe)}`);
}

// Vista previa del recibo dentro del panel — mismo diseño que el email
// que recibe la familia (ver academiaReciboTemplate.js en el backend).
// `nombreAcademia` viene de academia_config; `textosExencion` viene de
// academia_textos_legales (tipo "recibos"/"ambos", activos) — un array,
// no un campo único, porque puede haber varios textos del mismo tipo.
export function buildReciboPreview(recibo, { nombreAcademia = "", textosExencion = [], emailEmisor = "", logoUrl = "" } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ef-preview";

  const banda = document.createElement("div");
  banda.className = "ef-preview-banda";
  const tag = document.createElement("div");
  tag.className = "ef-preview-tag";
  tag.textContent = "Recibo informativo";
  banda.append(buildMarca(nombreAcademia, logoUrl), tag);
  wrap.appendChild(banda);

  const body = document.createElement("div");
  body.className = "ef-preview-body";

  const titulo = document.createElement("h2");
  titulo.className = "ef-preview-titulo";
  titulo.textContent = recibo.concepto;
  const meta = document.createElement("div");
  meta.className = "ef-preview-meta";
  meta.textContent = `${recibo.numero_recibo || "—"} · emitido ${formatFecha(recibo.created_at)}`;
  body.append(titulo, meta, buildPeriodoBlock(recibo));

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
  for (const linea of recibo.lineas || []) {
    for (const row of buildLineaRows(linea)) tbody.appendChild(row);
  }
  tabla.append(thead, tbody);
  body.appendChild(tabla);

  const descuentos = buildDescuentosBlock(recibo);
  if (descuentos) body.appendChild(descuentos);

  const puntual = buildDescuentoPuntualBlock(recibo);
  if (puntual) body.appendChild(puntual);

  const totalRow = document.createElement("div");
  totalRow.className = "ef-preview-total";
  const totalLabel = document.createElement("div");
  totalLabel.textContent = `Total ${MESES[recibo.mes] || ""} ${recibo.anio}`;
  const totalValor = document.createElement("div");
  totalValor.className = "ef-preview-total-valor";
  totalValor.textContent = formatEuros(recibo.total_neto);
  totalRow.append(totalLabel, totalValor);
  body.appendChild(totalRow);

  for (const texto of textosExencion) {
    const exencion = document.createElement("p");
    exencion.className = "ef-preview-exencion";
    exencion.textContent = texto;
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
