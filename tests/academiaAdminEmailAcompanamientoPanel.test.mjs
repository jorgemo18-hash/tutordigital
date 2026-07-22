import { Window } from "happy-dom";

// Entorno DOM (happy-dom), mismo patrón que academiaAdminDescuentosRecurrentesSection.test.mjs.
const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeFakes(textoInicial) {
  const llamadas = { updateConfig: [] };
  return {
    llamadas,
    fetchConfigFn: async () => ({ email_texto_acompanamiento: textoInicial }),
    updateConfigFn: async (payload) => { llamadas.updateConfig.push(payload); return {}; },
  };
}

export async function run({ test, assert }) {
  const { buildEmailAcompanamientoPanel } = await import("../assets/academia/admin/js/sections/ajustes/emailAcompanamientoPanel.js");

  test("carga el texto guardado en el textarea", async () => {
    const fakes = makeFakes("Texto ya guardado con {total}.");
    const panel = buildEmailAcompanamientoPanel(fakes);
    await esperar(20);
    const textarea = panel.querySelector("textarea");
    assert.equal(textarea.value, "Texto ya guardado con {total}.");
  });

  test("pulsar un chip inserta la variable en el texto", async () => {
    const fakes = makeFakes("Hola");
    const panel = buildEmailAcompanamientoPanel(fakes);
    await esperar(20);
    const textarea = panel.querySelector("textarea");
    const chip = [...panel.querySelectorAll("button")].find((b) => b.textContent === "{familia}");
    assert.ok(chip, "debe existir el chip {familia}");
    chip.dispatchEvent(new window.Event("click"));
    assert.equal(textarea.value.includes("{familia}"), true);
  });

  test("texto sin {total} muestra el aviso no bloqueante ya al cargar", async () => {
    const fakes = makeFakes("Hola {familia}, sin la cifra.");
    const panel = buildEmailAcompanamientoPanel(fakes);
    await esperar(20);

    const aviso = [...panel.querySelectorAll("span")].find((s) => s.textContent.includes("no incluye {total}"));
    assert.ok(aviso, "debe avisar si el texto guardado no tiene {total}");
  });

  test("guardar sin {total} no bloquea el guardado — se llama a updateConfigFn igual", async () => {
    const fakes = makeFakes("Hola {familia}, sin la cifra.");
    const panel = buildEmailAcompanamientoPanel(fakes);
    await esperar(20);

    const saveBtn = [...panel.querySelectorAll("button")].find((b) => b.textContent === "Guardar");
    saveBtn.dispatchEvent(new window.Event("click"));
    await esperar(20);

    assert.deepEqual(fakes.llamadas.updateConfig, [{ email_texto_acompanamiento: "Hola {familia}, sin la cifra." }]);
  });

  test("con {total} en el texto, no se muestra ningún aviso", async () => {
    const fakes = makeFakes("Hola {familia}, total {total}.");
    const panel = buildEmailAcompanamientoPanel(fakes);
    await esperar(20);

    const aviso = [...panel.querySelectorAll("span")].find((s) => s.textContent.includes("no incluye {total}"));
    assert.equal(aviso, undefined);
  });
}
