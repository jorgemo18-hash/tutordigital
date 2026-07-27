// createUnsavedChangesGuard() — helper compartido para que los drawers no
// reimplementen cada uno su propio "¿ha cambiado algo?".
export async function run({ test, assert }) {
  const { createUnsavedChangesGuard } = await import("../../../assets/shared/js/unsavedChanges/unsavedChangesGuard.js");

  test("antes de marcarLimpio() -> tieneCambiosSinGuardar es false (nada que comparar todavía)", () => {
    const guard = createUnsavedChangesGuard({ getSnapshot: () => ({ nombre: "" }) });
    assert.equal(guard.tieneCambiosSinGuardar(), false);
  });

  test("tras marcarLimpio(), sin tocar nada -> false", () => {
    let valor = { nombre: "Ana" };
    const guard = createUnsavedChangesGuard({ getSnapshot: () => valor });
    guard.marcarLimpio();
    assert.equal(guard.tieneCambiosSinGuardar(), false);
  });

  test("tras marcarLimpio(), si el snapshot cambia -> true", () => {
    let valor = { nombre: "Ana" };
    const guard = createUnsavedChangesGuard({ getSnapshot: () => valor });
    guard.marcarLimpio();
    valor = { nombre: "Ana Editada" };
    assert.equal(guard.tieneCambiosSinGuardar(), true);
  });

  test("volver al valor original tras editar -> false de nuevo (compara por valor, no por referencia)", () => {
    let valor = { nombre: "Ana" };
    const guard = createUnsavedChangesGuard({ getSnapshot: () => valor });
    guard.marcarLimpio();
    valor = { nombre: "Otra cosa" };
    assert.equal(guard.tieneCambiosSinGuardar(), true);
    valor = { nombre: "Ana" };
    assert.equal(guard.tieneCambiosSinGuardar(), false);
  });

  test("marcarLimpio() de nuevo (p.ej. tras guardar) resetea la base de comparación", () => {
    let valor = { nombre: "Ana" };
    const guard = createUnsavedChangesGuard({ getSnapshot: () => valor });
    guard.marcarLimpio();
    valor = { nombre: "Bea" };
    assert.equal(guard.tieneCambiosSinGuardar(), true);
    guard.marcarLimpio();
    assert.equal(guard.tieneCambiosSinGuardar(), false, "Bea es ahora el nuevo estado limpio");
  });
}
