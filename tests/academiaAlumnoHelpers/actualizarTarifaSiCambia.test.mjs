// REGRESIÓN: PUT /alumnos/:id cerraba la tarifa vigente e insertaba una
// nueva SIEMPRE, sin comparar, y el drawer manda la tarifa en cada guardado
// aunque no se haya tocado. Abrir una ficha para corregir un teléfono y
// guardar dejaba una fila cerrada y otra abierta con el mismo precio y la
// misma fecha; tres guardados el mismo día, tres filas basura.
//
// Es el mismo bug que ya se arregló para el horario
// (actualizarHorarioSiCambia) y que aquí se había quedado sin arreglar.
export async function run({ test, assert }) {
  const { actualizarTarifaSiCambia, tarifaSinCambios } = await import(
    "../../server/lib/academiaAlumnoHelpers.js"
  );

  // Registra qué operaciones se piden, para poder afirmar que NO se tocó nada.
  function makeAdmin({ vigente = null, cerrarError = null, insertError = null } = {}) {
    const ops = [];
    return {
      ops,
      from(tabla) {
        const q = {
          select() { return q; },
          eq() { return q; },
          is() { return q; },
          maybeSingle: async () => ({ data: vigente, error: null }),
          update(valores) {
            ops.push({ op: "cerrar", tabla, fecha_fin: valores.fecha_fin });
            return { eq: () => ({ eq: () => ({ is: async () => ({ error: cerrarError }) }) }) };
          },
          insert(fila) {
            ops.push({ op: "insertar", tabla, fila });
            return { select: () => ({ single: async () => ({ data: { id: "nueva" }, error: insertError }) }) };
          },
        };
        return q;
      },
    };
  }

  test("tarifaSinCambios: mismo precio y mismo descuento -> sin cambios", () => {
    assert.equal(tarifaSinCambios({ precio_bruto: 100, descuento_pct: 10 }, { precio_bruto: 100, descuento_pct: 10 }), true);
    assert.equal(tarifaSinCambios({ precio_bruto: 100, descuento_pct: 0 }, { precio_bruto: 100 }), true, "0 y ausente son lo mismo");
    assert.equal(tarifaSinCambios({ precio_bruto: "100", descuento_pct: "10" }, { precio_bruto: 100, descuento_pct: 10 }), true, "numeric de Postgres llega como string");
  });

  test("tarifaSinCambios: cambia el precio o el descuento -> sí hay cambio", () => {
    assert.equal(tarifaSinCambios({ precio_bruto: 100, descuento_pct: 10 }, { precio_bruto: 120, descuento_pct: 10 }), false);
    assert.equal(tarifaSinCambios({ precio_bruto: 100, descuento_pct: 10 }, { precio_bruto: 100, descuento_pct: 15 }), false);
  });

  test("tarifaSinCambios: sin tarifa vigente -> hay que insertar", () => {
    assert.equal(tarifaSinCambios(null, { precio_bruto: 100 }), false);
  });

  test("REGRESIÓN: guardar sin tocar la tarifa no escribe NADA", async () => {
    const admin = makeAdmin({ vigente: { id: "t1", precio_bruto: 100, descuento_pct: 10 } });
    const res = await actualizarTarifaSiCambia(admin, "tenant", "a1", { precio_bruto: 100, descuento_pct: 10 }, "2026-09-08");
    assert.equal(res.error, null);
    assert.equal(res.cambiado, false);
    assert.deepEqual(admin.ops, [], "ni cierre ni inserción");
  });

  test("cambiar el precio sí cierra la vigente e inserta la nueva, en ese orden", async () => {
    const admin = makeAdmin({ vigente: { id: "t1", precio_bruto: 100, descuento_pct: 0 } });
    const res = await actualizarTarifaSiCambia(admin, "tenant", "a1", { precio_bruto: 120, descuento_pct: 0 }, "2026-09-08");
    assert.equal(res.cambiado, true);
    assert.deepEqual(admin.ops.map((o) => o.op), ["cerrar", "insertar"]);
    assert.equal(admin.ops[0].fecha_fin, "2026-09-08");
    assert.equal(admin.ops[1].fila.fecha_inicio, "2026-09-08");
  });

  test("alumno sin tarifa previa -> inserta sin cerrar nada que no existe", async () => {
    const admin = makeAdmin({ vigente: null });
    const res = await actualizarTarifaSiCambia(admin, "tenant", "a1", { precio_bruto: 100 }, "2026-09-08");
    assert.equal(res.cambiado, true);
    assert.ok(admin.ops.some((o) => o.op === "insertar"));
  });

  test("si falla el cierre se dice en qué paso, y no se inserta encima", async () => {
    const admin = makeAdmin({ vigente: { precio_bruto: 100 }, cerrarError: { message: "boom" } });
    const res = await actualizarTarifaSiCambia(admin, "tenant", "a1", { precio_bruto: 120 }, "2026-09-08");
    assert.equal(res.paso, "cerrar");
    assert.equal(res.cambiado, false);
    assert.deepEqual(admin.ops.map((o) => o.op), ["cerrar"], "no se inserta si el cierre falló");
  });

  test("si falla la inserción se identifica ese paso — el alumno quedaría sin tarifa vigente", async () => {
    const admin = makeAdmin({ vigente: { precio_bruto: 100 }, insertError: { message: "boom" } });
    const res = await actualizarTarifaSiCambia(admin, "tenant", "a1", { precio_bruto: 120 }, "2026-09-08");
    assert.equal(res.paso, "insertar");
    assert.equal(res.cambiado, false);
  });
}
