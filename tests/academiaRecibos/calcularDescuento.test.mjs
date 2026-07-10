// calcularDescuento() — combina descuento de hermanos (% familia) +
// descuento puntual (% familia) + descuento recurrente (importe ya sumado
// desde fuera, ver desglosarDescuentosRecurrentes) en un total_descuento y
// total_neto. Es el punto donde se decide el importe final que paga la
// familia — la función con más riesgo real del archivo.

export async function run({ test, assert }) {
  const { calcularDescuento, round2 } =
    await import("../../server/lib/academiaRecibos/calculos.js");

  // ── casos normales ────────────────────────────────────────────────────

  test("sin ningún descuento -> neto igual al bruto", () => {
    const r = calcularDescuento({ totalBruto: 150 });
    assert.deepStrictEqual(r, { totalDescuento: 0, totalNeto: 150 });
  });

  test("solo descuento de hermanos", () => {
    const r = calcularDescuento({ totalBruto: 200, descuentoHermanosPct: 10 });
    assert.deepStrictEqual(r, { totalDescuento: 20, totalNeto: 180 });
  });

  test("solo descuento puntual", () => {
    const r = calcularDescuento({ totalBruto: 200, descuentoPuntualPct: 15 });
    assert.deepStrictEqual(r, { totalDescuento: 30, totalNeto: 170 });
  });

  test("solo descuento recurrente (importe ya calculado, no porcentaje)", () => {
    const r = calcularDescuento({ totalBruto: 200, descuentoRecurrenteImporte: 25.5 });
    assert.deepStrictEqual(r, { totalDescuento: 25.5, totalNeto: 174.5 });
  });

  test("los tres combinados sobre el mismo total (hermanos + puntual + recurrente)", () => {
    const r = calcularDescuento({
      totalBruto: 300,
      descuentoHermanosPct: 10,   // 30
      descuentoPuntualPct: 5,     // 15
      descuentoRecurrenteImporte: 12.5,
    });
    assert.deepStrictEqual(r, { totalDescuento: 57.5, totalNeto: 242.5 });
  });

  // ── límites: 0€, 100%, por encima del 100% ───────────────────────────────

  test("bruto 0€ -> todo queda en 0 sin importar los porcentajes", () => {
    const r = calcularDescuento({ totalBruto: 0, descuentoHermanosPct: 50, descuentoPuntualPct: 20 });
    assert.deepStrictEqual(r, { totalDescuento: 0, totalNeto: 0 });
  });

  test("descuento combinado exactamente 100% -> neto 0, no negativo", () => {
    const r = calcularDescuento({ totalBruto: 120, descuentoHermanosPct: 60, descuentoPuntualPct: 40 });
    assert.deepStrictEqual(r, { totalDescuento: 120, totalNeto: 0 });
  });

  test("descuento combinado por encima del 100% -> neto negativo (documentado: la función no lo impide, es responsabilidad del llamador)", () => {
    const r = calcularDescuento({ totalBruto: 100, descuentoHermanosPct: 60, descuentoPuntualPct: 60 });
    assert.deepStrictEqual(r, { totalDescuento: 120, totalNeto: -20 });
  });

  // ── valores por defecto (params omitidos) ────────────────────────────────

  test("params opcionales omitidos se tratan como 0, no como error", () => {
    const r = calcularDescuento({ totalBruto: 100 });
    assert.deepStrictEqual(r, { totalDescuento: 0, totalNeto: 100 });
  });

  test("totalBruto no numérico se trata como 0 (Number(x) || 0)", () => {
    const r = calcularDescuento({ totalBruto: "no-es-numero", descuentoHermanosPct: 10 });
    assert.deepStrictEqual(r, { totalDescuento: 0, totalNeto: 0 });
  });

  // ── redondeo: casos que fuerzan céntimos ─────────────────────────────────

  test("tercios de cantidades — bruto que no divide exacto entre 3", () => {
    const r = calcularDescuento({ totalBruto: 100, descuentoHermanosPct: 100 / 3 });
    // 100 * (100/3) / 100 = 33.333... -> round2 = 33.33
    assert.strictEqual(r.totalDescuento, 33.33);
    assert.strictEqual(r.totalNeto, 66.67);
  });

  test("caso 33.335 (uno de los que fuerzan el redondeo a mano)", () => {
    const r = calcularDescuento({ totalBruto: 1, descuentoRecurrenteImporte: 33.335 });
    assert.strictEqual(r.totalDescuento, round2(33.335));
  });

  test("invariante: totalNeto + totalDescuento === totalBruto, exacto al céntimo, en un barrido amplio", () => {
    // Barrido de brutos y porcentajes variados, incluyendo los que fuerzan
    // redondeo — el total del recibo (neto+descuento) nunca debe perder ni
    // ganar un céntimo respecto al bruto, aunque el desglose interno tenga
    // el defecto de coma flotante documentado en round2.test.mjs.
    for (let brutoCents = 1; brutoCents <= 20000; brutoCents += 37) {
      const totalBruto = brutoCents / 100;
      for (const pct of [0, 7, 12.5, 33.333, 50, 62.5, 99.99, 100]) {
        const { totalDescuento, totalNeto } = calcularDescuento({
          totalBruto,
          descuentoHermanosPct: pct,
          descuentoRecurrenteImporte: 3.33,
        });
        const suma = round2(totalNeto + totalDescuento);
        assert.strictEqual(
          suma,
          totalBruto,
          `bruto=${totalBruto} pct=${pct}: neto(${totalNeto}) + descuento(${totalDescuento}) = ${suma}, esperado ${totalBruto}`
        );
      }
    }
  });
}
