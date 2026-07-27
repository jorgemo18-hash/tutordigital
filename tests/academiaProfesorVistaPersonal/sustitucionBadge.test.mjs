import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

// buildBadgeSustitucion() — etiqueta compartida entre horario.js y
// diarioCard.js para marcar un alumno visible hoy vía sustitución.
export async function run({ test, assert }) {
  const { buildBadgeSustitucion } = await import("../../assets/academia/profesor/js/sustitucionBadge.js");

  test("sin viaSustitucion (alumno propio) -> no crea nada", () => {
    assert.equal(buildBadgeSustitucion(null), null);
    assert.equal(buildBadgeSustitucion(undefined), null);
  });

  test("con nombre del profesor sustituido -> badge 'Sustitución' con tooltip nombrándolo", () => {
    const badge = buildBadgeSustitucion({ sustituido_nombre: "Bea" });
    assert.equal(badge.className, "ac-badge-sustitucion");
    assert.equal(badge.textContent, "Sustitución");
    assert.equal(badge.title, "Alumno de Bea — hoy lo cubres tú");
  });

  test("sin nombre resuelto -> tooltip genérico, nunca vacío", () => {
    const badge = buildBadgeSustitucion({ sustituido_nombre: null });
    assert.equal(badge.title, "Alumno de otro profesor — hoy lo cubres tú");
  });
}
