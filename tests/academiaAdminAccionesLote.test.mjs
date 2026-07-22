function errorRequiereConfirmacion(details) {
  const err = new Error("requiere confirmación");
  err.code = "requiere_confirmacion";
  err.details = details;
  return err;
}

function fakesOk() {
  const llamadas = { regenerarRecibos: [], generarRecibos: [], regenerarInformes: [] };
  return {
    llamadas,
    regenerarRecibosFn: async (args) => { llamadas.regenerarRecibos.push(args); return { fallidos: 0 }; },
    generarRecibosFn: async (args) => { llamadas.generarRecibos.push(args); return { generados: 1, fallidos: 0 }; },
    regenerarInformesFn: async (args) => { llamadas.regenerarInformes.push(args); return { fallidos: 0 }; },
  };
}

export async function run({ test, assert }) {
  const { regenerarLote } = await import("../assets/academia/admin/js/sections/envioFamilias/acciones/accionesLote.js");

  test("tipo 'solo_recibo' -> solo llama a regenerarRecibos, NUNCA a regenerarInformes", async () => {
    const fakes = fakesOk();
    await regenerarLote("solo_recibo", { mes: 7, anio: 2026, hayRecibosEnPeriodo: true, ...fakes });
    assert.equal(fakes.llamadas.regenerarRecibos.length, 1);
    assert.equal(fakes.llamadas.regenerarInformes.length, 0, "solo_recibo no debe arrastrar informes");
  });

  test("tipo 'solo_informe' -> solo llama a regenerarInformes, NUNCA a regenerarRecibos/generarRecibos", async () => {
    const fakes = fakesOk();
    await regenerarLote("solo_informe", { mes: 7, anio: 2026, hayRecibosEnPeriodo: true, ...fakes });
    assert.equal(fakes.llamadas.regenerarInformes.length, 1);
    assert.equal(fakes.llamadas.regenerarRecibos.length, 0);
    assert.equal(fakes.llamadas.generarRecibos.length, 0);
  });

  test("tipo 'completo' -> llama a ambos, recibos primero", async () => {
    const orden = [];
    const fakes = fakesOk();
    fakes.regenerarRecibosFn = async (args) => { orden.push("recibos"); fakes.llamadas.regenerarRecibos.push(args); return { fallidos: 0 }; };
    fakes.regenerarInformesFn = async (args) => { orden.push("informes"); fakes.llamadas.regenerarInformes.push(args); return { fallidos: 0 }; };

    await regenerarLote("completo", { mes: 7, anio: 2026, hayRecibosEnPeriodo: true, ...fakes });

    assert.equal(fakes.llamadas.regenerarRecibos.length, 1);
    assert.equal(fakes.llamadas.regenerarInformes.length, 1);
    assert.deepEqual(orden, ["recibos", "informes"]);
  });

  test("sin recibos en el período -> usa generarRecibosFn en vez de regenerarRecibosFn", async () => {
    const fakes = fakesOk();
    await regenerarLote("solo_recibo", { mes: 7, anio: 2026, hayRecibosEnPeriodo: false, ...fakes });
    assert.equal(fakes.llamadas.generarRecibos.length, 1);
    assert.equal(fakes.llamadas.regenerarRecibos.length, 0);
  });

  test("requiere_confirmacion en recibos + el usuario cancela -> NO llega a intentar los informes", async () => {
    const fakes = fakesOk();
    fakes.regenerarRecibosFn = async () => { throw errorRequiereConfirmacion({ afectados: 2 }); };
    await assert.rejects(
      () => regenerarLote("completo", { mes: 7, anio: 2026, hayRecibosEnPeriodo: true, confirmFn: () => false, ...fakes }),
      (err) => err.code === "cancelado"
    );
    assert.equal(fakes.llamadas.regenerarInformes.length, 0);
  });

  test("agrega los 'fallidos' de recibos e informes en el resultado final", async () => {
    const fakes = fakesOk();
    fakes.regenerarRecibosFn = async () => ({ fallidos: 2 });
    fakes.regenerarInformesFn = async () => ({ fallidos: 3 });
    const resultado = await regenerarLote("completo", { mes: 7, anio: 2026, hayRecibosEnPeriodo: true, ...fakes });
    assert.deepEqual(resultado, { fallidos: 5 });
  });
}
