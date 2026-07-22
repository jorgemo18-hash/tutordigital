import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function itemFixture(id = "r1") {
  return {
    familia_id: "f1",
    recibo: { id, estado: "borrador", fecha_envio: null },
    alumnos_activos: [{ id: "a1", nombre: "Ana" }],
  };
}

function fakeApi() {
  return {
    fetchInformePreview: async () => ({ comentario: "Comentario", dias: [{ dia: 1, asignatura: "Mates" }], enviadoAt: null }),
    fetchRecibo: async (id) => ({
      id, estado: "borrador", concepto: "Julio 2026", descuento_puntual_pct: 0, descuento_puntual_nota: null,
      familia: { email: "familia@example.com" }, lineas: [], total_bruto: 0, total_descuento: 0, total_neto: 0,
    }),
    fetchTextosLegales: async () => [],
    regerarRecibo: async () => ({}),
  };
}

function ctxFixture(overrides = {}) {
  return { mes: 7, anio: 2026, api: fakeApi(), branding: {}, onCambio: () => {}, onAccionFamilia: async () => {}, ...overrides };
}

export async function run({ test, assert }) {
  const { buildPanelDerecho } = await import("../assets/academia/admin/js/sections/envioFamilias/panelDerecho.js");

  test("mostrar(): pinta las tabs, los botones Regenerar/Enviar de la familia, y empieza en la tab Informe", async () => {
    const panel = buildPanelDerecho();
    panel.mostrar(itemFixture(), ctxFixture());
    await esperar(20);

    const tabActiva = panel.wrap.querySelector(".ac-tab.active");
    assert.equal(tabActiva.textContent, "Informe");

    const botones = [...panel.wrap.querySelectorAll(".ef-acciones-familia button")].map((b) => b.textContent);
    assert.deepEqual(botones, ["Regenerar", "Enviar"]);
  });

  test("cambiar a la tab Recibo y luego actualizar() con datos nuevos -> conserva la tab Recibo (no vuelve a Informe)", async () => {
    const panel = buildPanelDerecho();
    panel.mostrar(itemFixture(), ctxFixture());
    await esperar(20);

    const reciboTab = [...panel.wrap.querySelectorAll(".ac-tab")].find((b) => b.textContent === "Recibo");
    reciboTab.dispatchEvent(new window.Event("click"));
    await esperar(20);
    assert.equal(panel.wrap.querySelector(".ac-tab.active").textContent, "Recibo");

    panel.actualizar(itemFixture("r1-actualizado"), ctxFixture());
    await esperar(20);

    assert.equal(panel.wrap.querySelector(".ac-tab.active").textContent, "Recibo", "actualizar() no debe resetear la tab activa");
  });

  test("mostrar() SÍ resetea a la tab Informe, incluso si antes estaba en Recibo", async () => {
    const panel = buildPanelDerecho();
    panel.mostrar(itemFixture(), ctxFixture());
    await esperar(20);
    const reciboTab = [...panel.wrap.querySelectorAll(".ac-tab")].find((b) => b.textContent === "Recibo");
    reciboTab.dispatchEvent(new window.Event("click"));
    await esperar(20);

    panel.mostrar(itemFixture("otra-familia"), ctxFixture());
    await esperar(20);

    assert.equal(panel.wrap.querySelector(".ac-tab.active").textContent, "Informe");
  });

  test("limpiar(): quita las tabs y los botones de acción de familia", async () => {
    const panel = buildPanelDerecho();
    panel.mostrar(itemFixture(), ctxFixture());
    await esperar(20);

    const mensaje = document.createElement("p");
    mensaje.textContent = "Selecciona una familia.";
    panel.limpiar(mensaje);

    assert.equal(panel.wrap.querySelectorAll(".ef-acciones-familia button").length, 0);
    assert.ok(panel.wrap.textContent.includes("Selecciona una familia."));
  });
}
