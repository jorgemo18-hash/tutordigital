import { makeFakeSupabaseAdmin } from "./support/fakeSupabaseAdmin.mjs";

// Reproduce TUTORDIGITAL-BACKEND-5 ("Failed to fetch pendientes",
// GET /api/v1/academia/finanzas/ingresos/pendientes): una línea de recibo
// con alumno_id NULL (columna nullable — pasa con alumnos borrados que
// dejan su recibo/línea histórica) hacía que el array pasado a
// .in("alumno_id", alumnoIds) incluyera `null`, y Postgres lo rechazaba con
// 22P02 "invalid input syntax for type uuid: null". Confirmado contra datos
// reales de Lyceo (2 líneas con alumno_id null en producción) antes de
// escribir el fix — ver server/lib/academiaFinanzas/ingresosConsultas.js.
//
// El fake de Supabase no simula el rechazo real de Postgres para un `null`
// en un .in() sobre una columna uuid (sería una regla muy específica para
// vivir en el fake compartido) — así que se espía directamente la llamada a
// .in("alumno_id", ...) sobre "academia_tarifas" y se falla el test si
// alguna vez viaja un valor null/undefined, que es exactamente lo que
// Postgres rechazaba en producción.
function makeSpyAdmin(tables) {
  const base = makeFakeSupabaseAdmin(tables);
  const inCalls = [];
  return {
    ...base,
    from(table) {
      const builder = base.from(table);
      // Envuelve TODOS los métodos encadenables para que la cadena nunca
      // "se caiga" de vuelta al builder original — si solo se envolviera
      // .in(), una llamada anterior como .select()/.eq() devolvería el
      // builder sin envolver y el espía dejaría de ver el resto de la cadena.
      const wrapped = {};
      for (const key of Object.keys(builder)) {
        wrapped[key] = (...args) => {
          if (key === "in" && table === "academia_tarifas" && args[0] === "alumno_id") {
            inCalls.push(args[1]);
          }
          const result = builder[key](...args);
          return result === builder ? wrapped : result;
        };
      }
      return wrapped;
    },
    _inCalls: inCalls,
  };
}

export async function run({ test, assert }) {
  const { fetchPendientesAgrupados } = await import("../server/lib/academiaFinanzas/ingresosConsultas.js");

  test("fetchPendientesAgrupados: línea de recibo sin alumno_id (alumno borrado) no revienta — cae a cuota 0", async () => {
    const admin = makeSpyAdmin({
      academia_recibos: [
        { id: "r1", tenant_id: "t1", mes: 7, anio: 2026, estado: "borrador", familia: { nombre: "Familia Ala", metodo_pago: "transferencia" } },
      ],
      academia_recibos_lineas: [
        { id: "l1", recibo_id: "r1", alumno_id: null, nombre_alumno: "ala" },
      ],
      academia_tarifas: [],
    });

    const result = await fetchPendientesAgrupados(admin, "t1", { mes: 7, anio: 2026 });

    assert.equal(result.error, undefined, "no debe fallar aunque la línea no tenga alumno_id");
    assert.equal(result.grupos.length, 1);
    assert.equal(result.grupos[0].metodo_pago, "transferencia");
    assert.equal(result.grupos[0].alumnos[0].alumno_nombre, "ala");
    assert.equal(result.grupos[0].alumnos[0].cuota, 0, "sin alumno_id no hay tarifa que resolver, cuota cae a 0");
  });

  test("fetchPendientesAgrupados: el array pasado a .in('alumno_id', …) para tarifas nunca contiene null (la causa exacta del 22P02)", async () => {
    const admin = makeSpyAdmin({
      academia_recibos: [
        { id: "r1", tenant_id: "t1", mes: 7, anio: 2026, estado: "borrador", familia: { nombre: "Familia Ala", metodo_pago: "transferencia" } },
      ],
      academia_recibos_lineas: [
        { id: "l1", recibo_id: "r1", alumno_id: "a1", nombre_alumno: "Con Alumno" },
        { id: "l2", recibo_id: "r1", alumno_id: null, nombre_alumno: "ala" },
      ],
      academia_tarifas: [{ alumno_id: "a1", tenant_id: "t1", precio_neto: 100, fecha_fin: null }],
    });

    await fetchPendientesAgrupados(admin, "t1", { mes: 7, anio: 2026 });

    assert.equal(admin._inCalls.length, 1, "debe haber llamado una vez a .in() sobre academia_tarifas");
    assert.deepEqual(admin._inCalls[0], ["a1"], "null debe quedar fuera del array — es justo lo que Postgres rechazaba (22P02)");
  });

  test("fetchPendientesAgrupados: mezcla de líneas con y sin alumno_id en el mismo recibo — cada una conserva su propia cuota", async () => {
    const admin = makeSpyAdmin({
      academia_recibos: [
        { id: "r1", tenant_id: "t1", mes: 7, anio: 2026, estado: "pendiente", familia: { nombre: "Familia X", metodo_pago: "domiciliacion" } },
      ],
      academia_recibos_lineas: [
        { id: "l1", recibo_id: "r1", alumno_id: "a1", nombre_alumno: "Con Alumno" },
        { id: "l2", recibo_id: "r1", alumno_id: null, nombre_alumno: "Sin Alumno" },
      ],
      academia_tarifas: [
        { alumno_id: "a1", tenant_id: "t1", precio_neto: 150, fecha_fin: null },
      ],
    });

    const result = await fetchPendientesAgrupados(admin, "t1", { mes: 7, anio: 2026 });

    assert.equal(result.error, undefined);
    const alumnos = result.grupos[0].alumnos;
    assert.equal(alumnos.find((a) => a.alumno_nombre === "Con Alumno").cuota, 150);
    assert.equal(alumnos.find((a) => a.alumno_nombre === "Sin Alumno").cuota, 0);
  });

  test("fetchPendientesAgrupados: varias líneas sin alumno_id de distintos recibos no se pierden entre sí", async () => {
    const admin = makeSpyAdmin({
      academia_recibos: [
        { id: "r1", tenant_id: "t1", mes: 6, anio: 2026, estado: "borrador", familia: { nombre: "F1", metodo_pago: "efectivo" } },
        { id: "r2", tenant_id: "t1", mes: 6, anio: 2026, estado: "borrador", familia: { nombre: "F2", metodo_pago: "efectivo" } },
      ],
      academia_recibos_lineas: [
        { id: "l1", recibo_id: "r1", alumno_id: null, nombre_alumno: "ala" },
        { id: "l2", recibo_id: "r2", alumno_id: null, nombre_alumno: "otro sin alumno" },
      ],
      academia_tarifas: [],
    });

    const result = await fetchPendientesAgrupados(admin, "t1", { mes: 6, anio: 2026 });
    assert.equal(result.error, undefined);
    const nombres = result.grupos.flatMap((g) => g.alumnos.map((a) => a.alumno_nombre));
    assert.deepEqual(nombres.sort(), ["ala", "otro sin alumno"]);
  });

  test("fetchPendientesAgrupados: sin recibos ese mes -> grupos vacío, no llega a llamar .in() de tarifas", async () => {
    const admin = makeSpyAdmin({ academia_recibos: [], academia_recibos_lineas: [], academia_tarifas: [] });
    const result = await fetchPendientesAgrupados(admin, "t1", { mes: 1, anio: 2026 });
    assert.deepEqual(result.grupos, []);
    assert.equal(admin._inCalls.length, 0);
  });
}
