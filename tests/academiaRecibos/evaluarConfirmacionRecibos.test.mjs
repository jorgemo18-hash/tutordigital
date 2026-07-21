// evaluarConfirmacionRecibos() — política forward-only: función pura, sin
// admin ni mocks, decide si regenerar un lote de recibos necesita
// confirmación explícita porque alguno ya está enviado/pagado.

export async function run({ test, assert }) {
  const { evaluarConfirmacionRecibos } = await import("../../server/lib/academiaRecibos/confirmacionRegenerar.js");

  test("todos en borrador -> nunca requiere confirmación", () => {
    const recibos = [{ id: "r1", estado: "borrador" }, { id: "r2", estado: "borrador" }];
    const r = evaluarConfirmacionRecibos(recibos, false);
    assert.equal(r.requiereConfirmacion, false);
  });

  test("hay enviados/pagados y no se confirmó -> requiere confirmación con el conteo correcto", () => {
    const recibos = [
      { id: "r1", estado: "borrador" },
      { id: "r2", estado: "enviado" },
      { id: "r3", estado: "pagado" },
    ];
    const r = evaluarConfirmacionRecibos(recibos, false);
    assert.equal(r.requiereConfirmacion, true);
    assert.equal(r.afectados, 2);
  });

  test("hay enviados/pagados pero confirmar:true -> procede sin pedir nada", () => {
    const recibos = [{ id: "r1", estado: "enviado" }, { id: "r2", estado: "pagado" }];
    const r = evaluarConfirmacionRecibos(recibos, true);
    assert.equal(r.requiereConfirmacion, false);
  });

  test("lista vacía -> nunca requiere confirmación", () => {
    const r = evaluarConfirmacionRecibos([], false);
    assert.equal(r.requiereConfirmacion, false);
    assert.equal(r.afectados, 0);
  });
}
