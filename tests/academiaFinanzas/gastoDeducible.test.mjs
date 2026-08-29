import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

// A3: un gasto sin desglose de IVA contaba CERO euros deducibles.
//
// Los dos sitios que suman gastos para el Modelo 130 sumaban
// `base_imponible`, y esa columna se queda en NULL siempre que el gasto se
// registra sin desglosar el IVA — el caso por defecto, porque el
// interruptor "Desglosar IVA" está apagado. Un gasto de 121 € desaparecía
// entero de la casilla [02], y de ahí sale un pago fraccionado más alto del
// que toca. Es un error de dinero, no de presentación.
export async function run({ test, assert }) {
  const { importeDeducible, sumarDeducibles } = await import(
    "../../server/lib/academiaFinanzas/gastoDeducible.js"
  );
  const { fetchIngresosGastosTrimestre } = await import(
    "../../server/lib/academiaFinanzas/fiscalConsultas.js"
  );
  const { fetchResumenFiscal } = await import(
    "../../server/lib/academiaFinanzas/resumenConsultas.js"
  );

  const TENANT = "tenant-1";

  test("REGRESIÓN: sin desglose se deduce el importe ENTERO, no cero", () => {
    // En una actividad exenta de IVA (la enseñanza lo está) el IVA soportado
    // no se recupera: forma parte del coste y es gasto deducible en IRPF.
    assert.equal(importeDeducible({ importe: 121, base_imponible: null }), 121);
    assert.equal(importeDeducible({ importe: 121 }), 121);
  });

  test("con desglose se deduce la base: el IVA se recupera por el 303", () => {
    // Irse al total ahí sería deducir el mismo IVA dos veces.
    assert.equal(importeDeducible({ importe: 121, base_imponible: 100 }), 100);
  });

  test("una base de 0 € es un dato, no un hueco", () => {
    // Un gasto exento registrado con desglose y base 0 no puede caerse al
    // importe por confundir 0 con 'sin dato'.
    assert.equal(importeDeducible({ importe: 121, base_imponible: 0 }), 0);
  });

  test("un gasto sin importe ni base no rompe la suma", () => {
    assert.equal(importeDeducible({}), 0);
    assert.equal(importeDeducible(null), 0);
  });

  test("sumarDeducibles redondea a céntimos y mezcla los dos casos", () => {
    const total = sumarDeducibles([
      { importe: 121, base_imponible: 100 },   // con desglose -> 100
      { importe: 50.5, base_imponible: null }, // sin desglose -> 50,50
      { importe: 10.005 },                     // sin desglose -> 10,005
    ]);
    assert.equal(total, 160.51);
  });

  test("REGRESIÓN en el Modelo 130: la casilla [02] deja de tragarse los gastos sin desglose", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_recibos: [
        { id: "r1", tenant_id: TENANT, anio: 2026, mes: 4, estado: "pagado", total_neto: 1000 },
      ],
      academia_gastos: [
        { id: "g1", tenant_id: TENANT, fecha: "2026-04-10", importe: 121, base_imponible: 100 },
        { id: "g2", tenant_id: TENANT, fecha: "2026-05-02", importe: 60, base_imponible: null },
        { id: "g3", tenant_id: TENANT, fecha: "2026-06-30", importe: 40, base_imponible: null },
      ],
    });

    const { calculado, error } = await fetchIngresosGastosTrimestre(admin, TENANT, { anio: 2026, trimestre: 2 });
    assert.equal(error, undefined);
    assert.equal(calculado.ingresos, 1000);
    assert.equal(calculado.gastos_deducibles, 200, "100 + 60 + 40: antes contaba solo 100");
  });

  test("REGRESIÓN en el resumen: el pago fraccionado estimado ya no sale inflado", async () => {
    // 1000 - 200 = 800 -> 160 €. Con el fallo eran 1000 - 100 = 900 -> 180 €:
    // 20 € de más cada trimestre por un gasto bien registrado.
    const admin = makeFakeSupabaseAdmin({
      academia_recibos: [
        { id: "r1", tenant_id: TENANT, anio: 2026, mes: 4, estado: "pagado", total_neto: 1000 },
      ],
      academia_gastos: [
        { id: "g1", tenant_id: TENANT, fecha: "2026-04-10", importe: 121, base_imponible: 100 },
        { id: "g2", tenant_id: TENANT, fecha: "2026-05-02", importe: 100, base_imponible: null },
      ],
    });

    const { fiscal, error } = await fetchResumenFiscal(admin, TENANT, 2026, { trimestre: 2 });
    assert.equal(error, undefined);
    assert.equal(fiscal.gastos_deducibles, 200);
    assert.equal(fiscal.rendimiento_neto, 800);
    assert.equal(fiscal.pago_fraccionado, 160);
  });
}
