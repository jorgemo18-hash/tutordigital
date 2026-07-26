import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

// Panel admin, sección "Sustituciones": único punto de gestión real
// (crear/revocar). Foco de este test: revocar SIEMPRE pide confirmación
// antes de llamar a la API — es justo el bug que tuvo el panel profesor
// (acción disparada sin confirmar, o los dos estados visibles a la vez)
// y no debe repetirse aquí. window.confirm() es bloqueante por
// naturaleza, así que no hay ningún estado intermedio que gestionar.
export async function run({ test, assert }) {
  const { createSustitucionesSection } = await import("../assets/academia/admin/js/sections/sustitucionesSection.js");

  const SUSTITUCION = {
    id: "s1", sustituto_nombre: "Ana", sustituido_nombre: "Bea", fecha_inicio: "2026-07-26", fecha_fin: "2026-07-26",
    origen: "admin", declarada_por_nombre: "Admin Uno", revocada_at: null,
  };

  function montar(overrides = {}) {
    const container = document.createElement("div");
    const section = createSustitucionesSection({
      fetchProfesoresFn: async () => [{ id: "p1", display_name: "Ana" }, { id: "p2", display_name: "Bea" }],
      fetchSustitucionesFn: async () => [SUSTITUCION],
      crearSustitucionFn: async () => {},
      revocarSustitucionFn: async () => {},
      ...overrides,
    });
    section.render(container);
    return container;
  }

  test("confirmFn devuelve false -> NO llama a revocarSustitucionFn", async () => {
    let llamadas = 0;
    let preguntado = null;
    const container = montar({
      confirmFn: (msg) => { preguntado = msg; return false; },
      revocarSustitucionFn: async () => { llamadas++; },
    });
    await new Promise((r) => setTimeout(r, 10));

    container.querySelector("button.ac-btn.ghost.sm").dispatchEvent(new window.Event("click"));
    await new Promise((r) => setTimeout(r, 10));

    assert.equal(llamadas, 0, "cancelar la confirmación no debe revocar nada");
    assert.ok(preguntado.includes("Ana"));
    assert.ok(preguntado.includes("Bea"));
  });

  test("confirmFn devuelve true -> SÍ llama a revocarSustitucionFn con el id y refresca", async () => {
    let idRevocado = null;
    let vecesFetchSustituciones = 0;
    const container = montar({
      confirmFn: () => true,
      fetchSustitucionesFn: async () => {
        vecesFetchSustituciones++;
        return vecesFetchSustituciones > 1 ? [] : [SUSTITUCION];
      },
      revocarSustitucionFn: async (id) => { idRevocado = id; },
    });
    await new Promise((r) => setTimeout(r, 10));

    container.querySelector("button.ac-btn.ghost.sm").dispatchEvent(new window.Event("click"));
    await new Promise((r) => setTimeout(r, 10));

    assert.equal(idRevocado, "s1");
    assert.ok(container.textContent.includes("✓ Sustitución revocada"));
  });

  test("un fallo al revocar (ya confirmado) muestra el error y no revienta", async () => {
    const container = montar({
      confirmFn: () => true,
      revocarSustitucionFn: async () => { throw new Error("no se pudo revocar"); },
    });
    await new Promise((r) => setTimeout(r, 10));

    container.querySelector("button.ac-btn.ghost.sm").dispatchEvent(new window.Event("click"));
    await new Promise((r) => setTimeout(r, 10));

    assert.ok(container.textContent.includes("no se pudo revocar"));
  });
}
