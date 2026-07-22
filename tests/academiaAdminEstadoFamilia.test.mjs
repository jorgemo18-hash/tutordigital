export async function run({ test, assert }) {
  const { familiaPendienteParaTipo } = await import("../assets/academia/admin/js/sections/envioFamilias/estadoFamilia.js");

  function item({ reciboEstado = null, alumnos = [] } = {}) {
    return {
      familia_email: "familia@example.com",
      recibo: reciboEstado ? { estado: reciboEstado } : null,
      alumnos_activos: alumnos,
    };
  }

  const alumnoPendiente = { id: "a1", tiene_sesiones: true, informe_enviado_at: null };
  const alumnoEnviado = { id: "a2", tiene_sesiones: true, informe_enviado_at: "2026-07-01T00:00:00.000Z" };

  test("completo: recibo pendiente O informe pendiente cuentan", () => {
    assert.equal(familiaPendienteParaTipo(item({ reciboEstado: "borrador" }), "completo"), true);
    assert.equal(familiaPendienteParaTipo(item({ alumnos: [alumnoPendiente] }), "completo"), true);
    assert.equal(familiaPendienteParaTipo(item({ reciboEstado: "enviado", alumnos: [alumnoEnviado] }), "completo"), false);
  });

  test("solo_recibo: solo cuenta el recibo pendiente, ignora informes pendientes", () => {
    assert.equal(familiaPendienteParaTipo(item({ reciboEstado: "borrador", alumnos: [alumnoEnviado] }), "solo_recibo"), true);
    assert.equal(familiaPendienteParaTipo(item({ reciboEstado: "enviado", alumnos: [alumnoPendiente] }), "solo_recibo"), false);
  });

  test("solo_informe: solo cuenta el informe pendiente, ignora el recibo pendiente", () => {
    assert.equal(familiaPendienteParaTipo(item({ reciboEstado: "enviado", alumnos: [alumnoPendiente] }), "solo_informe"), true);
    assert.equal(familiaPendienteParaTipo(item({ reciboEstado: "borrador", alumnos: [alumnoEnviado] }), "solo_informe"), false);
  });

  test("sin recibo y sin alumnos con sesiones -> nunca pendiente para ningún tipo", () => {
    assert.equal(familiaPendienteParaTipo(item(), "completo"), false);
    assert.equal(familiaPendienteParaTipo(item(), "solo_recibo"), false);
    assert.equal(familiaPendienteParaTipo(item(), "solo_informe"), false);
  });
}
