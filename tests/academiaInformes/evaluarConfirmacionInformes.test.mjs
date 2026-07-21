// evaluarConfirmacionInformes() — política forward-only: función pura, sin
// admin ni mocks, decide si regenerar un lote de informes necesita
// confirmación explícita porque alguno ya está enviado.

export async function run({ test, assert }) {
  const { evaluarConfirmacionInformes } = await import("../../server/lib/academiaInformes/confirmacionRegenerar.js");

  test("ninguno enviado -> nunca requiere confirmación", () => {
    const informesEnviados = { a1: null, a2: null };
    const r = evaluarConfirmacionInformes(informesEnviados, ["a1", "a2"], false);
    assert.equal(r.requiereConfirmacion, false);
  });

  test("alguno enviado y no se confirmó -> requiere confirmación con el conteo correcto", () => {
    const informesEnviados = { a1: "2026-07-01T10:00:00.000Z", a2: null, a3: "2026-07-02T10:00:00.000Z" };
    const r = evaluarConfirmacionInformes(informesEnviados, ["a1", "a2", "a3"], false);
    assert.equal(r.requiereConfirmacion, true);
    assert.equal(r.afectados, 2);
  });

  test("alguno enviado pero confirmar:true -> procede sin pedir nada", () => {
    const informesEnviados = { a1: "2026-07-01T10:00:00.000Z" };
    const r = evaluarConfirmacionInformes(informesEnviados, ["a1"], true);
    assert.equal(r.requiereConfirmacion, false);
  });

  test("alumno sin fila en informesEnviados (nunca generado) se trata como no enviado", () => {
    const r = evaluarConfirmacionInformes({}, ["a1"], false);
    assert.equal(r.requiereConfirmacion, false);
    assert.equal(r.afectados, 0);
  });
}
