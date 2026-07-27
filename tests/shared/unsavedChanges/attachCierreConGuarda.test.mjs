// attachCierreConGuarda() — envuelve un cierre para que pida confirmación
// (window.confirm inyectable, mismo patrón que el resto de acciones
// destructivas del proyecto) en vez de cerrar en silencio cuando hay
// cambios sin guardar.
export async function run({ test, assert }) {
  const { attachCierreConGuarda } = await import("../../../assets/shared/js/unsavedChanges/attachCierreConGuarda.js");
  const { createUnsavedChangesGuard } = await import("../../../assets/shared/js/unsavedChanges/unsavedChangesGuard.js");

  function fakeGuard(tieneCambios) {
    return { tieneCambiosSinGuardar: () => tieneCambios };
  }

  test("sin cambios sin guardar -> cierra directo, nunca pregunta, devuelve true", () => {
    let cerrado = false;
    let preguntado = false;
    const intentarCerrar = attachCierreConGuarda({
      guard: fakeGuard(false),
      cerrarFn: () => { cerrado = true; },
      confirmFn: () => { preguntado = true; return true; },
    });
    assert.equal(intentarCerrar(), true);
    assert.equal(cerrado, true);
    assert.equal(preguntado, false);
  });

  test("con cambios sin guardar y el usuario CONFIRMA -> cierra (descarta), devuelve true", () => {
    let cerrado = false;
    const intentarCerrar = attachCierreConGuarda({
      guard: fakeGuard(true),
      cerrarFn: () => { cerrado = true; },
      confirmFn: () => true,
    });
    assert.equal(intentarCerrar(), true);
    assert.equal(cerrado, true);
  });

  test("con cambios sin guardar y el usuario CANCELA -> NO cierra, nunca en silencio, devuelve false", () => {
    let cerrado = false;
    const intentarCerrar = attachCierreConGuarda({
      guard: fakeGuard(true),
      cerrarFn: () => { cerrado = true; },
      confirmFn: () => false,
    });
    assert.equal(intentarCerrar(), false);
    assert.equal(cerrado, false);
  });

  test("integración real con createUnsavedChangesGuard: editar y cancelar mantiene el drawer abierto", () => {
    let valor = "inicial";
    const guard = createUnsavedChangesGuard({ getSnapshot: () => valor });
    guard.marcarLimpio();
    let cerrado = false;
    const intentarCerrar = attachCierreConGuarda({
      guard, cerrarFn: () => { cerrado = true; }, confirmFn: () => false,
    });

    valor = "editado";
    assert.equal(intentarCerrar(), false, "hay cambios y el usuario canceló -> sigue abierto");
    assert.equal(cerrado, false);
  });

  test("el valor de retorno permite a un drawer padre (task-picker) decidir si cierra también su propio nivel", () => {
    // Simula exactamente el caso real: closeTaskPickerDrawer() solo debe
    // cerrar su propio nivel si el hijo (bulk-grade-drawer) realmente cerró.
    let cerroHijo = false;
    const intentarCerrarHijo = attachCierreConGuarda({
      guard: fakeGuard(true), cerrarFn: () => { cerroHijo = true; }, confirmFn: () => false,
    });

    let cerroPadre = false;
    function cerrarPadreSiElHijoLoPermite() {
      if (!intentarCerrarHijo()) return;
      cerroPadre = true;
    }
    cerrarPadreSiElHijoLoPermite();
    assert.equal(cerroHijo, false);
    assert.equal(cerroPadre, false, "el padre tampoco debe cerrarse si el hijo canceló");
  });
}
