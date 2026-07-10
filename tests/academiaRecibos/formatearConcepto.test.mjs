// formatearConcepto() — sustitución de placeholders {mes}/{año}/{academia}
// en la plantilla de concepto del recibo. No hace cálculos de dinero, pero
// forma parte del contrato público de calculos.js.

export async function run({ test, assert }) {
  const { formatearConcepto, MESES } = await import("../../server/lib/academiaRecibos/calculos.js");

  test("sustituye {mes}, {año} y {academia} con la plantilla explícita", () => {
    const resultado = formatearConcepto("Cuota {mes} {año} — {academia}", 3, 2026, "Academia X");
    assert.strictEqual(resultado, "Cuota marzo 2026 — Academia X");
  });

  test("usa la plantilla por defecto cuando no se pasa ninguna", () => {
    assert.strictEqual(formatearConcepto(null, 1, 2026), "Clases enero 2026");
    assert.strictEqual(formatearConcepto(undefined, 12, 2025), "Clases diciembre 2025");
    assert.strictEqual(formatearConcepto("", 6, 2026), "Clases junio 2026");
  });

  test("{academia} por defecto queda vacío si no se pasa academiaNombre", () => {
    assert.strictEqual(formatearConcepto("{academia} - {mes}", 5, 2026), " - mayo");
  });

  test("placeholder repetido se sustituye todas las veces", () => {
    assert.strictEqual(formatearConcepto("{mes}/{mes}", 7, 2026), "julio/julio");
  });

  test("mes fuera de rango (0, 13, negativo) no revienta — MESES[mes] es undefined -> string vacío", () => {
    assert.strictEqual(formatearConcepto("Cuota {mes} {año}", 0, 2026), "Cuota  2026");
    assert.strictEqual(formatearConcepto("Cuota {mes} {año}", 13, 2026), "Cuota  2026");
    assert.strictEqual(formatearConcepto("Cuota {mes} {año}", -1, 2026), "Cuota  2026");
  });

  test("MESES está indexado desde 1 (MESES[0] es null, MESES[1] es enero)", () => {
    assert.strictEqual(MESES[0], null);
    assert.strictEqual(MESES[1], "enero");
    assert.strictEqual(MESES[12], "diciembre");
    assert.strictEqual(MESES.length, 13);
  });
}
