export async function run({ test, assert }) {
  const { evaluarConfirmacionEnvioFamilia } = await import("../../server/lib/academiaEnvio/confirmacionEnvioFamilia.js");

  test("completo, nada enviado todavía -> no requiere confirmación", () => {
    const r = evaluarConfirmacionEnvioFamilia({
      reciboEstado: "borrador", informesEnviadosAt: [null, null], tipoEnvio: "completo", confirmar: false,
    });
    assert.deepEqual(r, { requiereConfirmacion: false, afectados: 0 });
  });

  test("completo, recibo ya enviado -> requiere confirmación, afectados: 1", () => {
    const r = evaluarConfirmacionEnvioFamilia({
      reciboEstado: "enviado", informesEnviadosAt: [null], tipoEnvio: "completo", confirmar: false,
    });
    assert.deepEqual(r, { requiereConfirmacion: true, afectados: 1 });
  });

  test("completo, 1 de 2 informes ya enviado -> afectados: 1", () => {
    const r = evaluarConfirmacionEnvioFamilia({
      reciboEstado: "borrador", informesEnviadosAt: ["2026-07-01T00:00:00.000Z", null], tipoEnvio: "completo", confirmar: false,
    });
    assert.deepEqual(r, { requiereConfirmacion: true, afectados: 1 });
  });

  test("completo, recibo pagado + 2 informes ya enviados -> afectados: 3 (se suman)", () => {
    const r = evaluarConfirmacionEnvioFamilia({
      reciboEstado: "pagado",
      informesEnviadosAt: ["2026-07-01T00:00:00.000Z", "2026-07-02T00:00:00.000Z"],
      tipoEnvio: "completo",
      confirmar: false,
    });
    assert.deepEqual(r, { requiereConfirmacion: true, afectados: 3 });
  });

  test("confirmar:true -> nunca requiere confirmación, pase lo que pase", () => {
    const r = evaluarConfirmacionEnvioFamilia({
      reciboEstado: "pagado", informesEnviadosAt: ["2026-07-01T00:00:00.000Z"], tipoEnvio: "completo", confirmar: true,
    });
    assert.equal(r.requiereConfirmacion, false);
  });

  test("solo_recibo: un informe ya enviado NO cuenta (no va en este envío)", () => {
    const r = evaluarConfirmacionEnvioFamilia({
      reciboEstado: "borrador", informesEnviadosAt: ["2026-07-01T00:00:00.000Z"], tipoEnvio: "solo_recibo", confirmar: false,
    });
    assert.deepEqual(r, { requiereConfirmacion: false, afectados: 0 });
  });

  test("solo_recibo: recibo ya enviado SÍ cuenta", () => {
    const r = evaluarConfirmacionEnvioFamilia({
      reciboEstado: "enviado", informesEnviadosAt: [], tipoEnvio: "solo_recibo", confirmar: false,
    });
    assert.deepEqual(r, { requiereConfirmacion: true, afectados: 1 });
  });

  test("solo_informe: recibo ya enviado NO cuenta (no va en este envío)", () => {
    const r = evaluarConfirmacionEnvioFamilia({
      reciboEstado: "pagado", informesEnviadosAt: [null], tipoEnvio: "solo_informe", confirmar: false,
    });
    assert.deepEqual(r, { requiereConfirmacion: false, afectados: 0 });
  });

  test("solo_informe: 2 de 3 informes ya enviados -> afectados: 2", () => {
    const r = evaluarConfirmacionEnvioFamilia({
      reciboEstado: "enviado",
      informesEnviadosAt: ["2026-07-01T00:00:00.000Z", "2026-07-02T00:00:00.000Z", null],
      tipoEnvio: "solo_informe",
      confirmar: false,
    });
    assert.deepEqual(r, { requiereConfirmacion: true, afectados: 2 });
  });

  test("reciboEstado null (familia sin recibo este mes) nunca protege", () => {
    const r = evaluarConfirmacionEnvioFamilia({
      reciboEstado: null, informesEnviadosAt: [], tipoEnvio: "completo", confirmar: false,
    });
    assert.deepEqual(r, { requiereConfirmacion: false, afectados: 0 });
  });
}
