function errorRequiereConfirmacion(details) {
  const err = new Error("requiere confirmación");
  err.code = "requiere_confirmacion";
  err.details = details;
  return err;
}

export async function run({ test, assert }) {
  const { confirmarYEjecutar } = await import("../assets/academia/admin/js/sections/envioFamilias/confirmarYEjecutar.js");

  test("sin requiere_confirmacion -> llama fn(false) una vez y devuelve su resultado", async () => {
    const llamadas = [];
    const resultado = await confirmarYEjecutar((confirmar) => { llamadas.push(confirmar); return Promise.resolve({ ok: true }); });
    assert.deepEqual(llamadas, [false]);
    assert.deepEqual(resultado, { ok: true });
  });

  test("requiere_confirmacion + el usuario acepta -> reintenta con fn(true) y devuelve ese resultado", async () => {
    const llamadas = [];
    let primero = true;
    const resultado = await confirmarYEjecutar(
      (confirmar) => {
        llamadas.push(confirmar);
        if (primero) { primero = false; throw errorRequiereConfirmacion({ afectados: 2 }); }
        return { ok: true };
      },
      {
        mensajeConfirmacion: (details) => `${details.afectados} afectados. ¿Continuar?`,
        confirmFn: (mensaje) => { assert.equal(mensaje, "2 afectados. ¿Continuar?"); return true; },
      }
    );
    assert.deepEqual(llamadas, [false, true]);
    assert.deepEqual(resultado, { ok: true });
  });

  test("requiere_confirmacion + el usuario cancela -> lanza un error con code 'cancelado', no reintenta", async () => {
    const llamadas = [];
    await assert.rejects(
      () => confirmarYEjecutar(
        (confirmar) => { llamadas.push(confirmar); throw errorRequiereConfirmacion({ afectados: 1 }); },
        { confirmFn: () => false }
      ),
      (err) => err.code === "cancelado"
    );
    assert.deepEqual(llamadas, [false]);
  });

  test("un error normal (sin requiere_confirmacion) se relanza tal cual, sin tocar confirmFn", async () => {
    let confirmFnLlamado = false;
    await assert.rejects(
      () => confirmarYEjecutar(
        () => { throw new Error("fallo de red"); },
        { confirmFn: () => { confirmFnLlamado = true; return true; } }
      ),
      (err) => err.message === "fallo de red"
    );
    assert.equal(confirmFnLlamado, false);
  });

  test("sin mensajeConfirmacion/confirmFn explícitos -> usa los valores por defecto sin reventar", async () => {
    const original = globalThis.window;
    globalThis.window = { confirm: () => false };
    try {
      await assert.rejects(
        () => confirmarYEjecutar(() => { throw errorRequiereConfirmacion({}); }),
        (err) => err.code === "cancelado"
      );
    } finally {
      globalThis.window = original;
    }
  });
}
