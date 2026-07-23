// Los buffers de exportación son el documento que se presentaría ante una
// inspección de trabajo — basta con comprobar que son binarios válidos de
// verdad (no un objeto vacío o una promesa rota), no hace falta parsear
// visualmente el contenido.
export async function run({ test, assert }) {
  const { buildFichajesPdfBuffer } = await import("../../server/lib/academiaFichajes/exportPdf.js");
  const { buildFichajesExcelBuffer } = await import("../../server/lib/academiaFichajes/exportExcel.js");
  const ExcelJS = (await import("exceljs")).default;

  const FICHAJES = [
    { id: "f1", tipo: "entrada", origen: "worker", timestamp: "2026-07-05T08:00:00.000Z" },
    {
      id: "f2", tipo: "salida", origen: "admin_correccion", timestamp: "2026-07-05T17:00:00.000Z",
      motivo: "Se le olvidó fichar", corregidoPorNombre: "María Admin",
    },
  ];

  test("buildFichajesPdfBuffer genera un PDF válido (empieza por %PDF)", async () => {
    const buffer = await buildFichajesPdfBuffer({
      academiaNombre: "Academia Test", trabajadorNombre: "Ana García", mes: 7, anio: 2026, fichajes: FICHAJES,
    });
    assert.ok(Buffer.isBuffer(buffer));
    assert.equal(buffer.subarray(0, 4).toString("latin1"), "%PDF");
    assert.ok(buffer.length > 500, "un PDF con contenido real no debería pesar casi nada");
  });

  test("buildFichajesPdfBuffer no revienta con un período sin fichajes", async () => {
    const buffer = await buildFichajesPdfBuffer({
      academiaNombre: "Academia Test", trabajadorNombre: "Ana García", mes: 7, anio: 2026, fichajes: [],
    });
    assert.equal(buffer.subarray(0, 4).toString("latin1"), "%PDF");
  });

  test("buildFichajesExcelBuffer genera un .xlsx válido con original y corrección en filas separadas", async () => {
    const buffer = await buildFichajesExcelBuffer({
      academiaNombre: "Academia Test", trabajadorNombre: "Ana García", mes: 7, anio: 2026, fichajes: FICHAJES,
    });
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 0);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet("Control horario");
    assert.ok(sheet, "debe existir la hoja Control horario");

    const filaOriginal = sheet.getRow(5).values;
    const filaCorreccion = sheet.getRow(6).values;
    assert.ok(String(filaOriginal).includes("Fichado por el trabajador"));
    assert.ok(String(filaCorreccion).includes("Corrección de admin"));
    assert.ok(String(filaCorreccion).includes("María Admin"));
  });
}
