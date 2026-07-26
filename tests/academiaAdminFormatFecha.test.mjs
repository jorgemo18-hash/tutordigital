export async function run({ test, assert }) {
  const { formatFechaEs, formatRangoFechasEs } = await import("../assets/academia/admin/js/utils/formatFecha.js");

  test("formatFechaEs: ISO a DD/MM/YYYY", () => {
    assert.equal(formatFechaEs("2026-07-26"), "26/07/2026");
  });

  test("formatFechaEs: vacío o inválido -> string vacío, no revienta", () => {
    assert.equal(formatFechaEs(""), "");
    assert.equal(formatFechaEs(null), "");
    assert.equal(formatFechaEs(undefined), "");
  });

  test("formatRangoFechasEs: mismo día -> una sola fecha", () => {
    assert.equal(formatRangoFechasEs("2026-07-26", "2026-07-26"), "26/07/2026");
  });

  test("formatRangoFechasEs: rango de varios días -> ambas fechas separadas por –", () => {
    assert.equal(formatRangoFechasEs("2026-07-26", "2026-07-30"), "26/07/2026 – 30/07/2026");
  });
}
