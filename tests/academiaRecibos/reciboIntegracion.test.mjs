// Integración pura (sin DB) de calculos.js replicando exactamente la
// composición real de generarReciboParaFamilia() (generarRecibo.js): por
// cada alumno se desglosan sus descuentos recurrentes sobre SU bruto, se
// suman los brutos y los importes recurrentes de todos los alumnos, y ese
// total se combina con el descuento de hermanos/puntual (a nivel familia)
// en calcularDescuento(). Verifica el invariante central del recibo: el
// total no debe perder ni ganar un céntimo respecto a la suma de sus líneas.

function componerRecibo({ alumnos, descuentoHermanosPct = 0, descuentoPuntualPct = 0 }, fns) {
  const { desglosarDescuentosRecurrentes, calcularDescuento, round2 } = fns;
  let totalBruto = 0;
  let recurrenteImporteTotal = 0;
  const desglosePorAlumno = [];
  for (const a of alumnos) {
    const desglose = desglosarDescuentosRecurrentes(a.descuentos || [], a.bruto);
    desglosePorAlumno.push(desglose);
    totalBruto += a.bruto;
    recurrenteImporteTotal += desglose.reduce((suma, d) => suma + d.importe, 0);
  }
  recurrenteImporteTotal = round2(recurrenteImporteTotal);
  const { totalDescuento, totalNeto } = calcularDescuento({
    totalBruto,
    descuentoHermanosPct,
    descuentoPuntualPct,
    descuentoRecurrenteImporte: recurrenteImporteTotal,
  });
  return { totalBruto: round2(totalBruto), totalDescuento, totalNeto, desglosePorAlumno, recurrenteImporteTotal };
}

export async function run({ test, assert }) {
  const fns = await import("../../server/lib/academiaRecibos/calculos.js");
  const { round2 } = fns;
  const componer = (args) => componerRecibo(args, fns);

  test("familia de 1 alumno, sin descuentos -> neto = bruto", () => {
    const r = componer({ alumnos: [{ bruto: 120, descuentos: [] }] });
    assert.strictEqual(r.totalBruto, 120);
    assert.strictEqual(r.totalDescuento, 0);
    assert.strictEqual(r.totalNeto, 120);
  });

  test("familia de 2 hermanos, cada uno con su propio descuento recurrente + descuento de hermanos familiar", () => {
    const r = componer({
      alumnos: [
        { bruto: 100, descuentos: [{ concepto: "Beca", porcentaje: 10, acumulable: true }] },   // línea: 10
        { bruto: 80,  descuentos: [{ concepto: "Beca", porcentaje: 10, acumulable: true }] },    // línea: 8
      ],
      descuentoHermanosPct: 5, // 5% de 180 = 9
    });
    assert.strictEqual(r.totalBruto, 180);
    assert.strictEqual(r.recurrenteImporteTotal, 18); // 10 + 8, suma exacta de las líneas de cada alumno
    assert.strictEqual(r.totalDescuento, 27); // 18 (recurrente) + 9 (hermanos)
    assert.strictEqual(r.totalNeto, 153);
    // invariante: total = suma de líneas (bruto - descuento = neto, exacto al céntimo)
    assert.strictEqual(round2(r.totalNeto + r.totalDescuento), r.totalBruto);
  });

  test("familia de 3 hermanos con descuentos mixtos (acumulable + no-acumulable) y descuento puntual familiar", () => {
    const r = componer({
      alumnos: [
        { bruto: 150, descuentos: [
          { concepto: "Beca", porcentaje: 5, acumulable: true },
          { concepto: "Promo A", porcentaje: 10, acumulable: false },
          { concepto: "Promo B", porcentaje: 20, acumulable: false }, // gana esta (mayor %, no acumulable)
        ] },
        { bruto: 150, descuentos: [{ concepto: "Beca", porcentaje: 5, acumulable: true }] },
        { bruto: 90,  descuentos: [] },
      ],
      descuentoPuntualPct: 8,
    });
    // alumno 1: 5% de 150 (7.5) + 20% de 150 (30) = 37.5 (Promo A de 10% descartada)
    // alumno 2: 5% de 150 = 7.5
    // alumno 3: 0
    assert.strictEqual(r.recurrenteImporteTotal, 45); // 37.5 + 7.5
    assert.strictEqual(r.totalBruto, 390);
    // puntual: 8% de 390 = 31.2
    assert.strictEqual(r.totalDescuento, round2(45 + 31.2));
    assert.strictEqual(round2(r.totalNeto + r.totalDescuento), r.totalBruto);
  });

  test("familia de 4+ hermanos, todos con el mismo descuento -> escala linealmente sin perder céntimos", () => {
    const alumnos = Array.from({ length: 5 }, (_, i) => ({
      bruto: 77.77,
      descuentos: [{ concepto: "Beca", porcentaje: 12.5, acumulable: true }],
    }));
    const r = componer({ alumnos, descuentoHermanosPct: 3 });
    assert.strictEqual(r.totalBruto, round2(77.77 * 5));
    assert.strictEqual(round2(r.totalNeto + r.totalDescuento), r.totalBruto);
  });

  test("alumno sin hermanos (familia de 1) con 100% de descuento recurrente -> neto 0", () => {
    const r = componer({
      alumnos: [{ bruto: 60, descuentos: [{ concepto: "Beca total", porcentaje: 100, acumulable: true }] }],
    });
    assert.strictEqual(r.totalNeto, 0);
    assert.strictEqual(r.totalDescuento, 60);
  });

  test("caso que fuerza el defecto de round2 (bruto=100.50, 1%) SIGUE cuadrando el total pese al defecto de precisión", () => {
    // round2(100.50 * 1 / 100) da 1 en vez del 1.01 "matemáticamente exacto"
    // (ver round2.test.mjs) — ese error de precisión existe, pero el
    // invariante total = neto + descuento se mantiene porque totalNeto se
    // deriva restando el MISMO totalDescuento ya redondeado, no se
    // recalcula por otro camino. El céntimo no se "pierde" del total, lo
    // que ocurre es que el importe del descuento en sí no es el
    // matemáticamente exacto para ese caso concreto.
    const r = componer({
      alumnos: [{ bruto: 100.5, descuentos: [{ concepto: "Uno por ciento", porcentaje: 1, acumulable: true }] }],
    });
    assert.strictEqual(r.recurrenteImporteTotal, 1); // el defecto documentado: "debería" ser 1.01
    assert.strictEqual(round2(r.totalNeto + r.totalDescuento), r.totalBruto); // pero el total sigue cuadrando
  });

  test("invariante total=neto+descuento en un barrido de familias de 1 a 5 hermanos con brutos variados", () => {
    for (let n = 1; n <= 5; n++) {
      for (let brutoBaseCents = 501; brutoBaseCents <= 30000; brutoBaseCents += 4999) {
        const brutoBase = brutoBaseCents / 100;
        const alumnos = Array.from({ length: n }, (_, i) => ({
          bruto: round2(brutoBase + i * 3.33),
          descuentos: [{ concepto: "Beca", porcentaje: 12.5 + i, acumulable: true }],
        }));
        const r = componer({ alumnos, descuentoHermanosPct: n > 1 ? 5 : 0, descuentoPuntualPct: 2.5 });
        assert.strictEqual(
          round2(r.totalNeto + r.totalDescuento),
          r.totalBruto,
          `n=${n} brutoBase=${brutoBase}: neto+descuento (${round2(r.totalNeto + r.totalDescuento)}) != bruto (${r.totalBruto})`
        );
      }
    }
  });
}
