import { Window } from "happy-dom";

// Entorno DOM (happy-dom), mismo patrón que academiaAdminFamiliaCompleta.test.mjs.
const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeFakes({ tipos = [{ id: "dt1", concepto: "Hermanos", porcentaje: 15, activo: false }], hermanos = [] } = {}) {
  const updateCalls = [];
  const confirmCalls = [];
  let confirmResultado = true;
  return {
    fetchDescuentosFn: async () => tipos,
    updateDescuentosFn: async (id, asignaciones) => { updateCalls.push({ id, asignaciones }); },
    fetchEconomicoFn: async (familiaId) => ({ familia: { id: familiaId }, alumnos: hermanos, totalNeto: 0 }),
    confirmFn: (mensaje) => { confirmCalls.push(mensaje); return confirmResultado; },
    setConfirmResultado: (v) => { confirmResultado = v; },
    updateCalls,
    confirmCalls,
  };
}

export async function run({ test, assert }) {
  const { buildDescuentosRecurrentesSection } = await import("../assets/academia/admin/js/drawer/descuentosRecurrentesSection.js");

  test("TAREA 1 — marcar un descuento dispara onGuardado (repinta la foto económica pidiéndola de nuevo, sin recalcular aquí)", async () => {
    const fakes = makeFakes({ hermanos: [{ id: "a1", nombre: "Yo" }] }); // sin otros hermanos activos
    let vecesLlamado = 0;
    let familiaIdRecibida = null;
    const { wrap } = buildDescuentosRecurrentesSection({
      alumnoId: "a1",
      getFamiliaId: () => "f1",
      onGuardado: () => { vecesLlamado += 1; },
      ...fakes,
    });
    await esperar(20);

    const checkbox = wrap.querySelector('input[type="checkbox"]');
    checkbox.checked = true;
    checkbox.dispatchEvent(new window.Event("change"));
    await esperar(20);

    assert.equal(vecesLlamado, 1, "onGuardado debe dispararse tras guardar el descuento");
    assert.equal(fakes.updateCalls.length, 1);
    assert.deepEqual(fakes.updateCalls[0], { id: "a1", asignaciones: [{ descuento_tipo_id: "dt1", activo: true }] });
  });

  test("TAREA 1 — desmarcar un descuento también dispara onGuardado", async () => {
    const fakes = makeFakes({ tipos: [{ id: "dt1", concepto: "Hermanos", porcentaje: 15, activo: true }], hermanos: [{ id: "a1", nombre: "Yo" }] });
    let vecesLlamado = 0;
    const { wrap } = buildDescuentosRecurrentesSection({
      alumnoId: "a1",
      getFamiliaId: () => "f1",
      onGuardado: () => { vecesLlamado += 1; },
      ...fakes,
    });
    await esperar(20);

    const checkbox = wrap.querySelector('input[type="checkbox"]');
    checkbox.checked = false;
    checkbox.dispatchEvent(new window.Event("change"));
    await esperar(20);

    assert.equal(vecesLlamado, 1);
    assert.equal(fakes.confirmCalls.length, 0, "desmarcar nunca ofrece propagar — el quitado es siempre individual");
  });

  test("TAREA 2 — marcar con hermanos activos ofrece propagar, nombrándolos; al aceptar, se asigna a todos", async () => {
    const fakes = makeFakes({
      hermanos: [{ id: "a1", nombre: "Yo" }, { id: "a2", nombre: "Ana" }, { id: "a3", nombre: "Luis" }],
    });
    const { wrap } = buildDescuentosRecurrentesSection({
      alumnoId: "a1",
      getFamiliaId: () => "f1",
      ...fakes,
    });
    await esperar(20);

    const checkbox = wrap.querySelector('input[type="checkbox"]');
    checkbox.checked = true;
    checkbox.dispatchEvent(new window.Event("change"));
    await esperar(20);

    assert.equal(fakes.confirmCalls.length, 1);
    assert.equal(fakes.confirmCalls[0], '¿Aplicar "Hermanos (15.00%)" también a los otros 2 alumnos de la familia? (Ana, Luis)');

    assert.equal(fakes.updateCalls.length, 3, "el propio alumno + los 2 hermanos");
    const idsActualizados = fakes.updateCalls.map((c) => c.id).sort();
    assert.deepEqual(idsActualizados, ["a1", "a2", "a3"]);
    for (const call of fakes.updateCalls) {
      assert.deepEqual(call.asignaciones, [{ descuento_tipo_id: "dt1", activo: true }]);
    }
  });

  test("TAREA 2 — rechazar la propagación deja el descuento solo en el alumno original", async () => {
    const fakes = makeFakes({ hermanos: [{ id: "a1", nombre: "Yo" }, { id: "a2", nombre: "Ana" }] });
    fakes.setConfirmResultado(false);
    const { wrap } = buildDescuentosRecurrentesSection({
      alumnoId: "a1",
      getFamiliaId: () => "f1",
      ...fakes,
    });
    await esperar(20);

    const checkbox = wrap.querySelector('input[type="checkbox"]');
    checkbox.checked = true;
    checkbox.dispatchEvent(new window.Event("change"));
    await esperar(20);

    assert.equal(fakes.confirmCalls.length, 1);
    assert.equal(fakes.updateCalls.length, 1, "solo el propio alumno — el rechazo no propaga nada");
    assert.equal(fakes.updateCalls[0].id, "a1");
  });

  test("TAREA 2 — sin otros alumnos activos en la familia -> nunca se ofrece propagar (no hay confirm)", async () => {
    const fakes = makeFakes({ hermanos: [{ id: "a1", nombre: "Yo" }] }); // familia de 1
    const { wrap } = buildDescuentosRecurrentesSection({
      alumnoId: "a1",
      getFamiliaId: () => "f1",
      ...fakes,
    });
    await esperar(20);

    const checkbox = wrap.querySelector('input[type="checkbox"]');
    checkbox.checked = true;
    checkbox.dispatchEvent(new window.Event("change"));
    await esperar(20);

    assert.equal(fakes.confirmCalls.length, 0);
    assert.equal(fakes.updateCalls.length, 1);
  });

  test("TAREA 2 — sin familiaId (alumno sin familia todavía) -> nunca se ofrece propagar, no revienta", async () => {
    const fakes = makeFakes();
    const { wrap } = buildDescuentosRecurrentesSection({
      alumnoId: "a1",
      getFamiliaId: () => null,
      ...fakes,
    });
    await esperar(20);

    const checkbox = wrap.querySelector('input[type="checkbox"]');
    checkbox.checked = true;
    checkbox.dispatchEvent(new window.Event("change"));
    await esperar(20);

    assert.equal(fakes.confirmCalls.length, 0);
    assert.equal(fakes.updateCalls.length, 1);
  });
}
