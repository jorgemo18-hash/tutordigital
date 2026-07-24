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
    const { el } = buildFicharHeaderWidget({
      fetchMiEstadoFichajeFn: async () => ({ dentro: false }),
      ficharFnDep: async () => {},
    });
    await esperar(10);
    assert.ok(el.querySelector(".ac-fichaje-punto.fuera"));
    assert.equal(el.querySelector("span:last-child").textContent, "Fuera");
    assert.equal(el.title, "Fichar entrada");
  });

  test("estado inicial 'dentro' -> punto verde, texto 'Dentro'", async () => {
    const { el } = buildFicharHeaderWidget({
      fetchMiEstadoFichajeFn: async () => ({ dentro: true }),
      ficharFnDep: async () => {},
    });
    await esperar(10);
    assert.ok(el.querySelector(".ac-fichaje-punto.dentro"));
    assert.equal(el.querySelector("span:last-child").textContent, "Dentro");
    assert.equal(el.title, "Fichar salida");
  });

  test("clic ficha directamente sin navegar — pasa de 'Fuera' a 'Dentro' preguntando al servidor, no invirtiendo a ciegas", async () => {
    const llamadas = [];
    let dentro = false;
    const { el } = buildFicharHeaderWidget({
      fetchMiEstadoFichajeFn: async () => ({ dentro }),
      ficharFnDep: async (tipo) => { llamadas.push(tipo); dentro = tipo === "entrada"; },
    });
    await esperar(10);
    el.dispatchEvent(new window.Event("click"));
    await esperar(10);
    assert.deepEqual(llamadas, ["entrada"]);
    assert.equal(el.querySelector("span:last-child").textContent, "Dentro");
  });

  test("estando 'dentro', el clic ficha SALIDA (no vuelve a fichar entrada)", async () => {
    const llamadas = [];
    let dentro = true;
    const { el } = buildFicharHeaderWidget({
      fetchMiEstadoFichajeFn: async () => ({ dentro }),
      ficharFnDep: async (tipo) => { llamadas.push(tipo); dentro = tipo === "entrada"; },
    });
    await esperar(10);
    el.dispatchEvent(new window.Event("click"));
    await esperar(10);
    assert.deepEqual(llamadas, ["salida"]);
    assert.equal(el.querySelector("span:last-child").textContent, "Fuera");
  });

  test("tras fichar con éxito, avisa a onFichado (para que el banner pueda refrescarse)", async () => {
    let avisos = 0;
    const { el } = buildFicharHeaderWidget({
      fetchMiEstadoFichajeFn: async () => ({ dentro: false }),
      ficharFnDep: async () => {},
      onFichado: () => { avisos++; },
    });
    await esperar(10);
    el.dispatchEvent(new window.Event("click"));
    await esperar(10);
    assert.equal(avisos, 1);
  });

  test("un fallo al fichar NO avisa a onFichado", async () => {
    let avisos = 0;
    const { el } = buildFicharHeaderWidget({
      fetchMiEstadoFichajeFn: async () => ({ dentro: false }),
      ficharFnDep: async () => { throw new Error("fallo de red"); },
      onFichado: () => { avisos++; },
    });
    await esperar(10);
    el.dispatchEvent(new window.Event("click"));
    await esperar(10);
    assert.equal(avisos, 0);
  });

  test("refrescar() vuelve a preguntar al servidor y repinta, sin que el usuario haga clic", async () => {
    let dentro = false;
    const { el, refrescar } = buildFicharHeaderWidget({
      fetchMiEstadoFichajeFn: async () => ({ dentro }),
      ficharFnDep: async () => {},
    });
    await esperar(10);
    assert.equal(el.querySelector("span:last-child").textContent, "Fuera");

    dentro = true; // p.ej. el usuario fichó entrada desde el banner
    await refrescar();
    assert.equal(el.querySelector("span:last-child").textContent, "Dentro");
  });

  test("es un ac-pill (mismo tamaño que 'Claro'/'Cerrar sesión')", async () => {
    const { el } = buildFicharHeaderWidget({
      fetchMiEstadoFichajeFn: async () => ({ dentro: false }),
      ficharFnDep: async () => {},
    });
    assert.ok(el.classList.contains("ac-pill"));
    assert.ok(el.classList.contains("ac-fichar-pill"));
  });

  test("un fallo al fichar muestra un aviso temporal y no avanza el estado", async () => {
    const { el } = buildFicharHeaderWidget({
      fetchMiEstadoFichajeFn: async () => ({ dentro: false }),
      ficharFnDep: async () => { throw new Error("fallo de red"); },
    });
    await esperar(10);
    el.dispatchEvent(new window.Event("click"));
    await esperar(10);
    assert.equal(el.querySelector("span:last-child").textContent, "Error");
    assert.equal(el.title, "fallo de red");
    assert.equal(el.disabled, false);
  });
}
