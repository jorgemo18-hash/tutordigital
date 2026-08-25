import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

// buildAusenciaEditBody() debe arrancar con "Notificar a la familia"
// marcado (decisión de producto 2026-08-25: notificar es el caso normal,
// "Solo registro interno" es la excepción que el profesor elige a mano).
// Antes de este cambio el radio por defecto era "interno" — este test
// falla si se revierte a ese comportamiento.
export async function run({ test, assert }) {
  const { buildAusenciaEditBody } = await import("../../assets/academia/profesor/js/diarioDrawerBody.js");

  const entry = { alumno_id: "a1", nombre: "Ana", sesion: null };

  test("ausencia: el radio 'Notificar a la familia' está marcado por defecto", () => {
    const body = buildAusenciaEditBody(entry, "2026-07-01", "10:00", {
      onCancelarAusencia: () => {},
      onGuardado: () => {},
      onDatosActualizados: () => {},
    });
    const radios = [...body.querySelectorAll('input[type="radio"][name="ac-notif-tipo"]')];
    assert.equal(radios.length, 2, "debe haber 2 opciones de notificación");

    const notificar = radios.find((r) => r.value === "notificar");
    const interno = radios.find((r) => r.value === "interno");
    assert.ok(notificar, "debe existir la opción 'notificar'");
    assert.ok(interno, "debe existir la opción 'interno'");
    assert.equal(notificar.checked, true, "'notificar' debe empezar marcado");
    assert.equal(interno.checked, false, "'interno' NO debe empezar marcado");
  });

  test("ausencia: al confirmar sin cambiar el radio, se llama a enviarAusenciaEmailFn", async () => {
    let llamado = false;
    const body = buildAusenciaEditBody(entry, "2026-07-01", "10:00", {
      onCancelarAusencia: () => {},
      onGuardado: () => {},
      onDatosActualizados: () => {},
      saveSesionFn: async () => ({ id: "s1" }),
      enviarAusenciaEmailFn: async () => { llamado = true; return { ok: true }; },
    });
    const confirmarBtn = [...body.querySelectorAll("button")].find((b) => b.textContent.includes("Confirmar ausencia"));
    confirmarBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(llamado, true, "con el radio en su valor por defecto, debe intentar enviar el email");
  });
}
