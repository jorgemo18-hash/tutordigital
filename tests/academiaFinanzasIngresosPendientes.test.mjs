import { makeFakeSupabaseAdmin } from "./support/fakeSupabaseAdmin.mjs";

// FINANZAS › INGRESOS › PENDIENTES. Lo que se enseña de cada alumno es lo que
// dice SU RECIBO, no su tarifa (Jorge, 30/09/2026: "si le doy el 50 % de
// descuento, en finanzas me sigue apareciendo todo"). Ver importePorLinea.js.
//
// Historia: esta vista pedía las tarifas con .in("alumno_id", …) y una línea
// con alumno_id null (alumno borrado) hacía que Postgres rechazara la
// consulta (TUTORDIGITAL-BACKEND-5). Ya no se consultan tarifas; el test de
// la línea sin alumno se mantiene porque ese caso sigue existiendo.

export async function run({ test, assert }) {
  const { fetchPendientesAgrupados } = await import("../server/lib/academiaFinanzas/ingresosConsultas.js");
  const { importesPorLinea } = await import("../server/lib/academiaRecibos/importePorLinea.js");

  const recibo = (extra) => ({ tenant_id: "t1", mes: 9, anio: 2026, estado: "pagado", familia: { nombre: "F", metodo_pago: "bizum" }, ...extra });

  test("pendientes: un 50 % puntual se ve — la cuota es la del recibo, no la tarifa", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_recibos: [recibo({ id: "r1", total_bruto: 100, total_neto: 50 })],
      academia_recibos_lineas: [{ id: "l1", recibo_id: "r1", alumno_id: "a1", nombre_alumno: "Ana", precio_bruto: 100, descuentos_recurrentes: [] }],
      academia_tarifas: [{ alumno_id: "a1", tenant_id: "t1", precio_neto: 100, fecha_fin: null }],
    });
    const { grupos, error } = await fetchPendientesAgrupados(admin, "t1", { mes: 9, anio: 2026 });
    assert.equal(error, undefined);
    assert.equal(grupos[0].alumnos[0].cuota, 50);
  });

  test("pendientes: hermanos — cada uno lo suyo y la suma es exactamente el neto del recibo", async () => {
    // 110 + 75 = 185 bruto; Aarón con un 15 % de hermanos (−11,25); 10 % puntual
    // a la familia sobre el bruto (−18,50): neto 155,25.
    const admin = makeFakeSupabaseAdmin({
      academia_recibos: [recibo({ id: "r1", total_bruto: 185, total_neto: 155.25 })],
      academia_recibos_lineas: [
        { id: "l1", recibo_id: "r1", alumno_id: "a1", nombre_alumno: "Eric", precio_bruto: 110, descuentos_recurrentes: [] },
        { id: "l2", recibo_id: "r1", alumno_id: "a2", nombre_alumno: "Aarón", precio_bruto: 75, descuentos_recurrentes: [{ concepto: "Hermanos", porcentaje: 15, importe: 11.25 }] },
      ],
    });
    const { grupos } = await fetchPendientesAgrupados(admin, "t1", { mes: 9, anio: 2026 });
    const cuota = (n) => grupos[0].alumnos.find((a) => a.alumno_nombre === n).cuota;
    assert.equal(cuota("Eric"), 99);
    assert.equal(cuota("Aarón"), 56.25);
    assert.equal(Math.round((cuota("Eric") + cuota("Aarón")) * 100), 15525);
  });

  test("importesPorLinea: con redondeos que no cuadran, la suma sigue siendo el neto al céntimo", () => {
    for (const [brutos, pct] of [[[33.33, 33.33, 33.34], 25], [[45, 45, 45], 33], [[10.01, 20.02], 17]]) {
      const bruto = brutos.reduce((s, x) => s + x, 0);
      const neto = Math.round((bruto - (bruto * pct) / 100) * 100) / 100;
      const importes = importesPorLinea({ total_neto: neto }, brutos.map((b) => ({ precio_bruto: b })));
      assert.equal(Math.round(importes.reduce((s, x) => s + x, 0) * 100), Math.round(neto * 100), `${brutos} al ${pct} %`);
    }
  });

  test("pendientes: línea de recibo sin alumno_id (alumno borrado) no revienta y enseña lo del recibo", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_recibos: [recibo({ id: "r1", estado: "borrador", total_bruto: 80, total_neto: 80 })],
      academia_recibos_lineas: [{ id: "l1", recibo_id: "r1", alumno_id: null, nombre_alumno: "ala", precio_bruto: 80 }],
    });
    const { grupos, error } = await fetchPendientesAgrupados(admin, "t1", { mes: 9, anio: 2026 });
    assert.equal(error, undefined);
    assert.equal(grupos[0].alumnos[0].alumno_nombre, "ala");
    assert.equal(grupos[0].alumnos[0].cuota, 80);
  });

  test("pendientes: sin recibos ese mes → grupos vacío", async () => {
    const admin = makeFakeSupabaseAdmin({ academia_recibos: [], academia_recibos_lineas: [] });
    const result = await fetchPendientesAgrupados(admin, "t1", { mes: 1, anio: 2026 });
    assert.deepEqual(result.grupos, []);
  });
}
