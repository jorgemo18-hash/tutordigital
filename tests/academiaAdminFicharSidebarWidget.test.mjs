import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function run({ test, assert }) {
  const { buildFicharSidebarWidget } = await import("../assets/academia/admin/js/sidebar/ficharSidebarWidget.js");

  test("estado inicial 'fuera' -> punto naranja y texto 'Fichar entrada'", async () => {
    const btn = buildFicharSidebarWidget({
      fetchMiEstadoFichajeFn: async () => ({ dentro: false }),
      ficharFnDep: async () => {},
    });
    await esperar(10);
    assert.ok(btn.querySelector(".ac-fichaje-punto.fuera"));
    assert.equal(btn.querySelector("span:last-child").textContent, "Fichar entrada");
    assert.equal(btn.disabled, false);
  });

  test("estado inicial 'dentro' -> punto verde y texto 'Fichar salida'", async () => {
    const btn = buildFicharSidebarWidget({
      fetchMiEstadoFichajeFn: async () => ({ dentro: true }),
      ficharFnDep: async () => {},
    });
    await esperar(10);
    assert.ok(btn.querySelector(".ac-fichaje-punto.dentro"));
    assert.equal(btn.querySelector("span:last-child").textContent, "Fichar salida");
  });

  test("clic ficha entrada y actualiza el estado del propio botón sin navegar a ningún sitio", async () => {
    const llamadas = [];
    const btn = buildFicharSidebarWidget({
      fetchMiEstadoFichajeFn: async () => ({ dentro: false }),
      ficharFnDep: async (tipo) => { llamadas.push(tipo); },
    });
    await esperar(10);
    btn.dispatchEvent(new window.Event("click"));
    await esperar(10);
    assert.deepEqual(llamadas, ["entrada"]);
    assert.ok(btn.querySelector(".ac-fichaje-punto.dentro"));
    assert.equal(btn.querySelector("span:last-child").textContent, "Fichar salida");
  });

  test("el punto de estado lleva la clase ac-sidebar-icon (visible incluso con el sidebar colapsado)", async () => {
    const btn = buildFicharSidebarWidget({
      fetchMiEstadoFichajeFn: async () => ({ dentro: false }),
      ficharFnDep: async () => {},
    });
    await esperar(10);
    const punto = btn.querySelector(".ac-fichaje-punto");
    assert.ok(punto.classList.contains("ac-sidebar-icon"));
  });

  test("un fallo al fichar no revienta y deja el botón operativo de nuevo", async () => {
    const btn = buildFicharSidebarWidget({
      fetchMiEstadoFichajeFn: async () => ({ dentro: false }),
      ficharFnDep: async () => { throw new Error("no se pudo fichar"); },
    });
    await esperar(10);
    btn.dispatchEvent(new window.Event("click"));
    await esperar(10);
    assert.equal(btn.disabled, false);
    // El estado no debe avanzar si la llamada real falló.
    assert.equal(btn.querySelector("span:last-child").textContent, "Fichar entrada");
  });
}
