import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

// Cubre el síntoma reportado en producción (recibo con total_descuento=0
// pese a tener descuentos de hermanos activos hoy) y la conservación del
// descuento puntual al regenerar. `siguienteNumeroRecibo` (calculos.js)
// usa `count`/`head`, que el fake compartido no modela — como en
// siguienteNumeroRecibo.test.mjs, aquí no importa: el numero_recibo
// resultante siempre cae en el mismo valor por defecto y no se testea.
//
// El fake compartido tampoco implementa `.delete()` (nadie más lo
// necesitaba hasta ahora) — mismo criterio que siguienteNumeroRecibo.test.mjs:
// se añade un soporte mínimo local en vez de tocar el fake compartido.
function conSoporteDeDelete(admin) {
  return {
    from(table) {
      const builder = admin.from(table);
      builder.delete = () => ({
        eq: (col1, val1) => ({
          eq: (col2, val2) => {
            admin._state.tables[table] = (admin._state.tables[table] || []).filter(
              (r) => !(r[col1] === val1 && r[col2] === val2)
            );
            return Promise.resolve({ data: null, error: null });
          },
        }),
      });
      return builder;
    },
    _state: admin._state,
  };
}

export async function run({ test, assert }) {
  const { generarReciboParaFamilia, eliminarRecibo } = await import("../../server/lib/academiaRecibos/generarRecibo.js");

  const TENANT_ID = "t1";
  const FAMILIA_ID = "f1";

  function reciboDe(admin, reciboId) {
    return admin._state.tables.academia_recibos.find((r) => r.id === reciboId);
  }

  test("recalcula con los descuentos recurrentes ACTIVOS hoy — no da total_descuento=0 si la familia tiene un descuento de hermanos activo", async () => {
    const admin = makeFakeSupabaseAdmin({ academia_recibos: [], academia_recibos_lineas: [] });
    const alumnosActivos = [{ id: "a1", nombre: "Ana", curso: "1º ESO", fecha_alta: "2025-09-01", precio_bruto: 100 }];
    const descuentosPorAlumno = { a1: [{ concepto: "Hermanos", porcentaje: 15, acumulable: true, intervalo: "siempre" }] };

    const { ok, reciboId } = await generarReciboParaFamilia(admin, {
      tenantId: TENANT_ID, familiaId: FAMILIA_ID, alumnosActivos, mes: 7, anio: 2026,
      concepto: "Julio 2026", descuentosPorAlumno,
    });

    assert.equal(ok, true);
    const recibo = reciboDe(admin, reciboId);
    assert.equal(recibo.total_bruto, 100);
    assert.equal(recibo.total_descuento, 15);
    assert.equal(recibo.total_neto, 85);
  });

  // REGRESIÓN: regenerar es DELETE + INSERT. Sin conservar el número, el
  // recibo nuevo pedía uno a la serie: se emitía un segundo documento con
  // número distinto para el mismo mes y la misma familia, y con el contador
  // basado en count() llegaba a repetir uno ya emitido (en la BD real quedó
  // un REC-2026-008 duplicado). Un recibo regenerado es el MISMO documento
  // recalculado.
  test("REGRESIÓN: al regenerar se conserva el número del recibo original", async () => {
    const admin = makeFakeSupabaseAdmin({ academia_recibos: [], academia_recibos_lineas: [] });
    const alumnosActivos = [{ id: "a1", nombre: "Ana", curso: "1º ESO", fecha_alta: "2025-09-01", precio_bruto: 100 }];

    const { ok, reciboId } = await generarReciboParaFamilia(admin, {
      tenantId: TENANT_ID, familiaId: FAMILIA_ID, alumnosActivos, mes: 7, anio: 2026,
      concepto: "Julio 2026", descuentosPorAlumno: {},
      numeroReciboPrevio: "REC-2026-008",
    });

    assert.equal(ok, true);
    assert.equal(reciboDe(admin, reciboId).numero_recibo, "REC-2026-008");
  });

  test("una generación nueva (sin número previo) sí toma el siguiente de la serie", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_recibos: [{ tenant_id: TENANT_ID, numero_recibo: "REC-2026-008" }],
      academia_recibos_lineas: [],
    });
    const alumnosActivos = [{ id: "a1", nombre: "Ana", curso: "1º ESO", fecha_alta: "2025-09-01", precio_bruto: 100 }];

    const { ok, reciboId } = await generarReciboParaFamilia(admin, {
      tenantId: TENANT_ID, familiaId: FAMILIA_ID, alumnosActivos, mes: 8, anio: 2026,
      concepto: "Agosto 2026", descuentosPorAlumno: {},
    });

    assert.equal(ok, true);
    assert.equal(reciboDe(admin, reciboId).numero_recibo, "REC-2026-009");
  });

  test("descuentoPuntualPct/Nota (trasladados desde el recibo que se acaba de borrar) se conservan en la fila y en el total", async () => {
    const admin = makeFakeSupabaseAdmin({ academia_recibos: [], academia_recibos_lineas: [] });
    const alumnosActivos = [{ id: "a1", nombre: "Ana", curso: "1º ESO", fecha_alta: "2025-09-01", precio_bruto: 200 }];

    const { ok, reciboId } = await generarReciboParaFamilia(admin, {
      tenantId: TENANT_ID, familiaId: FAMILIA_ID, alumnosActivos, mes: 7, anio: 2026,
      concepto: "Julio 2026", descuentosPorAlumno: {},
      descuentoPuntualPct: 10, descuentoPuntualNota: "Beca ayuntamiento",
    });

    assert.equal(ok, true);
    const recibo = reciboDe(admin, reciboId);
    assert.equal(recibo.descuento_puntual_pct, 10);
    assert.equal(recibo.descuento_puntual_nota, "Beca ayuntamiento");
    assert.equal(recibo.total_descuento, 20);
    assert.equal(recibo.total_neto, 180);
  });

  test("sin descuentoPuntualPct/Nota (primera generación, nunca hubo recibo antes) -> quedan en 0/null, no en undefined", async () => {
    const admin = makeFakeSupabaseAdmin({ academia_recibos: [], academia_recibos_lineas: [] });
    const alumnosActivos = [{ id: "a1", nombre: "Ana", curso: "1º ESO", fecha_alta: "2025-09-01", precio_bruto: 50 }];

    const { ok, reciboId } = await generarReciboParaFamilia(admin, {
      tenantId: TENANT_ID, familiaId: FAMILIA_ID, alumnosActivos, mes: 7, anio: 2026,
      concepto: "Julio 2026", descuentosPorAlumno: {},
    });

    assert.equal(ok, true);
    const recibo = reciboDe(admin, reciboId);
    assert.equal(recibo.descuento_puntual_pct, 0);
    assert.equal(recibo.descuento_puntual_nota, null);
  });

  test("eliminarRecibo + generarReciboParaFamilia produce una fila NUEVA (id distinto) con los descuentos actuales, no una mutación de la vieja", async () => {
    const admin = conSoporteDeDelete(makeFakeSupabaseAdmin({
      academia_recibos: [{
        id: "r-original", tenant_id: TENANT_ID, familia_id: FAMILIA_ID, mes: 7, anio: 2026,
        estado: "enviado", total_descuento: 0, total_bruto: 100, total_neto: 100,
      }],
      academia_recibos_lineas: [],
    }));

    const { ok: delOk } = await eliminarRecibo(admin, { tenantId: TENANT_ID, reciboId: "r-original" });
    assert.equal(delOk, true);
    assert.equal(reciboDe(admin, "r-original"), undefined);

    const alumnosActivos = [{ id: "a1", nombre: "Ana", curso: "1º ESO", fecha_alta: "2025-09-01", precio_bruto: 100 }];
    const descuentosPorAlumno = { a1: [{ concepto: "Hermanos", porcentaje: 15, acumulable: true, intervalo: "siempre" }] };

    const { ok, reciboId } = await generarReciboParaFamilia(admin, {
      tenantId: TENANT_ID, familiaId: FAMILIA_ID, alumnosActivos, mes: 7, anio: 2026,
      concepto: "Julio 2026", descuentosPorAlumno,
    });

    assert.equal(ok, true);
    assert.notEqual(reciboId, "r-original");
    const recibo = reciboDe(admin, reciboId);
    assert.equal(recibo.total_descuento, 15, "el recibo nuevo refleja el descuento activo hoy, no el 0 del original");
  });
}
