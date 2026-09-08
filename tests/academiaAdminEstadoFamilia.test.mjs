// Qué le queda por enviar a una familia este mes.
//
// LO QUE DECIDE SI UN RECIBO ESTÁ ENVIADO ES `fecha_envio`, NO EL ESTADO
// (auditoría del 08/09/2026). El estado no sirve para esto en ninguna de las
// dos direcciones:
//   - "pagado" NO significa sin enviar: enviar no puede deshacer un cobro
//     (estadoEnvio.js), así que el flujo normal —generar, enviar, cobrar—
//     deja el recibo en "pagado" habiéndose enviado.
//   - "pagado" TAMPOCO significa enviado: un recibo se puede marcar como
//     cobrado en mano sin haberlo mandado nunca (marcarPago.js).
export async function run({ test, assert }) {
  const { familiaPendienteParaTipo, calcularEstadoFamilia } =
    await import("../assets/academia/admin/js/sections/envioFamilias/estadoFamilia.js");

  // `enviado` = tiene fecha_envio. El estado se pasa aparte porque son cosas
  // distintas y el test tiene que poder combinarlas libremente.
  function item({ reciboEstado = null, enviado = false, alumnos = [] } = {}) {
    return {
      familia_email: "familia@example.com",
      recibo: reciboEstado
        ? { estado: reciboEstado, fecha_envio: enviado ? "2026-07-01T00:00:00.000Z" : null }
        : null,
      alumnos_activos: alumnos,
    };
  }

  const alumnoPendiente = { id: "a1", tiene_sesiones: true, informe_enviado_at: null };
  const alumnoEnviado = { id: "a2", tiene_sesiones: true, informe_enviado_at: "2026-07-01T00:00:00.000Z" };

  test("completo: recibo pendiente O informe pendiente cuentan", () => {
    assert.equal(familiaPendienteParaTipo(item({ reciboEstado: "borrador" }), "completo"), true);
    assert.equal(familiaPendienteParaTipo(item({ alumnos: [alumnoPendiente] }), "completo"), true);
    assert.equal(familiaPendienteParaTipo(item({ reciboEstado: "enviado", enviado: true, alumnos: [alumnoEnviado] }), "completo"), false);
  });

  test("solo_recibo: solo cuenta el recibo pendiente, ignora informes pendientes", () => {
    assert.equal(familiaPendienteParaTipo(item({ reciboEstado: "borrador", alumnos: [alumnoEnviado] }), "solo_recibo"), true);
    assert.equal(familiaPendienteParaTipo(item({ reciboEstado: "enviado", enviado: true, alumnos: [alumnoPendiente] }), "solo_recibo"), false);
  });

  test("solo_informe: solo cuenta el informe pendiente, ignora el recibo pendiente", () => {
    assert.equal(familiaPendienteParaTipo(item({ reciboEstado: "enviado", enviado: true, alumnos: [alumnoPendiente] }), "solo_informe"), true);
    assert.equal(familiaPendienteParaTipo(item({ reciboEstado: "borrador", alumnos: [alumnoEnviado] }), "solo_informe"), false);
  });

  test("sin recibo y sin alumnos con sesiones -> nunca pendiente para ningún tipo", () => {
    assert.equal(familiaPendienteParaTipo(item(), "completo"), false);
    assert.equal(familiaPendienteParaTipo(item(), "solo_recibo"), false);
    assert.equal(familiaPendienteParaTipo(item(), "solo_informe"), false);
  });

  test("REGRESIÓN: un recibo COBRADO después de enviarlo no vuelve a 'Pendiente'", () => {
    // El flujo normal es generar → enviar → cobrar, y al cobrar el estado
    // pasa a "pagado". Con la regla vieja (estado !== "enviado") la familia
    // volvía al punto naranja dos semanas después de recibir el email, y
    // "Enviar a todos" chocaba con la política de no reenviar: la familia
    // acababa en rojo y su informe no salía.
    const cobradoYEnviado = item({ reciboEstado: "pagado", enviado: true, alumnos: [alumnoEnviado] });
    assert.equal(familiaPendienteParaTipo(cobradoYEnviado, "completo"), false);
    assert.equal(calcularEstadoFamilia(cobradoYEnviado).tipo, "enviado");
  });

  test("REGRESIÓN: un recibo cobrado EN MANO, sin enviar nunca, SIGUE pendiente", () => {
    // El contrapeso, y por qué no vale con tratar "pagado" como enviado:
    // marcarPago deja en "pagado" un recibo que nunca salió por email. Si
    // esa familia desapareciera de la lista, no recibiría su recibo jamás.
    const cobradoSinEnviar = item({ reciboEstado: "pagado", enviado: false });
    assert.equal(familiaPendienteParaTipo(cobradoSinEnviar, "completo"), true);
    assert.equal(familiaPendienteParaTipo(cobradoSinEnviar, "solo_recibo"), true);
  });
}