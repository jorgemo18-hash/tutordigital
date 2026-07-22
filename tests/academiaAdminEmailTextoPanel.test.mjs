import { Window } from "happy-dom";

// Entorno DOM (happy-dom), mismo patrón que academiaAdminDescuentosRecurrentesSection.test.mjs.
const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeFakes(config) {
  const llamadas = { updateConfig: [] };
  return {
    llamadas,
    fetchConfigFn: async () => config,
    updateConfigFn: async (payload) => { llamadas.updateConfig.push(payload); return {}; },
  };
}

export async function run({ test, assert }) {
  const { buildEmailTextoPanel } = await import("../assets/academia/admin/js/sections/ajustes/emailTextos/emailTextoPanelBase.js");
  const { buildEmailTextoCompletoPanel } = await import("../assets/academia/admin/js/sections/ajustes/emailTextos/completoPanel.js");
  const { buildEmailTextoSoloReciboPanel } = await import("../assets/academia/admin/js/sections/ajustes/emailTextos/soloReciboPanel.js");
  const { buildEmailTextoSoloInformePanel } = await import("../assets/academia/admin/js/sections/ajustes/emailTextos/soloInformePanel.js");

  test("carga el texto guardado de SU campo en el textarea", async () => {
    const fakes = makeFakes({ mi_campo: "Texto ya guardado con {total}." });
    const panel = buildEmailTextoPanel({ campo: "mi_campo", titulo: "T", descripcion: "D", variables: ["{total}"], variablesEsperadas: ["{total}"], ...fakes });
    await esperar(20);
    const textarea = panel.querySelector("textarea");
    assert.equal(textarea.value, "Texto ya guardado con {total}.");
  });

  test("pulsar un chip inserta la variable en el texto", async () => {
    const fakes = makeFakes({ mi_campo: "Hola" });
    const panel = buildEmailTextoPanel({ campo: "mi_campo", titulo: "T", descripcion: "D", variables: ["{familia}"], ...fakes });
    await esperar(20);
    const textarea = panel.querySelector("textarea");
    const chip = [...panel.querySelectorAll("button")].find((b) => b.textContent === "{familia}");
    assert.ok(chip, "debe existir el chip {familia}");
    chip.dispatchEvent(new window.Event("click"));
    assert.equal(textarea.value.includes("{familia}"), true);
  });

  test("texto sin una variable esperada muestra el aviso no bloqueante ya al cargar", async () => {
    const fakes = makeFakes({ mi_campo: "Hola {familia}, sin la cifra." });
    const panel = buildEmailTextoPanel({ campo: "mi_campo", titulo: "T", descripcion: "D", variables: ["{familia}", "{total}"], variablesEsperadas: ["{total}"], ...fakes });
    await esperar(20);
    const aviso = [...panel.querySelectorAll("span")].find((s) => s.textContent.includes("no incluye {total}"));
    assert.ok(aviso, "debe avisar si falta una variable esperada");
  });

  test("guardar sin una variable esperada no bloquea el guardado — se llama a updateConfigFn con SU campo", async () => {
    const fakes = makeFakes({ mi_campo: "Hola {familia}, sin la cifra." });
    const panel = buildEmailTextoPanel({ campo: "mi_campo", titulo: "T", descripcion: "D", variables: ["{familia}", "{total}"], variablesEsperadas: ["{total}"], ...fakes });
    await esperar(20);
    const saveBtn = [...panel.querySelectorAll("button")].find((b) => b.textContent === "Guardar");
    saveBtn.dispatchEvent(new window.Event("click"));
    await esperar(20);
    assert.deepEqual(fakes.llamadas.updateConfig, [{ mi_campo: "Hola {familia}, sin la cifra." }]);
  });

  test("con todas las variables esperadas presentes, no se muestra ningún aviso", async () => {
    const fakes = makeFakes({ mi_campo: "Hola {familia}, total {total}." });
    const panel = buildEmailTextoPanel({ campo: "mi_campo", titulo: "T", descripcion: "D", variables: ["{familia}", "{total}"], variablesEsperadas: ["{total}"], ...fakes });
    await esperar(20);
    const aviso = [...panel.querySelectorAll("span")].find((s) => s.textContent.includes("no incluye"));
    assert.equal(aviso, undefined);
  });

  test("sin variablesEsperadas (caso 'solo informe') nunca muestra aviso, aunque falte {total}", async () => {
    const fakes = makeFakes({ mi_campo: "Hola {familia}." });
    const panel = buildEmailTextoPanel({ campo: "mi_campo", titulo: "T", descripcion: "D", variables: ["{familia}"], variablesEsperadas: [], ...fakes });
    await esperar(20);
    const aviso = [...panel.querySelectorAll("span")].find((s) => s.textContent.includes("no incluye"));
    assert.equal(aviso, undefined);
  });

  test("buildEmailTextoCompletoPanel usa el campo email_texto_completo y ofrece {total}", async () => {
    const fakes = makeFakes({ email_texto_completo: "Texto completo" });
    const panel = buildEmailTextoCompletoPanel(fakes);
    await esperar(20);
    assert.equal(panel.querySelector("textarea").value, "Texto completo");
    const chip = [...panel.querySelectorAll("button")].find((b) => b.textContent === "{total}");
    assert.ok(chip, "el panel de completo debe ofrecer {total}");
  });

  test("buildEmailTextoSoloReciboPanel usa el campo email_texto_solo_recibo y ofrece {total}", async () => {
    const fakes = makeFakes({ email_texto_solo_recibo: "Texto solo recibo" });
    const panel = buildEmailTextoSoloReciboPanel(fakes);
    await esperar(20);
    assert.equal(panel.querySelector("textarea").value, "Texto solo recibo");
    const chip = [...panel.querySelectorAll("button")].find((b) => b.textContent === "{total}");
    assert.ok(chip, "el panel de solo recibo debe ofrecer {total}");
  });

  test("buildEmailTextoSoloInformePanel usa email_texto_solo_informe y NO ofrece {total} (evita el bug al revés)", async () => {
    const fakes = makeFakes({ email_texto_solo_informe: "Texto solo informe" });
    const panel = buildEmailTextoSoloInformePanel(fakes);
    await esperar(20);
    assert.equal(panel.querySelector("textarea").value, "Texto solo informe");
    const chip = [...panel.querySelectorAll("button")].find((b) => b.textContent === "{total}");
    assert.equal(chip, undefined, "el panel de solo informe no debe ofrecer {total}");
  });
}
