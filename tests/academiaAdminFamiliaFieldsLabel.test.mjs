import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

// El campo se llama "nombre" en el modelo (identifica al grupo familiar,
// no a una persona concreta) — el label visible decía antes "Nombre del
// tutor", lo que confundía como si fuera el nombre de una persona.
export async function run({ test, assert }) {
  const { buildFamiliaFields } = await import("../assets/academia/admin/js/drawer/familia/familiaFields.js");

  test("el campo de nombre de familia se etiqueta 'Nombre de la familia', no 'Nombre del tutor'", () => {
    const fields = buildFamiliaFields({});
    const labels = [...fields.wrap.querySelectorAll(".ac-field-label")].map((el) => el.textContent);
    assert.ok(labels.includes("Nombre de la familia"));
    assert.equal(labels.includes("Nombre del tutor"), false);
  });
}
