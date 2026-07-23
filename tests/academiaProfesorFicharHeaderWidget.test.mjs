import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function run({ test, assert }) {
  const { buildFicharHeaderWidget } = await import("../assets/academia/profesor/js/header/ficharHeaderWidget.js");

  test("estado inicial 'fuera' -> punto naranja, texto 'Fuera', título indica la acción", async () => {
    const btn = buildFicharHeaderWidget({
      fetchMiEstadoFichajeFn: async () => ({ dentro: false }),
      ficharFnDep: async () => {},
    });
    await esperar(10);
    assert.ok(btn.querySelector(".ac-fichaje-punto.fuera"));
    assert.equal(btn.querySelector("span:last-child").textContent, "Fuera");
    assert.equal(btn.title, "Fichar entrada");
  });

  test("estado inicial 'dentro' -> punto verde, texto 'Dentro'", async () => {
    const btn = buildFicharHeaderWidget({
      fetchMiEstadoFichajeFn: async () => ({ dentro: true }),
      ficharFnDep: async () => {},
    });
    await esperar(10);
    assert.ok(btn.querySelector(".ac-fichaje-punto.dentro"));
    assert.equal(btn.querySelector("span:last-child").textContent, "Dentro");
    assert.equal(btn.title, "Fichar salida");
  });

  test("clic ficha directamente sin navegar — pasa de 'Fuera' a 'Dentro'", async () => {
    const llamadas = [];
    const btn = buildFicharHeaderWidget({
      fetchMiEstadoFichajeFn: async () => ({ dentro: false }),
      ficharFnDep: async (tipo) => { llamadas.push(tipo); },
    });
    await esperar(10);
    btn.dispatchEvent(new window.Event("click"));
    await esperar(10);
    assert.deepEqual(llamadas, ["entrada"]);
    assert.equal(btn.querySelector("span:last-child").textContent, "Dentro");
  });

  test("es un ac-pill (mismo tamaño que 'Claro'/'Cerrar sesión')", async () => {
    const btn = buildFicharHeaderWidget({
      fetchMiEstadoFichajeFn: async () => ({ dentro: false }),
      ficharFnDep: async () => {},
    });
    assert.ok(btn.classList.contains("ac-pill"));
    assert.ok(btn.classList.contains("ac-fichar-pill"));
  });

  test("un fallo al fichar muestra un aviso temporal y no avanza el estado", async () => {
    const btn = buildFicharHeaderWidget({
      fetchMiEstadoFichajeFn: async () => ({ dentro: false }),
      ficharFnDep: async () => { throw new Error("fallo de red"); },
    });
    await esperar(10);
    btn.dispatchEvent(new window.Event("click"));
    await esperar(10);
    assert.equal(btn.querySelector("span:last-child").textContent, "Error");
    assert.equal(btn.title, "fallo de red");
    assert.equal(btn.disabled, false);
  });
}
