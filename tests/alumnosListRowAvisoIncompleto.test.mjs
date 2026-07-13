import { Window } from "happy-dom";

// Mismo patrón que alumnosList.test.mjs: DOM real (happy-dom) montado antes
// de importar el módulo, porque buildRow crea SVG (namespace distinto de
// HTML) vía document.createElementNS.
const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

const NOOP = () => {};

export async function run({ test, assert }) {
  const { buildRow } = await import("../assets/academia/admin/js/alumnosListRow.js");

  test("alumnosListRow: alumno activo sin horario ni tarifa muestra el aviso de datos incompletos", () => {
    const alumno = { id: "1", nombre: "Ana", curso: "1º ESO", nivel: "eso", tiene_horario: false, tarifa_vigente: null };
    const row = buildRow(alumno, NOOP, {});
    const aviso = row.querySelector(".ac-list-aviso-incompleto");
    assert.ok(aviso, "debería mostrar el icono de aviso");
    assert.ok(aviso.getAttribute("aria-label").includes("horario"), "el texto accesible debería mencionar horario");
    assert.ok(aviso.getAttribute("aria-label").includes("tarifa"), "el texto accesible debería mencionar tarifa");
  });

  test("alumnosListRow: alumno activo con horario y tarifa no muestra aviso", () => {
    const alumno = { id: "2", nombre: "Luis", curso: "1º ESO", nivel: "eso", tiene_horario: true, tarifa_vigente: { precio_neto: 100 } };
    const row = buildRow(alumno, NOOP, {});
    assert.ok(!row.querySelector(".ac-list-aviso-incompleto"), "no debería mostrar el icono si tiene horario y tarifa");
  });

  test("alumnosListRow: alumno activo con solo horario incompleto menciona únicamente horario", () => {
    const alumno = { id: "3", nombre: "Eva", curso: "1º ESO", nivel: "eso", tiene_horario: false, tarifa_vigente: { precio_neto: 80 } };
    const row = buildRow(alumno, NOOP, {});
    const aviso = row.querySelector(".ac-list-aviso-incompleto");
    assert.ok(aviso, "debería mostrar el icono de aviso");
    const texto = aviso.getAttribute("aria-label");
    assert.ok(texto.includes("horario"), "debería mencionar horario");
    assert.ok(!texto.includes("tarifa"), "no debería mencionar tarifa si sí la tiene");
  });

  test("alumnosListRow: pestaña Pendientes no muestra el aviso aunque falten datos", () => {
    const alumno = { id: "4", nombre: "Sara", curso: "1º ESO", tiene_horario: false, tarifa_vigente: null };
    const row = buildRow(alumno, NOOP, { pendiente: true });
    assert.ok(!row.querySelector(".ac-list-aviso-incompleto"), "no debería mostrar el aviso en Pendientes");
  });

  test("alumnosListRow: pestaña Archivados no muestra el aviso aunque falten datos", () => {
    const alumno = { id: "5", nombre: "Iker", curso: "1º ESO", nivel: "eso", tiene_horario: false, tarifa_vigente: null };
    const row = buildRow(alumno, NOOP, { archivado: true, onRestaurarFn: NOOP });
    assert.ok(!row.querySelector(".ac-list-aviso-incompleto"), "no debería mostrar el aviso en Archivados");
  });
}
