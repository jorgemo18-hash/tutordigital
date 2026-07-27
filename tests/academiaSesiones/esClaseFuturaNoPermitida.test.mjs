// esClaseFuturaNoPermitida() — POST /api/v1/academia/sesiones rechaza con
// 422 una CLASE en fecha futura (no ha ocurrido todavía), pero permite
// marcar una AUSENCIA anticipada (la familia avisa con antelación). El
// frontend ya no deja llegar hasta aquí en el caso bloqueado (ver
// diarioDrawerBody.js#buildClaseBodyFutura), pero la validación real no
// puede vivir solo en el cliente.
export async function run({ test, assert }) {
  const { esClaseFuturaNoPermitida } = await import("../../server/routes/v1/academia.sesiones.routes.js");

  const HOY = "2026-07-26";
  const FUTURO = "2026-08-15";
  const PASADO = "2026-07-01";

  test("ausencia en fecha futura -> permitida", () => {
    assert.equal(esClaseFuturaNoPermitida("ausencia", FUTURO, HOY), false);
  });

  test("clase en fecha futura -> bloqueada", () => {
    assert.equal(esClaseFuturaNoPermitida("clase", FUTURO, HOY), true);
  });

  test("clase en el pasado -> permitida (comportamiento de siempre)", () => {
    assert.equal(esClaseFuturaNoPermitida("clase", PASADO, HOY), false);
  });

  test("ausencia en el pasado -> permitida", () => {
    assert.equal(esClaseFuturaNoPermitida("ausencia", PASADO, HOY), false);
  });

  test("clase HOY mismo -> permitida (hoy no cuenta como futuro)", () => {
    assert.equal(esClaseFuturaNoPermitida("clase", HOY, HOY), false);
  });

  test("ausencia HOY mismo -> permitida", () => {
    assert.equal(esClaseFuturaNoPermitida("ausencia", HOY, HOY), false);
  });
}
