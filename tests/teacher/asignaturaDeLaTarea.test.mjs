import fs from "node:fs";
import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;
const RAIZ = new URL("../../", import.meta.url).pathname;

// Cinco tareas «Educación Física» que eran sintaxis, logaritmos e inglés:
// "Nueva tarea" copiaba en silencio la asignatura de la cabecera, que
// arranca en la primera del grupo.
export async function run({ test, assert }) {
  const { asignaturaInicial, errorDeAsignatura, asignaturasDelSelector } = await import(
    "../../assets/teacher/js/features/asignaturaDeLaTarea.js"
  );
  const { openTaskModal } = await import("../../assets/teacher/js/modals.js");

  // Objetos planos, no <select>/<form> de happy-dom: con pdf-parse cargado
  // en la misma suite, `select.options` y `form.reset()` revientan (trampa
  // conocida, ver estado-y-plan.md).
  function selector(nombres) {
    return { value: "Educación Física", options: ["", ...nombres].map((value) => ({ value })) };
  }

  test("con una sola asignatura se pone sola; con varias, vacía", () => {
    assert.equal(asignaturaInicial(["Matemáticas"]), "Matemáticas");
    assert.equal(asignaturaInicial(["Educación Física", "Matemáticas"]), "");
  });

  test("con varias, dejarla vacía no se puede guardar", () => {
    assert.match(errorDeAsignatura(["Educación Física", "Lengua"], ""), /Elige la asignatura/);
    assert.equal(errorDeAsignatura(["Educación Física", "Lengua"], "Lengua"), null);
    assert.equal(errorDeAsignatura([], ""), null, "un grupo sin asignaturas no bloquea");
  });

  test("REGRESIÓN: 'Nueva tarea' NO copia la asignatura de la cabecera", () => {
    const taskSubject = selector(["Educación Física", "Lengua", "Matemáticas"]);
    const form = { reset() {} };
    const el = (tag) => (tag === "select" ? { value: "" } : document.createElement(tag));
    const ctx = {
      state: { currentGroupId: "g1", currentSubjectFilter: "Educación Física" },
      elements: { taskForm: form, taskGroup: el("select"), taskSubject, taskModal: el("div") },
    };
    openTaskModal(ctx);
    assert.equal(taskSubject.value, "");
    assert.deepEqual(asignaturasDelSelector(taskSubject), ["Educación Física", "Lengua", "Matemáticas"]);
  });

  test("el formulario del ordenador y el del móvil aplican la misma regla", () => {
    const tareas = fs.readFileSync(`${RAIZ}assets/teacher/js/tasks.js`, "utf8");
    const movil = fs.readFileSync(`${RAIZ}assets/teacher/mobile/mobileTeacherSheets.js`, "utf8");
    assert.match(tareas, /errorDeAsignatura\(/);
    assert.match(movil, /errorDeAsignatura\(/);
  });
}
