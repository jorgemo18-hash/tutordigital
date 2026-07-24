import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function run({ test, assert }) {
  const { createFicharBanner } = await import("../assets/academia/admin/js/banner/ficharBanner.js");

  test("ya fichó entrada hoy -> el banner permanece oculto", async () => {
    const { el } = createFicharBanner({
      fetchMiEstadoFichajeFn: async () => ({ haFichadoEntradaHoy: true }),
      ficharFnDep: async () => {},
    });
    await esperar(10);
    assert.ok(el.classList.contains("hidden"));
  });

  test("todavía no ha fichado entrada hoy -> el banner se muestra", async () => {
    const { el } = createFicharBanner({
      fetchMiEstadoFichajeFn: async () => ({ haFichadoEntradaHoy: false }),
      ficharFnDep: async () => {},
    });
    await esperar(10);
    assert.equal(el.classList.contains("hidden"), false);
    assert.ok(el.textContent.includes("Aún no has fichado hoy"));
  });

  test("si no se puede comprobar el estado, no se muestra nada (fail-safe)", async () => {
    const { el } = createFicharBanner({
      fetchMiEstadoFichajeFn: async () => { throw new Error("fallo de red"); },
      ficharFnDep: async () => {},
    });
    await esperar(10);
    assert.ok(el.classList.contains("hidden"));
  });

  test("clic en 'Fichar entrada' muestra confirmación antes de ocultar el banner", async () => {
    const llamadas = [];
    const { el } = createFicharBanner({
      fetchMiEstadoFichajeFn: async () => ({ haFichadoEntradaHoy: false }),
      ficharFnDep: async (tipo) => { llamadas.push(tipo); },
      confirmacionMs: 30,
    });
    await esperar(10);
    el.querySelector("button").dispatchEvent(new window.Event("click"));
    await esperar(10);
    assert.deepEqual(llamadas, ["entrada"]);
    // Antes de ocultarse, debe verse la confirmación — sin esto el banner
    // desaparecía sin más y se sentía como un fallo silencioso.
    assert.equal(el.classList.contains("hidden"), false, "todavía no debe ocultarse: hay que ver la confirmación primero");
    assert.equal(el.querySelector(".ac-drawer-msg").textContent, "✓ Fichado correctamente");
    await esperar(40);
    assert.ok(el.classList.contains("hidden"), "pasada la confirmación, el banner sí se oculta");
  });

  test("un fallo al fichar muestra el error y el banner sigue visible para reintentar", async () => {
    const { el } = createFicharBanner({
      fetchMiEstadoFichajeFn: async () => ({ haFichadoEntradaHoy: false }),
      ficharFnDep: async () => { throw new Error("no se pudo fichar"); },
    });
    await esperar(10);
    el.querySelector("button").dispatchEvent(new window.Event("click"));
    await esperar(10);
    assert.equal(el.classList.contains("hidden"), false, "debe seguir visible para poder reintentar");
    assert.equal(el.querySelector(".ac-drawer-msg").textContent, "no se pudo fichar");
  });

  test("no es un botón de solo lectura: no lleva ningún atributo que bloquee la navegación (no es modal)", async () => {
    const { el } = createFicharBanner({
      fetchMiEstadoFichajeFn: async () => ({ haFichadoEntradaHoy: false }),
      ficharFnDep: async () => {},
    });
    await esperar(10);
    assert.equal(el.tagName, "DIV");
    assert.equal(el.classList.contains("ac-modal-overlay"), false);
  });
}
