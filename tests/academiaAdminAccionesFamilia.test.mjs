function errorRequiereConfirmacion(details) {
  const err = new Error("requiere confirmación");
  err.code = "requiere_confirmacion";
  err.details = details;
  return err;
}

function itemFixture({ reciboId = "r1", reciboEstado = "borrador", alumnos = [{ id: "a1", nombre: "Ana" }, { id: "a2", nombre: "Luis" }] } = {}) {
  return {
    familia_id: "f1",
    recibo: reciboId ? { id: reciboId, estado: reciboEstado, fecha_envio: reciboEstado !== "borrador" ? "2026-07-01T00:00:00.000Z" : null } : null,
    alumnos_activos: alumnos,
  };
}

function fakesRegenerarOk() {
  const llamadas = { regenerarRecibo: [], generarReciboFamilia: [], generarInforme: [] };
  return {
    llamadas,
    regenerarReciboFn: async (id, confirmar) => { llamadas.regenerarRecibo.push({ id, confirmar }); return { reciboId: id }; },
    generarReciboFamiliaFn: async (args) => { llamadas.generarReciboFamilia.push(args); return { reciboId: "r-nuevo" }; },
    generarInformeFn: async (args) => { llamadas.generarInforme.push(args); return { ok: true }; },
  };
}

function fakesEnviarOk() {
  const llamadas = { enviarFamilia: [], enviarInforme: [] };
  return {
    llamadas,
    enviarFamiliaFn: async (args) => { llamadas.enviarFamilia.push(args); return { enviado: true }; },
    enviarInformeFn: async (args) => { llamadas.enviarInforme.push(args); return { enviado: true }; },
  };
}

export async function run({ test, assert }) {
  const { regenerarFamilia, enviarFamiliaAccion } = await import(
    "../assets/academia/admin/js/sections/envioFamilias/acciones/accionesFamilia.js"
  );

  test("regenerar 'completo' -> regenera el recibo Y el informe de cada alumno activo", async () => {
    const item = itemFixture();
    const fakes = fakesRegenerarOk();
    await regenerarFamilia({ tipo: "completo" }, { item, mes: 7, anio: 2026, ...fakes });

    assert.deepEqual(fakes.llamadas.regenerarRecibo, [{ id: "r1", confirmar: false }]);
    assert.deepEqual(fakes.llamadas.generarInforme.map((c) => c.alumno_id), ["a1", "a2"]);
    assert.ok(fakes.llamadas.generarInforme.every((c) => c.forzar === true));
  });

  test("regenerar 'solo_recibo' -> SOLO el recibo, no toca ningún informe", async () => {
    const item = itemFixture();
    const fakes = fakesRegenerarOk();
    await regenerarFamilia({ tipo: "solo_recibo" }, { item, mes: 7, anio: 2026, ...fakes });

    assert.equal(fakes.llamadas.regenerarRecibo.length, 1);
    assert.equal(fakes.llamadas.generarInforme.length, 0);
  });

  test("regenerar 'solo_informe' -> SOLO los informes de todos los alumnos activos, no toca el recibo", async () => {
    const item = itemFixture();
    const fakes = fakesRegenerarOk();
    await regenerarFamilia({ tipo: "solo_informe" }, { item, mes: 7, anio: 2026, ...fakes });

    assert.equal(fakes.llamadas.regenerarRecibo.length, 0);
    assert.equal(fakes.llamadas.generarReciboFamilia.length, 0);
    assert.deepEqual(fakes.llamadas.generarInforme.map((c) => c.alumno_id), ["a1", "a2"]);
  });

  test("regenerar 'informe_alumno' -> llama SOLO al endpoint individual de ESE alumno, nunca a regenerarRecibo/generarInforme de otros", async () => {
    const item = itemFixture();
    const fakes = fakesRegenerarOk();
    await regenerarFamilia(
      { tipo: "informe_alumno", alumnoId: "a2", alumnoNombre: "Luis" },
      { item, mes: 7, anio: 2026, ...fakes }
    );

    assert.equal(fakes.llamadas.regenerarRecibo.length, 0, "informe_alumno no debe tocar el recibo");
    assert.deepEqual(fakes.llamadas.generarInforme, [{ alumno_id: "a2", mes: 7, anio: 2026, forzar: true, confirmar: false }]);
  });

  test("regenerar 'completo' sin recibo existente -> usa generarReciboFamiliaFn (crear), no regenerarReciboFn", async () => {
    const item = itemFixture({ reciboId: null });
    const fakes = fakesRegenerarOk();
    await regenerarFamilia({ tipo: "completo" }, { item, mes: 7, anio: 2026, ...fakes });

    assert.equal(fakes.llamadas.regenerarRecibo.length, 0);
    assert.equal(fakes.llamadas.generarReciboFamilia.length, 1);
  });

  test("regenerar: recibo ya enviado + el usuario cancela el aviso -> no llega a regenerar los informes", async () => {
    const item = itemFixture({ reciboEstado: "enviado" });
    const fakes = fakesRegenerarOk();
    fakes.regenerarReciboFn = async () => { throw errorRequiereConfirmacion({ estado: "enviado", fecha_envio: "2026-07-01T00:00:00.000Z" }); };

    await assert.rejects(
      () => regenerarFamilia({ tipo: "completo" }, { item, mes: 7, anio: 2026, confirmFn: () => false, ...fakes }),
      (err) => err.code === "cancelado"
    );
    assert.equal(fakes.llamadas.generarInforme.length, 0);
  });

  test("enviar 'completo'/'solo_recibo'/'solo_informe' -> UNA sola llamada a enviarFamiliaFn con ese tipo tal cual", async () => {
    const item = itemFixture();
    for (const tipo of ["completo", "solo_recibo", "solo_informe"]) {
      const fakes = fakesEnviarOk();
      await enviarFamiliaAccion({ tipo }, { item, mes: 7, anio: 2026, ...fakes });
      assert.deepEqual(fakes.llamadas.enviarFamilia, [{ familia_id: "f1", mes: 7, anio: 2026, tipo, confirmar: false }]);
      assert.equal(fakes.llamadas.enviarInforme.length, 0);
    }
  });

  test("enviar 'informe_alumno' -> llama SOLO al endpoint individual de informe, NUNCA a enviarFamiliaFn", async () => {
    const item = itemFixture();
    const fakes = fakesEnviarOk();
    await enviarFamiliaAccion({ tipo: "informe_alumno", alumnoId: "a1", alumnoNombre: "Ana" }, { item, mes: 7, anio: 2026, ...fakes });

    assert.equal(fakes.llamadas.enviarFamilia.length, 0, "informe_alumno no debe llamar al endpoint de familia");
    assert.deepEqual(fakes.llamadas.enviarInforme, [{ alumno_id: "a1", mes: 7, anio: 2026, confirmar: false }]);
  });
}
