import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

// Panel admin, sección "Lista de espera": antes era un simulacro
// (MOCK_INICIAL, sin backend real — ver auditoría de la sesión anterior).
// Foco de este test: los 3 requisitos explícitos del encargo — sin dato
// de ejemplo alguno, errores de crear/eliminar visibles (no en silencio,
// que fue justo el bug de los 7 sitios de la auditoría), y estados de
// carga/vacío reales.
export async function run({ test, assert }) {
  const { createListaEsperaSection } = await import("../assets/academia/admin/js/sections/listaEsperaSection.js");

  const ENTRADA = { id: "e1", nombre: "Marta Pérez", curso: "3º ESO", telefono: "612345678", notas: "Prefiere tardes" };

  function montar(overrides = {}) {
    const container = document.createElement("div");
    const section = createListaEsperaSection({
      fetchListaEsperaFn: async () => [ENTRADA],
      crearEntradaFn: async () => ({}),
      eliminarEntradaFn: async () => ({}),
      ...overrides,
    });
    section.render(container);
    return container;
  }

  test("muestra 'Cargando…' de inmediato, antes de que resuelva el fetch", () => {
    const container = document.createElement("div");
    let resolveFetch;
    const section = createListaEsperaSection({
      fetchListaEsperaFn: () => new Promise((r) => { resolveFetch = r; }),
    });
    section.render(container);
    assert.ok(container.textContent.includes("Cargando…"));
    resolveFetch([]);
  });

  test("sin ninguna entrada -> texto de lista vacía, no una tabla vacía", async () => {
    const container = montar({ fetchListaEsperaFn: async () => [] });
    await new Promise((r) => setTimeout(r, 10));

    assert.ok(container.textContent.includes("La lista de espera está vacía."));
    assert.equal(container.querySelector("table"), null);
  });

  test("con entradas reales -> se pintan en la tabla, ningún dato de ejemplo (Diego Ruiz/Aitana Soto) en el código", async () => {
    const container = montar();
    await new Promise((r) => setTimeout(r, 10));

    assert.ok(container.textContent.includes("Marta Pérez"));
    assert.ok(container.querySelector("table"));

    const fs = await import("node:fs");
    const src = fs.readFileSync(
      new URL("../assets/academia/admin/js/sections/listaEsperaSection.js", import.meta.url),
      "utf8"
    );
    assert.equal(src.includes("MOCK_INICIAL"), false);
    assert.equal(src.includes("Diego Ruiz"), false);
  });

  test("crear falla -> el error queda visible, el formulario NO se limpia", async () => {
    const container = montar({
      fetchListaEsperaFn: async () => [],
      crearEntradaFn: async () => { throw new Error("No se pudo añadir a la lista de espera."); },
    });
    await new Promise((r) => setTimeout(r, 10));

    const nombreInput = container.querySelector('input[placeholder="Nombre"]');
    nombreInput.value = "Nuevo Alumno";
    container.querySelector("button.ac-btn.primary").dispatchEvent(new window.Event("click"));
    await new Promise((r) => setTimeout(r, 10));

    assert.ok(container.textContent.includes("No se pudo añadir a la lista de espera."));
    assert.equal(nombreInput.value, "Nuevo Alumno", "el formulario no debe vaciarse si falló");
  });

  test("crear con éxito -> refresca la tabla y limpia el formulario", async () => {
    let vecesFetch = 0;
    const container = montar({
      fetchListaEsperaFn: async () => {
        vecesFetch++;
        return vecesFetch > 1 ? [ENTRADA, { id: "e2", nombre: "Nuevo Alumno", curso: null, telefono: null, notas: null }] : [];
      },
    });
    await new Promise((r) => setTimeout(r, 10));

    const nombreInput = container.querySelector('input[placeholder="Nombre"]');
    nombreInput.value = "Nuevo Alumno";
    container.querySelector("button.ac-btn.primary").dispatchEvent(new window.Event("click"));
    await new Promise((r) => setTimeout(r, 10));

    assert.equal(nombreInput.value, "", "el formulario sí se limpia si tuvo éxito");
    assert.ok(container.textContent.includes("Nuevo Alumno"));
  });

  test("eliminar falla -> el error queda visible, la fila sigue en la tabla", async () => {
    const container = montar({
      eliminarEntradaFn: async () => { throw new Error("No se pudo eliminar de la lista de espera."); },
    });
    await new Promise((r) => setTimeout(r, 10));

    container.querySelector("button.ac-icon-btn.danger").dispatchEvent(new window.Event("click"));
    await new Promise((r) => setTimeout(r, 10));

    assert.ok(container.textContent.includes("No se pudo eliminar de la lista de espera."));
    assert.ok(container.textContent.includes("Marta Pérez"), "la fila no debe desaparecer si falló el borrado");
  });

  test("eliminar con éxito -> la fila desaparece", async () => {
    let vecesFetch = 0;
    const container = montar({
      fetchListaEsperaFn: async () => {
        vecesFetch++;
        return vecesFetch > 1 ? [] : [ENTRADA];
      },
    });
    await new Promise((r) => setTimeout(r, 10));

    container.querySelector("button.ac-icon-btn.danger").dispatchEvent(new window.Event("click"));
    await new Promise((r) => setTimeout(r, 10));

    assert.equal(container.textContent.includes("Marta Pérez"), false);
    assert.ok(container.textContent.includes("La lista de espera está vacía."));
  });
}
