import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

// "Profesores" debe quedar justo debajo de "Alumnos" en el sidebar de
// admin-academia (antes estaba al final de la primera franja, junto a
// Ajustes) — test de regresión simple sobre el orden del array.
export async function run({ test, assert }) {
  const { SECTIONS } = await import("../assets/academia/admin/js/sidebar.js");
  const { buildIcon } = await import("../assets/academia/admin/js/icons.js");

  test("Profesores aparece justo después de Alumnos", () => {
    const ids = SECTIONS.map((s) => s.id);
    const idxAlumnos = ids.indexOf("alumnos");
    const idxProfesores = ids.indexOf("profesores");
    assert.notEqual(idxAlumnos, -1);
    assert.notEqual(idxProfesores, -1);
    assert.equal(idxProfesores, idxAlumnos + 1);
  });

  // Alumnos y Profesores usaban dos variantes de la misma silueta de
  // persona ("users"/"userCheck"), casi indistinguibles en el sidebar
  // colapsado — Profesores pasa a un icono de libro (enseñanza) para que
  // se puedan diferenciar de un vistazo.
  test("Profesores usa un icono distinto y no otra silueta de persona", () => {
    const alumnos = SECTIONS.find((s) => s.id === "alumnos");
    const profesores = SECTIONS.find((s) => s.id === "profesores");
    assert.notEqual(profesores.icon, alumnos.icon);
    assert.equal(profesores.icon, "bookOpen");
  });

  test("el icono 'bookOpen' existe de verdad en icons.js (no es un key sin path)", () => {
    const svg = buildIcon("bookOpen", { size: 14 });
    assert.ok(svg.querySelectorAll("path").length > 0, "debe dibujar al menos un path, no un SVG vacío");
  });
}
