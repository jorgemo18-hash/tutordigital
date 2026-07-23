import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function run({ test, assert }) {
  const { buildAutoFichajeWidget } = await import("../assets/academia/admin/js/sections/fichajes/autoFichajeWidget.js");

  test("estado inicial 'fuera' -> botón dice 'Fichar entrada'", async () => {
    const widget = buildAutoFichajeWidget({
      ficharFn: async () => ({}),
      fetchMiEstadoFichajeFn: async () => ({ dentro: false, ultimoTimestamp: null }),
    });
    await esperar(10);
    const btn = widget.querySelector("button");
    assert.equal(btn.textContent, "Fichar entrada");
    assert.equal(btn.disabled, false);
  });

  test("estado inicial 'dentro' -> botón dice 'Fichar salida'", async () => {
    const widget = buildAutoFichajeWidget({
      ficharFn: async () => ({}),
      fetchMiEstadoFichajeFn: async () => ({ dentro: true, ultimoTimestamp: "2026-07-05T08:00:00.000Z" }),
    });
    await esperar(10);
    const btn = widget.querySelector("button");
    assert.equal(btn.textContent, "Fichar salida");
  });

  test("clic en 'Fichar entrada' llama a ficharFn con 'entrada' y pasa a 'Fichar salida'", async () => {
    const llamadas = [];
    const widget = buildAutoFichajeWidget({
      ficharFn: async (tipo) => { llamadas.push(tipo); return {}; },
      fetchMiEstadoFichajeFn: async () => ({ dentro: false, ultimoTimestamp: null }),
    });
    await esperar(10);
    const btn = widget.querySelector("button");
    btn.dispatchEvent(new window.Event("click"));
    await esperar(10);

    assert.deepEqual(llamadas, ["entrada"]);
    assert.equal(btn.textContent, "Fichar salida");
  });

  test("un fallo de ficharFn muestra el mensaje de error y no cambia el estado", async () => {
    const widget = buildAutoFichajeWidget({
      ficharFn: async () => { throw new Error("no se pudo fichar"); },
      fetchMiEstadoFichajeFn: async () => ({ dentro: false, ultimoTimestamp: null }),
    });
    await esperar(10);
    const btn = widget.querySelector("button");
    btn.dispatchEvent(new window.Event("click"));
    await esperar(10);

    assert.equal(btn.textContent, "Fichar entrada", "un fallo no debe avanzar el estado dentro/fuera");
    const msg = widget.querySelector(".ac-drawer-msg");
    assert.equal(msg.textContent, "no se pudo fichar");
  });
}
