import ExcelJS from "exceljs";

const MESES = [
  null, "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// Mismo criterio que exportPdf.js: original y corrección van cada una en
// su propia fila, con una columna "Origen" explícita — nunca se fusionan
// en una sola línea "limpia" que oculte que hubo una corrección. Devuelve
// un Buffer (.xlsx), no escribe a disco.
export async function buildFichajesExcelBuffer({ academiaNombre, trabajadorNombre, mes, anio, fichajes }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Control horario");

  sheet.mergeCells("A1:E1");
  sheet.getCell("A1").value = `Control horario — ${academiaNombre}`;
  sheet.getCell("A1").font = { bold: true, size: 13 };

  sheet.mergeCells("A2:E2");
  sheet.getCell("A2").value = `${trabajadorNombre} · ${MESES[mes]} ${anio}`;

  const filaCabecera = 4;
  sheet.getRow(filaCabecera).values = ["Fecha", "Hora", "Tipo", "Origen", "Motivo / corregido por"];
  sheet.getRow(filaCabecera).font = { bold: true };

  sheet.columns = [
    { key: "fecha", width: 14 },
    { key: "hora", width: 10 },
    { key: "tipo", width: 12 },
    { key: "origen", width: 26 },
    { key: "detalle", width: 45 },
  ];

  let fila = filaCabecera + 1;
  for (const f of fichajes) {
    const d = new Date(f.timestamp);
    const esCorreccion = f.origen === "admin_correccion";
    sheet.getRow(fila).values = [
      d.toLocaleDateString("es-ES"),
      d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
      f.tipo === "entrada" ? "Entrada" : "Salida",
      esCorreccion ? "Corrección de admin" : "Fichado por el trabajador",
      esCorreccion ? `${f.motivo || ""} (${f.corregidoPorNombre || "admin"})` : "",
    ];
    fila += 1;
  }
  if (!fichajes.length) {
    sheet.getRow(fila).values = ["Sin fichajes en este período."];
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
