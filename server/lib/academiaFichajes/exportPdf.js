import PDFDocument from "pdfkit";

const MESES = [
  null, "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatFechaHora(iso) {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const COLS = [
  { label: "Fecha y hora", x: 40, width: 100 },
  { label: "Tipo", x: 145, width: 55 },
  { label: "Origen", x: 205, width: 130 },
  { label: "Motivo / corregido por", x: 340, width: 195 },
];

function pintarCabeceraTabla(doc, y) {
  doc.font("Helvetica-Bold").fontSize(9);
  for (const col of COLS) doc.text(col.label, col.x, y, { width: col.width });
  doc.moveTo(40, y + 14).lineTo(535, y + 14).strokeColor("#999999").stroke();
  doc.font("Helvetica").fontSize(9);
}

// Fila de UN fichaje — original y corrección se pintan cada una en su
// propia fila, nunca fusionadas: si `f` es una corrección, "Origen" lo
// deja explícito y la última columna lleva el motivo + quién la hizo, tal
// como exige el modelo (apto para presentar ante una inspección de
// trabajo, ver el enunciado de esta tarea).
function pintarFilaFichaje(doc, f, y) {
  const origen = f.origen === "admin_correccion" ? "Corrección de admin" : "Fichado por el trabajador";
  let detalle = "";
  if (f.origen === "admin_correccion") {
    detalle = `${f.motivo || ""} (${f.corregidoPorNombre || "admin"})`;
    if (f.notas) detalle += ` · ${f.notas}`;
  }
  doc.text(formatFechaHora(f.timestamp), COLS[0].x, y, { width: COLS[0].width });
  doc.text(f.tipo === "entrada" ? "Entrada" : "Salida", COLS[1].x, y, { width: COLS[1].width });
  doc.text(origen, COLS[2].x, y, { width: COLS[2].width });
  doc.text(detalle, COLS[3].x, y, { width: COLS[3].width });
}

// Genera el PDF del listado de fichajes de un trabajador en un mes —
// devuelve un Buffer (no escribe a disco), listo para adjuntar en la
// respuesta HTTP. `fichajes` ya viene ordenado cronológicamente (ver
// fetchFichajesDeTrabajador) y con original/corrección como entradas
// separadas — esta función no fusiona nada, solo pinta.
export function buildFichajesPdfBuffer({ academiaNombre, trabajadorNombre, mes, anio, fichajes }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font("Helvetica-Bold").fontSize(15).text(`Control horario — ${academiaNombre}`);
    doc.font("Helvetica").fontSize(11).text(`${trabajadorNombre} · ${MESES[mes]} ${anio}`);
    doc.moveDown();

    let y = doc.y;
    pintarCabeceraTabla(doc, y);
    y += 20;

    if (!fichajes.length) {
      doc.text("Sin fichajes en este período.", 40, y);
    }
    for (const f of fichajes) {
      if (y > 780) {
        doc.addPage();
        y = 40;
        pintarCabeceraTabla(doc, y);
        y += 20;
      }
      pintarFilaFichaje(doc, f, y);
      y += 18;
    }

    doc.end();
  });
}
