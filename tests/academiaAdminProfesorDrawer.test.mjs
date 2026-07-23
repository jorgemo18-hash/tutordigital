import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function run({ test, assert }) {
  const { createProfesorDrawer } = await import("../assets/academia/admin/js/drawer/profesor/profesorDrawer.js");

  function deps(overrides = {}) {
    return {
      updateProfesorFn: async () => ({}),
      fetchAlumnosDisponiblesFn: async () => [],
      fetchAlumnosDeProfesorFn: async () => [],
      asignarFn: async () => {},
      quitarFn: async () => {},
      ...overrides,
    };
  }

  // Cada test monta el drawer en su propio contenedor desconectado — close()
  // solo quita la clase "open" (no desmonta del DOM, igual que
  // alumnoDrawer.js/gastoDrawer.js), así que reutilizar document.body entre
  // tests apilaría drawers y un document.querySelector pillaría el de un
  // test anterior. Consultando dentro de `root` en vez de `document` cada
  // test queda aislado del resto.
  function montar(opts) {
    const root = document.createElement("div");
    const drawer = createProfesorDrawer(root, opts);
    return { root, drawer };
  }

  test("open() precarga nombre, dirección y teléfono del profesor", async () => {
    const { root, drawer } = montar({ onSaved: () => {}, ...deps() });
    drawer.open({ id: "p1", display_name: "Ana Profe", telefono: "600111222", direccion: "Calle Falsa 123" });
    await esperar(5);
    const inputs = root.querySelectorAll(".ac-drawer input");
    assert.equal(inputs[0].value, "Ana Profe");
    assert.equal(inputs[1].value, "Calle Falsa 123");
    assert.equal(inputs[2].value, "600111222");
  });

  test("un profesor con id muestra la sección de alumnos asignados", async () => {
    const { root, drawer } = montar({ onSaved: () => {}, ...deps() });
    drawer.open({ id: "p1", display_name: "Ana Profe" });
    await esperar(5);
    assert.ok(root.querySelector(".ac-profesor-alumnos-lista"));
  });

  test("una invitación pendiente (sin id) no muestra la sección de alumnos asignados", async () => {
    const { root, drawer } = montar({ onSaved: () => {}, ...deps() });
    drawer.open({ id: null, display_name: "Pendiente Demo" });
    await esperar(5);
    assert.equal(root.querySelector(".ac-profesor-alumnos-lista"), null);
  });

  test("guardar sin nombre muestra aviso y no llama a updateProfesorFn", async () => {
    let llamado = false;
    const { root, drawer } = montar({
      onSaved: () => {},
      ...deps({ updateProfesorFn: async () => { llamado = true; } }),
    });
    drawer.open({ id: "p1", display_name: "Ana Profe" });
    await esperar(5);
    root.querySelector(".ac-drawer input").value = "";
    root.querySelector(".ac-btn.primary").dispatchEvent(new window.Event("click"));
    await esperar(5);
    assert.equal(llamado, false);
    assert.equal(root.querySelector(".ac-drawer-msg.error").textContent, "El nombre es obligatorio.");
  });

  test("guardar con éxito llama a updateProfesorFn con el payload correcto y a onSaved", async () => {
    const llamadas = [];
    let onSavedLlamado = false;
    const { root, drawer } = montar({
      onSaved: () => { onSavedLlamado = true; },
      ...deps({ updateProfesorFn: async (id, payload) => { llamadas.push([id, payload]); } }),
    });
    drawer.open({ id: "p1", display_name: "Ana Profe", telefono: null, direccion: null });
    await esperar(5);
    const inputs = root.querySelectorAll(".ac-drawer input");
    inputs[1].value = "Calle Nueva 5";
    inputs[2].value = "611222333";
    root.querySelector(".ac-btn.primary").dispatchEvent(new window.Event("click"));
    await esperar(5);
    assert.deepEqual(llamadas, [["p1", { display_name: "Ana Profe", direccion: "Calle Nueva 5", telefono: "611222333" }]]);
    assert.equal(onSavedLlamado, true);
  });

  test("si updateProfesorFn falla, muestra el error y no llama a onSaved", async () => {
    let onSavedLlamado = false;
    const { root, drawer } = montar({
      onSaved: () => { onSavedLlamado = true; },
      ...deps({ updateProfesorFn: async () => { throw new Error("no se pudo guardar"); } }),
    });
    drawer.open({ id: "p1", display_name: "Ana Profe" });
    await esperar(5);
    root.querySelector(".ac-btn.primary").dispatchEvent(new window.Event("click"));
    await esperar(5);
    assert.equal(onSavedLlamado, false);
    assert.equal(root.querySelector(".ac-drawer-msg.error").textContent, "no se pudo guardar");
  });
}
