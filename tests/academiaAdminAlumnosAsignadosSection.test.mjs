import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function run({ test, assert }) {
  const { buildAlumnosAsignadosSection } = await import("../assets/academia/admin/js/drawer/profesor/alumnosAsignadosSection.js");

  test("marca como asignados solo los alumnos que ya están en la lista del profesor", async () => {
    const section = buildAlumnosAsignadosSection({
      profesorId: "p1",
      fetchAlumnosDisponiblesFn: async () => [{ id: "a1", nombre: "Ana", curso: "1 ESO" }, { id: "a2", nombre: "Bea", curso: "2 ESO" }],
      fetchAlumnosDeProfesorFn: async () => [{ id: "a2", nombre: "Bea", curso: "2 ESO" }],
      asignarFn: async () => {},
      quitarFn: async () => {},
    });
    await esperar(10);
    const checkboxes = section.wrap.querySelectorAll('input[type="checkbox"]');
    assert.equal(checkboxes.length, 2);
    assert.equal(checkboxes[0].checked, false);
    assert.equal(checkboxes[1].checked, true);
  });

  test("sin alumnos activos en el centro muestra un mensaje vacío", async () => {
    const section = buildAlumnosAsignadosSection({
      profesorId: "p1",
      fetchAlumnosDisponiblesFn: async () => [],
      fetchAlumnosDeProfesorFn: async () => [],
      asignarFn: async () => {},
      quitarFn: async () => {},
    });
    await esperar(10);
    assert.ok(section.wrap.textContent.includes("No hay alumnos activos"));
  });

  test("marcar un checkbox llama a asignarFn con el profesor y el alumno", async () => {
    const llamadas = [];
    const section = buildAlumnosAsignadosSection({
      profesorId: "p1",
      fetchAlumnosDisponiblesFn: async () => [{ id: "a1", nombre: "Ana" }],
      fetchAlumnosDeProfesorFn: async () => [],
      asignarFn: async (profesorId, alumnoId) => { llamadas.push(["asignar", profesorId, alumnoId]); },
      quitarFn: async () => {},
    });
    await esperar(10);
    const checkbox = section.wrap.querySelector('input[type="checkbox"]');
    checkbox.checked = true;
    checkbox.dispatchEvent(new window.Event("change"));
    await esperar(10);
    assert.deepEqual(llamadas, [["asignar", "p1", "a1"]]);
  });

  test("desmarcar un checkbox ya asignado llama a quitarFn", async () => {
    const llamadas = [];
    const section = buildAlumnosAsignadosSection({
      profesorId: "p1",
      fetchAlumnosDisponiblesFn: async () => [{ id: "a1", nombre: "Ana" }],
      fetchAlumnosDeProfesorFn: async () => [{ id: "a1", nombre: "Ana" }],
      asignarFn: async () => {},
      quitarFn: async (profesorId, alumnoId) => { llamadas.push(["quitar", profesorId, alumnoId]); },
    });
    await esperar(10);
    const checkbox = section.wrap.querySelector('input[type="checkbox"]');
    checkbox.checked = false;
    checkbox.dispatchEvent(new window.Event("change"));
    await esperar(10);
    assert.deepEqual(llamadas, [["quitar", "p1", "a1"]]);
  });

  test("si asignarFn falla, el checkbox vuelve a su estado anterior y muestra el error", async () => {
    const section = buildAlumnosAsignadosSection({
      profesorId: "p1",
      fetchAlumnosDisponiblesFn: async () => [{ id: "a1", nombre: "Ana" }],
      fetchAlumnosDeProfesorFn: async () => [],
      asignarFn: async () => { throw new Error("fallo de red"); },
      quitarFn: async () => {},
    });
    await esperar(10);
    const checkbox = section.wrap.querySelector('input[type="checkbox"]');
    checkbox.checked = true;
    checkbox.dispatchEvent(new window.Event("change"));
    await esperar(10);
    assert.equal(checkbox.checked, false, "un fallo debe revertir el toggle");
    assert.ok(section.wrap.textContent.includes("fallo de red"));
  });
}
