import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

// "Sustituciones" (panel profesor): ve sus sustituciones activas hoy y
// puede autodeclarar una para hoy (sin selector de fechas — ver
// sustituciones.js). Nunca es "abrir el panel de otro profesor": el
// sustituto sigue siendo él mismo, con confirmación antes de declarar.
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
        { soy_sustituto: true, sustituido_nombre: "Bea" },
        { soy_sustituto: false, sustituto_nombre: "Carlos" },
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

  test("declarar pide confirmación antes de llamar a declararFn", async () => {
    const container = document.createElement("div");
    let llamadas = 0;
    await renderSustituciones(container, {
      fetchProfesoresFn: async () => [{ id: "p1", display_name: "Bea" }],
      fetchMisSustitucionesFn: async () => [],
      declararFn: async () => { llamadas++; },
    });

    container.querySelector("select").value = "p1";
    const declararBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Declarar sustitución");
    declararBtn.dispatchEvent(new window.Event("click"));

    assert.equal(llamadas, 0, "todavía no debe llamar a la API — falta confirmar");
    assert.ok(container.textContent.includes("¿Confirmas que cubres a Bea hoy?"));
  });

  test("confirmar declara la sustitución y refresca la lista de activas", async () => {
    const container = document.createElement("div");
    let profesorDeclarado = null;
    let vecesFetchSustituciones = 0;
    await renderSustituciones(container, {
      fetchProfesoresFn: async () => [{ id: "p1", display_name: "Bea" }],
      fetchMisSustitucionesFn: async () => {
        vecesFetchSustituciones++;
        return vecesFetchSustituciones > 1 ? [{ soy_sustituto: true, sustituido_nombre: "Bea" }] : [];
      },
      declararFn: async (id) => { profesorDeclarado = id; },
    });

    container.querySelector("select").value = "p1";
    const declararBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Declarar sustitución");
    declararBtn.dispatchEvent(new window.Event("click"));
    const confirmBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Confirmar");
    confirmBtn.dispatchEvent(new window.Event("click"));
    await new Promise((r) => setTimeout(r, 10));

    assert.equal(profesorDeclarado, "p1");
    assert.ok(container.textContent.includes("Hoy cubres a Bea"), "la sección de activas se recarga tras declarar");
  });

  test("cancelar no llama a declararFn", async () => {
    const container = document.createElement("div");
    let llamadas = 0;
    await renderSustituciones(container, {
      fetchProfesoresFn: async () => [{ id: "p1", display_name: "Bea" }],
      fetchMisSustitucionesFn: async () => [],
      declararFn: async () => { llamadas++; },
    });

    const declararBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Declarar sustitución");
    declararBtn.dispatchEvent(new window.Event("click"));
    const cancelBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Cancelar");
    cancelBtn.dispatchEvent(new window.Event("click"));

    assert.equal(llamadas, 0);
    assert.equal(declararBtn.disabled, false, "debe poder reintentar tras cancelar");
  });

  test("un fallo al declarar muestra el error y no revienta", async () => {
    const container = document.createElement("div");
    await renderSustituciones(container, {
      fetchProfesoresFn: async () => [{ id: "p1", display_name: "Bea" }],
      fetchMisSustitucionesFn: async () => [],
      declararFn: async () => { throw new Error("no se pudo declarar"); },
    });

    const declararBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Declarar sustitución");
    declararBtn.dispatchEvent(new window.Event("click"));
    const confirmBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Confirmar");
    confirmBtn.dispatchEvent(new window.Event("click"));
    await new Promise((r) => setTimeout(r, 10));

    assert.ok(container.textContent.includes("no se pudo declarar"));
  });
}
