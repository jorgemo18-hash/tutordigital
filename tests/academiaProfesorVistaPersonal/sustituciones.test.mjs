import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

function encontrarBoton(container, texto) {
  return [...container.querySelectorAll("button")].find((b) => b.textContent === texto);
}

// "Sustituciones" (panel profesor): ve sus sustituciones activas hoy,
// puede autodeclarar una para hoy y deshacer la suya autodeclarada — con
// UN SOLO estado visible a la vez en ambos flujos (nunca la acción y su
// confirmación juntas): con los dos visibles a la vez, un doble clic
// accidental llegó a crear sustituciones duplicadas en producción.
export async function run({ test, assert }) {
  const { renderSustituciones } = await import("../../assets/academia/profesor/js/sustituciones.js");

  test("sin sustituciones activas -> mensaje explícito", async () => {
    const container = document.createElement("div");
    await renderSustituciones(container, {
      fetchProfesoresFn: async () => [{ id: "p1", display_name: "Bea" }],
      fetchMisSustitucionesFn: async () => [],
      declararFn: async () => {},
    });
    assert.ok(container.textContent.includes("No tienes ninguna sustitución activa hoy"));
  });

  test("muestra las sustituciones activas: 'cubres a' y 'te cubre'", async () => {
    const container = document.createElement("div");
    await renderSustituciones(container, {
      fetchProfesoresFn: async () => [],
      fetchMisSustitucionesFn: async () => [
        { soy_sustituto: true, sustituido_nombre: "Bea", origen: "autodeclarada" },
        { soy_sustituto: false, sustituto_nombre: "Carlos", origen: "admin" },
      ],
      declararFn: async () => {},
    });
    assert.ok(container.textContent.includes("Hoy cubres a Bea"));
    assert.ok(container.textContent.includes("Hoy te cubre Carlos"));
  });

  test("sin más profesores en el centro -> no ofrece declarar", async () => {
    const container = document.createElement("div");
    await renderSustituciones(container, {
      fetchProfesoresFn: async () => [],
      fetchMisSustitucionesFn: async () => [],
      declararFn: async () => {},
    });
    assert.equal(container.querySelector("select"), null);
    assert.ok(container.textContent.includes("No hay más profesores"));
  });

  test("estado inicial: formulario visible, confirmación oculta", async () => {
    const container = document.createElement("div");
    await renderSustituciones(container, {
      fetchProfesoresFn: async () => [{ id: "p1", display_name: "Bea" }],
      fetchMisSustitucionesFn: async () => [],
      declararFn: async () => {},
    });
    const formRow = container.querySelector(".ac-sust-form-row");
    const confirmBox = container.querySelector(".ac-sust-confirm");
    assert.equal(formRow.classList.contains("hidden"), false);
    assert.ok(confirmBox.classList.contains("hidden"), "Confirmar/Cancelar no deben verse todavía");
    assert.ok(encontrarBoton(container, "Declarar sustitución"));
  });

  test("REGRESIÓN — tras pulsar 'Declarar sustitución', el botón desaparece y solo se ven Confirmar/Cancelar (nunca ambos estados a la vez)", async () => {
    const container = document.createElement("div");
    await renderSustituciones(container, {
      fetchProfesoresFn: async () => [{ id: "p1", display_name: "Bea" }],
      fetchMisSustitucionesFn: async () => [],
      declararFn: async () => {},
    });
    container.querySelector("select").value = "p1";
    encontrarBoton(container, "Declarar sustitución").dispatchEvent(new window.Event("click"));

    const formRow = container.querySelector(".ac-sust-form-row");
    const confirmBox = container.querySelector(".ac-sust-confirm");
    assert.ok(formRow.classList.contains("hidden"), "el selector+botón deben ocultarse al pasar a confirmar");
    assert.equal(confirmBox.classList.contains("hidden"), false);
    assert.ok(container.textContent.includes("¿Confirmas que cubres a Bea hoy?"));
  });

  test("cancelar declarar vuelve al estado inicial (formulario visible, confirmación oculta)", async () => {
    const container = document.createElement("div");
    let llamadas = 0;
    await renderSustituciones(container, {
      fetchProfesoresFn: async () => [{ id: "p1", display_name: "Bea" }],
      fetchMisSustitucionesFn: async () => [],
      declararFn: async () => { llamadas++; },
    });

    encontrarBoton(container, "Declarar sustitución").dispatchEvent(new window.Event("click"));
    encontrarBoton(container, "Cancelar").dispatchEvent(new window.Event("click"));

    assert.equal(llamadas, 0);
    const formRow = container.querySelector(".ac-sust-form-row");
    const confirmBox = container.querySelector(".ac-sust-confirm");
    assert.equal(formRow.classList.contains("hidden"), false, "debe poder reintentar tras cancelar");
    assert.ok(confirmBox.classList.contains("hidden"));
  });

  test("confirmar declara la sustitución, refresca la lista de activas y vuelve a mostrar el formulario", async () => {
    const container = document.createElement("div");
    let profesorDeclarado = null;
    let vecesFetchSustituciones = 0;
    await renderSustituciones(container, {
      fetchProfesoresFn: async () => [{ id: "p1", display_name: "Bea" }],
      fetchMisSustitucionesFn: async () => {
        vecesFetchSustituciones++;
        return vecesFetchSustituciones > 1 ? [{ soy_sustituto: true, sustituido_nombre: "Bea", origen: "autodeclarada" }] : [];
      },
      declararFn: async (id) => { profesorDeclarado = id; },
    });

    container.querySelector("select").value = "p1";
    encontrarBoton(container, "Declarar sustitución").dispatchEvent(new window.Event("click"));
    encontrarBoton(container, "Confirmar").dispatchEvent(new window.Event("click"));
    await new Promise((r) => setTimeout(r, 10));

    assert.equal(profesorDeclarado, "p1");
    assert.ok(container.textContent.includes("Hoy cubres a Bea"), "la sección de activas se recarga tras declarar");
  });

  test("un fallo al declarar muestra el error y no revienta", async () => {
    const container = document.createElement("div");
    await renderSustituciones(container, {
      fetchProfesoresFn: async () => [{ id: "p1", display_name: "Bea" }],
      fetchMisSustitucionesFn: async () => [],
      declararFn: async () => { throw new Error("no se pudo declarar"); },
    });

    encontrarBoton(container, "Declarar sustitución").dispatchEvent(new window.Event("click"));
    encontrarBoton(container, "Confirmar").dispatchEvent(new window.Event("click"));
    await new Promise((r) => setTimeout(r, 10));

    assert.ok(container.textContent.includes("no se pudo declarar"));
  });

  // ---- Deshacer (revocación por el propio profesor) ----

  test("una sustitución autodeclarada donde soy sustituto muestra botón de deshacer", async () => {
    const container = document.createElement("div");
    await renderSustituciones(container, {
      fetchProfesoresFn: async () => [],
      fetchMisSustitucionesFn: async () => [{ id: "s1", soy_sustituto: true, sustituido_nombre: "Bea", origen: "autodeclarada" }],
      declararFn: async () => {},
      revocarFn: async () => {},
    });
    assert.ok(container.querySelector(".ac-block-remove"), "debe poder deshacerse: es mía y autodeclarada");
  });

  test("una sustitución de origen='admin' NO muestra botón de deshacer, aunque sea sustituto", async () => {
    const container = document.createElement("div");
    await renderSustituciones(container, {
      fetchProfesoresFn: async () => [],
      fetchMisSustitucionesFn: async () => [{ id: "s1", soy_sustituto: true, sustituido_nombre: "Bea", origen: "admin" }],
      declararFn: async () => {},
      revocarFn: async () => {},
    });
    assert.equal(container.querySelector(".ac-block-remove"), null, "una de origen admin no puede deshacerse desde aquí — el backend la rechazaría con 403");
  });

  test("una sustitución donde soy el sustituido NO muestra botón de deshacer", async () => {
    const container = document.createElement("div");
    await renderSustituciones(container, {
      fetchProfesoresFn: async () => [],
      fetchMisSustitucionesFn: async () => [{ id: "s1", soy_sustituto: false, sustituto_nombre: "Carlos", origen: "autodeclarada" }],
      declararFn: async () => {},
      revocarFn: async () => {},
    });
    assert.equal(container.querySelector(".ac-block-remove"), null, "ser el cubierto no da derecho a deshacer la sustitución del otro");
  });

  test("REGRESIÓN — clic en deshacer pide confirmación ANTES de llamar a revocarFn (mismo criterio anti-doble-clic que declarar)", async () => {
    const container = document.createElement("div");
    let llamadas = 0;
    await renderSustituciones(container, {
      fetchProfesoresFn: async () => [],
      fetchMisSustitucionesFn: async () => [{ id: "s1", soy_sustituto: true, sustituido_nombre: "Bea", origen: "autodeclarada" }],
      declararFn: async () => {},
      revocarFn: async () => { llamadas++; },
    });

    container.querySelector(".ac-block-remove").dispatchEvent(new window.Event("click"));

    assert.equal(llamadas, 0, "todavía no debe llamar a la API — falta confirmar");
    assert.ok(container.textContent.includes("¿Deshacer la sustitución de Bea?"));
    const fila = container.querySelector(".ac-sust-item-fila");
    const confirmBox = container.querySelector(".ac-sust-confirm");
    assert.ok(fila.classList.contains("hidden"), "la fila con la X se oculta al pasar a confirmar");
    assert.equal(confirmBox.classList.contains("hidden"), false);
  });

  test("cancelar deshacer vuelve a mostrar la fila normal, sin llamar a revocarFn", async () => {
    const container = document.createElement("div");
    let llamadas = 0;
    await renderSustituciones(container, {
      fetchProfesoresFn: async () => [],
      fetchMisSustitucionesFn: async () => [{ id: "s1", soy_sustituto: true, sustituido_nombre: "Bea", origen: "autodeclarada" }],
      declararFn: async () => {},
      revocarFn: async () => { llamadas++; },
    });

    container.querySelector(".ac-block-remove").dispatchEvent(new window.Event("click"));
    encontrarBoton(container, "Cancelar").dispatchEvent(new window.Event("click"));

    assert.equal(llamadas, 0);
    const fila = container.querySelector(".ac-sust-item-fila");
    assert.equal(fila.classList.contains("hidden"), false);
  });

  test("confirmar deshacer llama a revocarFn con el id y refresca la lista", async () => {
    const container = document.createElement("div");
    let idRevocado = null;
    let vecesFetch = 0;
    await renderSustituciones(container, {
      fetchProfesoresFn: async () => [{ id: "p1", display_name: "Bea" }],
      fetchMisSustitucionesFn: async () => {
        vecesFetch++;
        return vecesFetch > 1 ? [] : [{ id: "s1", soy_sustituto: true, sustituido_nombre: "Bea", origen: "autodeclarada" }];
      },
      declararFn: async () => {},
      revocarFn: async (id) => { idRevocado = id; },
    });

    container.querySelector(".ac-block-remove").dispatchEvent(new window.Event("click"));
    encontrarBoton(container, "Sí, deshacer").dispatchEvent(new window.Event("click"));
    await new Promise((r) => setTimeout(r, 10));

    assert.equal(idRevocado, "s1");
    assert.ok(container.textContent.includes("No tienes ninguna sustitución activa hoy"));
  });

  test("un fallo al deshacer muestra el error y no revienta", async () => {
    const container = document.createElement("div");
    await renderSustituciones(container, {
      fetchProfesoresFn: async () => [],
      fetchMisSustitucionesFn: async () => [{ id: "s1", soy_sustituto: true, sustituido_nombre: "Bea", origen: "autodeclarada" }],
      declararFn: async () => {},
      revocarFn: async () => { throw new Error("no se pudo deshacer"); },
    });

    container.querySelector(".ac-block-remove").dispatchEvent(new window.Event("click"));
    encontrarBoton(container, "Sí, deshacer").dispatchEvent(new window.Event("click"));
    await new Promise((r) => setTimeout(r, 10));

    assert.ok(container.textContent.includes("no se pudo deshacer"));
  });
}
