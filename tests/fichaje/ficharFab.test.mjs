import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Intervalo enorme en los tests: no queremos que el refresco periódico
// (pensado para horas) interfiera con aserciones que corren en
// milisegundos, y createFicharFab llama a intervalo.unref() para que un
// timer real tampoco cuelgue el proceso de test.
const SIN_POLLING = { intervaloRefrescoMs: 24 * 60 * 60 * 1000 };

export async function run({ test, assert }) {
  const { createFicharFab } = await import("../../assets/shared/js/fichaje/ficharFab.js");

  test("mientras no se sabe el estado, empieza oculto", () => {
    const { el } = createFicharFab({
      fetchMiEstadoFichajeFn: () => new Promise(() => {}), // nunca resuelve
      ficharFnDep: async () => {},
      ...SIN_POLLING,
    });
    assert.ok(el.classList.contains("hidden"));
  });

  test("no ha fichado entrada hoy -> visible, modo 'pendiente', etiqueta 'Fichar entrada'", async () => {
    const { el } = createFicharFab({
      fetchMiEstadoFichajeFn: async () => ({ dentro: false, haFichadoEntradaHoy: false, ultimoTimestamp: null }),
      ficharFnDep: async () => {},
      ...SIN_POLLING,
    });
    await esperar(10);
    assert.equal(el.classList.contains("hidden"), false);
    assert.ok(el.classList.contains("pendiente"));
    assert.equal(el.classList.contains("regla"), false);
    assert.equal(el.querySelector(".ac-fichar-fab-label").textContent, "Fichar entrada");
    assert.ok(el.querySelector(".ac-fichaje-punto.fuera"));
  });

  test("dentro, sin llegar al umbral -> modo 'en regla' (compacto), sin texto visible", async () => {
    const { el } = createFicharFab({
      fetchMiEstadoFichajeFn: async () => ({ dentro: true, haFichadoEntradaHoy: true, ultimoTimestamp: new Date().toISOString() }),
      ficharFnDep: async () => {},
      ...SIN_POLLING,
    });
    await esperar(10);
    assert.ok(el.classList.contains("regla"));
    assert.equal(el.classList.contains("pendiente"), false);
    assert.equal(el.querySelector(".ac-fichar-fab-label").textContent, "");
    assert.ok(el.querySelector(".ac-fichaje-punto.dentro"));
    assert.equal(el.title, "Fichar salida", "el title describe la acción aunque no haya texto visible");
  });

  test("dentro desde hace más del umbral (8h) -> modo 'pendiente', etiqueta 'Fichar salida'", async () => {
    const hace9Horas = new Date(Date.now() - 9 * 3_600_000).toISOString();
    const { el } = createFicharFab({
      fetchMiEstadoFichajeFn: async () => ({ dentro: true, haFichadoEntradaHoy: true, ultimoTimestamp: hace9Horas }),
      ficharFnDep: async () => {},
      ...SIN_POLLING,
    });
    await esperar(10);
    assert.ok(el.classList.contains("pendiente"));
    assert.equal(el.querySelector(".ac-fichar-fab-label").textContent, "Fichar salida");
  });

  test("ya fichó entrada y salida hoy -> en regla, punto 'fuera'", async () => {
    const { el } = createFicharFab({
      fetchMiEstadoFichajeFn: async () => ({ dentro: false, haFichadoEntradaHoy: true, ultimoTimestamp: new Date().toISOString() }),
      ficharFnDep: async () => {},
      ...SIN_POLLING,
    });
    await esperar(10);
    assert.ok(el.classList.contains("regla"));
    assert.ok(el.querySelector(".ac-fichaje-punto.fuera"));
  });

  test("clic ficha la acción correcta (entrada) y refresca su propio estado sin recargar", async () => {
    const llamadas = [];
    let dentro = false;
    const { el } = createFicharFab({
      fetchMiEstadoFichajeFn: async () => ({ dentro, haFichadoEntradaHoy: dentro, ultimoTimestamp: new Date().toISOString() }),
      ficharFnDep: async (tipo) => { llamadas.push(tipo); dentro = tipo === "entrada"; },
      ...SIN_POLLING,
    });
    await esperar(10);
    el.dispatchEvent(new window.Event("click"));
    await esperar(10);
    assert.deepEqual(llamadas, ["entrada"]);
    assert.ok(el.classList.contains("regla"), "tras fichar entrada, pasa a 'en regla' (dentro, dentro del umbral)");
    assert.ok(el.querySelector(".ac-fichaje-punto.dentro"));
  });

  test("estando dentro, el clic ficha SALIDA (no reintenta entrada)", async () => {
    const llamadas = [];
    let dentro = true;
    const { el } = createFicharFab({
      fetchMiEstadoFichajeFn: async () => ({ dentro, haFichadoEntradaHoy: true, ultimoTimestamp: new Date().toISOString() }),
      ficharFnDep: async (tipo) => { llamadas.push(tipo); dentro = tipo === "entrada"; },
      ...SIN_POLLING,
    });
    await esperar(10);
    el.dispatchEvent(new window.Event("click"));
    await esperar(10);
    assert.deepEqual(llamadas, ["salida"]);
  });

  test("un fallo al fichar muestra un aviso temporal y no queda deshabilitado para siempre", async () => {
    const { el } = createFicharFab({
      fetchMiEstadoFichajeFn: async () => ({ dentro: false, haFichadoEntradaHoy: false, ultimoTimestamp: null }),
      ficharFnDep: async () => { throw new Error("fallo de red"); },
      ...SIN_POLLING,
    });
    await esperar(10);
    el.dispatchEvent(new window.Event("click"));
    await esperar(10);
    assert.equal(el.querySelector(".ac-fichar-fab-label").textContent, "Error");
    assert.equal(el.title, "fallo de red");
    assert.equal(el.disabled, false);
  });

  test("si no se puede comprobar el estado, se oculta (fail-safe) y no revienta", async () => {
    const { el } = createFicharFab({
      fetchMiEstadoFichajeFn: async () => { throw new Error("fallo de red"); },
      ficharFnDep: async () => {},
      ...SIN_POLLING,
    });
    await esperar(10);
    assert.ok(el.classList.contains("hidden"));
    assert.equal(el.disabled, true);
  });

  test("refrescar() vuelve a preguntar al servidor y repinta sin necesidad de un clic", async () => {
    let dentro = false;
    const { el, refrescar } = createFicharFab({
      fetchMiEstadoFichajeFn: async () => ({ dentro, haFichadoEntradaHoy: dentro, ultimoTimestamp: new Date().toISOString() }),
      ficharFnDep: async () => {},
      ...SIN_POLLING,
    });
    await esperar(10);
    assert.ok(el.classList.contains("pendiente"));

    dentro = true; // p.ej. otro dispositivo fichó entrada
    await refrescar();
    assert.ok(el.classList.contains("regla"));
  });

  test("detener() para el refresco periódico sin dejar timers colgados", async () => {
    const { detener } = createFicharFab({
      fetchMiEstadoFichajeFn: async () => ({ dentro: false, haFichadoEntradaHoy: false, ultimoTimestamp: null }),
      ficharFnDep: async () => {},
      intervaloRefrescoMs: 5,
    });
    await esperar(20);
    detener();
  });
}
