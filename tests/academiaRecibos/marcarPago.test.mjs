// marcarPago.js no tenía ningún test pese a ser toda la máquina de estados
// del cobro. Estos casos fijan las dos reglas que estaban rotas:
//
//   A) Cobrar no depende de que el PDF se pueda generar. Antes, con
//      "enviar al pagar" activado, un fallo del microservicio hacía salir
//      la función SIN escribir nada: el admin no podía registrar un pago
//      que ya tenía en el banco.
//   B) Enviar no puede deshacer un cobro (ver estadoEnvio.js).
function makeAdmin({ recibo, updateError = null }) {
  const updates = [];
  return {
    updates,
    from() {
      const q = {
        select() { return q; },
        eq() { return q; },
        maybeSingle: async () => ({ data: recibo, error: null }),
        update(valores) { updates.push(valores); return { eq: () => ({ eq: async () => ({ error: updateError }) }) }; },
      };
      return q;
    },
  };
}

export async function run({ test, assert }) {
  const { marcarReciboPagado } = await import("../../server/lib/academiaRecibos/marcarPago.js");
  const { estadoTrasEnvio } = await import("../../server/lib/academiaRecibos/estadoEnvio.js");

  test("estadoTrasEnvio: un recibo pagado sigue pagado tras reenviarlo", () => {
    assert.equal(estadoTrasEnvio("pagado"), "pagado");
  });

  test("estadoTrasEnvio: borrador y enviado pasan a enviado", () => {
    assert.equal(estadoTrasEnvio("borrador"), "enviado");
    assert.equal(estadoTrasEnvio("enviado"), "enviado");
  });

  test("REGRESIÓN: el pago se registra aunque falle el envío del recibo", async () => {
    const admin = makeAdmin({ recibo: { id: "r1", estado: "borrador" } });
    const res = await marcarReciboPagado(admin, {
      tenantId: "t1", reciboId: "r1", tenantNombre: "Lyceo",
      pdfServiceUrl: "http://pdf", enviarAlPagar: true,
      enviarReciboPorIdFn: async () => ({ ok: false, motivo: "El servicio de PDF no responde." }),
    });

    assert.equal(res.ok, true, "el cobro debe quedar registrado pese al fallo de envío");
    assert.equal(res.avisoEnvio, "El servicio de PDF no responde.");
    assert.deepEqual(
      admin.updates.map((u) => u.estado),
      ["pagado"],
      "debe haberse escrito estado=pagado"
    );
    assert.ok(admin.updates[0].fecha_pago, "y la fecha de pago");
  });

  test("con envío correcto no hay aviso", async () => {
    const admin = makeAdmin({ recibo: { id: "r1", estado: "borrador" } });
    const res = await marcarReciboPagado(admin, {
      tenantId: "t1", reciboId: "r1", enviarAlPagar: true,
      enviarReciboPorIdFn: async () => ({ ok: true }),
    });
    assert.equal(res.ok, true);
    assert.equal(res.avisoEnvio, undefined);
  });

  test("el envío se pide con confirmar:true — si no, forward-only lo bloquearía", async () => {
    const admin = makeAdmin({ recibo: { id: "r1", estado: "borrador" } });
    let recibido = null;
    await marcarReciboPagado(admin, {
      tenantId: "t1", reciboId: "r1", enviarAlPagar: true,
      enviarReciboPorIdFn: async (_admin, args) => { recibido = args; return { ok: true }; },
    });
    assert.equal(recibido.confirmar, true);
  });

  test("un recibo ya enviado no se reenvía al marcarlo pagado", async () => {
    const admin = makeAdmin({ recibo: { id: "r1", estado: "enviado" } });
    let llamado = false;
    const res = await marcarReciboPagado(admin, {
      tenantId: "t1", reciboId: "r1", enviarAlPagar: true,
      enviarReciboPorIdFn: async () => { llamado = true; return { ok: true }; },
    });
    assert.equal(res.ok, true);
    assert.equal(llamado, false, "yaEnviado se calcula antes del UPDATE");
  });

  test("sin enviar_recibo_al_pagar no se intenta ningún envío", async () => {
    const admin = makeAdmin({ recibo: { id: "r1", estado: "borrador" } });
    let llamado = false;
    await marcarReciboPagado(admin, {
      tenantId: "t1", reciboId: "r1", enviarAlPagar: false,
      enviarReciboPorIdFn: async () => { llamado = true; return { ok: true }; },
    });
    assert.equal(llamado, false);
  });

  test("si el UPDATE del pago falla, sí se devuelve error y no se envía nada", async () => {
    const admin = makeAdmin({ recibo: { id: "r1", estado: "borrador" }, updateError: { message: "boom" } });
    let llamado = false;
    const res = await marcarReciboPagado(admin, {
      tenantId: "t1", reciboId: "r1", enviarAlPagar: true,
      enviarReciboPorIdFn: async () => { llamado = true; return { ok: true }; },
    });
    assert.equal(res.ok, false);
    assert.equal(res.motivo, "No se pudo marcar como pagado.");
    assert.equal(llamado, false);
  });

  test("recibo inexistente -> error claro, sin escrituras", async () => {
    const admin = makeAdmin({ recibo: null });
    const res = await marcarReciboPagado(admin, { tenantId: "t1", reciboId: "r1", enviarAlPagar: true });
    assert.equal(res.ok, false);
    assert.equal(res.motivo, "Recibo no encontrado.");
    assert.deepEqual(admin.updates, []);
  });
}
