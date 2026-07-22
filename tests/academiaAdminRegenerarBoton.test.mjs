import { Window } from "happy-dom";

// Entorno DOM (happy-dom), mismo patrón que academiaAdminDescuentosRecurrentesSection.test.mjs.
const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorRequiereConfirmacion(details) {
  const err = new Error("requiere confirmación");
  err.code = "requiere_confirmacion";
  err.details = details;
  return err;
}

export async function run({ test, assert }) {
  const { buildRegenerarBoton } = await import("../assets/academia/admin/js/sections/envioFamilias/regenerarBoton.js");

  test("ejecución exitosa sin aviso previo -> ejecutar se llama una vez con confirmar:false y el botón termina en '✓ Regenerado'", async () => {
    const llamadas = [];
    const btn = buildRegenerarBoton({
      textoIdle: "Regenerar",
      ejecutar: async (confirmar) => { llamadas.push(confirmar); return { ok: true }; },
      mensajeConfirmacion: () => { throw new Error("no debería llamarse — nunca hubo requiere_confirmacion"); },
    });
    assert.equal(btn.textContent, "Regenerar");

    btn.dispatchEvent(new window.Event("click"));
    await esperar(20);

    assert.deepEqual(llamadas, [false]);
    assert.equal(btn.textContent, "✓ Regenerado");
  });

  test("requiere_confirmacion + el usuario acepta el aviso -> reintenta con confirmar:true y termina en OK", async () => {
    const llamadas = [];
    let primerIntento = true;
    const btn = buildRegenerarBoton({
      textoIdle: "Regenerar recibos",
      ejecutar: async (confirmar) => {
        llamadas.push(confirmar);
        if (primerIntento) { primerIntento = false; throw errorRequiereConfirmacion({ afectados: 3 }); }
        return { ok: true };
      },
      mensajeConfirmacion: (details) => `${details.afectados} recibo(s) ya enviados. ¿Continuar?`,
      confirmFn: (mensaje) => { assert.equal(mensaje, "3 recibo(s) ya enviados. ¿Continuar?"); return true; },
    });

    btn.dispatchEvent(new window.Event("click"));
    await esperar(20);

    assert.deepEqual(llamadas, [false, true], "ejecutar debe llamarse dos veces: sin confirmar, luego confirmado");
    assert.equal(btn.textContent, "✓ Regenerado");
  });

  test("requiere_confirmacion + el usuario cancela el aviso -> NO reintenta y vuelve a idle sin marcar éxito", async () => {
    const llamadas = [];
    const btn = buildRegenerarBoton({
      textoIdle: "Regenerar",
      ejecutar: async (confirmar) => { llamadas.push(confirmar); throw errorRequiereConfirmacion({ afectados: 1 }); },
      mensajeConfirmacion: () => "¿continuar?",
      confirmFn: () => false,
    });

    btn.dispatchEvent(new window.Event("click"));
    await esperar(20);

    assert.deepEqual(llamadas, [false], "cancelar el aviso no debe disparar un segundo intento");
    assert.equal(btn.textContent, "Regenerar");
  });

  test("un error normal (sin requiere_confirmacion) no dispara el aviso — llama a onError y el botón vuelve a idle", async () => {
    let errorRecibido = null;
    const btn = buildRegenerarBoton({
      textoIdle: "Regenerar",
      ejecutar: async () => { throw new Error("fallo de red"); },
      mensajeConfirmacion: () => { throw new Error("no debería llamarse"); },
      onError: (err) => { errorRecibido = err; },
    });

    btn.dispatchEvent(new window.Event("click"));
    await esperar(20);

    assert.equal(errorRecibido?.message, "fallo de red");
    assert.equal(btn.textContent, "Regenerar");
  });

  test("código 'cancelado' (p.ej. el usuario cerró el diálogo de tipo de envío) -> vuelve a idle en silencio, sin onError ni aviso de éxito", async () => {
    let errorRecibido = "no-llamado";
    const btn = buildRegenerarBoton({
      textoIdle: "Enviar",
      ejecutar: async () => {
        const err = new Error("cancelado");
        err.code = "cancelado";
        throw err;
      },
      onError: (err) => { errorRecibido = err; },
    });

    btn.dispatchEvent(new window.Event("click"));
    await esperar(20);

    assert.equal(errorRecibido, "no-llamado", "cancelado no debe pasar por onError");
    assert.equal(btn.textContent, "Enviar");
  });

  test("modo 'generar' (sin mensajeConfirmacion) + requiere_confirmacion inesperado (condición de carrera) -> no revienta, usa el mensaje por defecto", async () => {
    const llamadas = [];
    const btn = buildRegenerarBoton({
      textoIdle: "Generar recibo",
      textoCargando: "Generando…",
      textoOk: "✓ Generado",
      // Sin mensajeConfirmacion: nunca debería hacer falta en modo generar,
      // pero si el backend igual devuelve requiere_confirmacion (carrera:
      // otro admin lo generó primero) no debe lanzar un TypeError.
      ejecutar: async (confirmar) => {
        llamadas.push(confirmar);
        throw errorRequiereConfirmacion({ afectados: 1 });
      },
      confirmFn: (mensaje) => { assert.equal(mensaje, "Esta acción necesita confirmación antes de continuar. ¿Continuar?"); return false; },
    });

    btn.dispatchEvent(new window.Event("click"));
    await esperar(20);

    assert.deepEqual(llamadas, [false]);
    assert.equal(btn.textContent, "Generar recibo");
  });
}
