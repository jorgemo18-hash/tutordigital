import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

// buildClaseBody() en una fecha futura: solo ofrece "Marcar ausente", con
// un aviso explicando por qué — nada de asignatura/tema/nota ni "Guardar"
// (registrar una CLASE futura no tiene sentido, ver diarioDrawer.js).
export async function run({ test, assert }) {
  const { buildClaseBody } = await import("../../assets/academia/profesor/js/diarioDrawerBody.js");

  const entry = { alumno_id: "a1", nombre: "Ana", curso: "1 ESO", nivel: "eso" };

  test("fecha futura -> aviso explícito, sin campos de clase ni botón Guardar", () => {
    const body = buildClaseBody(entry, "2026-12-01", {
      onMarcarAusente: () => {},
      onGuardado: () => {},
      esFechaFutura: true,
    });
    assert.ok(body.textContent.includes("Solo puedes registrar ausencias en fechas futuras."));
    assert.equal(body.querySelector(".ac-input"), null, "no debe haber campos de asignatura/tema");
    assert.equal(body.querySelector(".ac-textarea"), null, "no debe haber textarea de nota");
    const botones = [...body.querySelectorAll("button")].map((b) => b.textContent);
    assert.ok(botones.some((t) => t.includes("Marcar ausente")));
    assert.equal(botones.some((t) => t.includes("Guardar")), false, "no debe ofrecer Guardar");
  });

  test("fecha futura -> el único botón dispara onMarcarAusente", () => {
    let marcado = false;
    const body = buildClaseBody(entry, "2026-12-01", {
      onMarcarAusente: () => { marcado = true; },
      onGuardado: () => {},
      esFechaFutura: true,
    });
    body.querySelector("button").click();
    assert.equal(marcado, true);
  });

  test("sin esFechaFutura (pasado/hoy, valor por defecto) -> formulario normal de clase con Guardar", () => {
    const body = buildClaseBody(entry, "2026-07-01", { onMarcarAusente: () => {}, onGuardado: () => {} });
    const botones = [...body.querySelectorAll("button")].map((b) => b.textContent);
    assert.ok(botones.some((t) => t.includes("Guardar")));
    assert.ok(body.querySelector(".ac-input"), "sí debe haber campos de asignatura/tema");
  });
}
