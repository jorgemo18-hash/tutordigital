import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function baseProps(overrides = {}) {
  return {
    mes: 7, anio: 2026, mesesEnviados: [], anioActualSistema: 2026,
    hayRecibosEnPeriodo: true, hayPendientes: true,
    onCambiarPeriodo: () => {}, onRegenerarRecibos: async () => ({}), onRegenerarInformes: async () => ({}),
    onEnviarTodos: async () => {},
    ...overrides,
  };
}

export async function run({ test, assert }) {
  const { buildCabecera } = await import("../assets/academia/admin/js/sections/envioFamilias/cabecera.js");

  test("'Enviar todos' abre el diálogo de tipo primero, y llama a onEnviarTodos(tipo) con lo elegido", async () => {
    const llamadas = { elegirTipoEnvio: 0, onEnviarTodos: [] };
    const head = buildCabecera(baseProps({
      onEnviarTodos: async (tipo) => { llamadas.onEnviarTodos.push(tipo); },
      elegirTipoEnvioFn: async () => { llamadas.elegirTipoEnvio += 1; return "solo_informe"; },
    }));

    const btn = [...head.querySelectorAll("button")].find((b) => b.textContent === "Enviar todos");
    btn.dispatchEvent(new window.Event("click"));
    await esperar(20);

    assert.equal(llamadas.elegirTipoEnvio, 1);
    assert.deepEqual(llamadas.onEnviarTodos, ["solo_informe"]);
  });

  test("cancelar el diálogo de tipo -> NO llama a onEnviarTodos", async () => {
    const llamadas = { onEnviarTodos: [] };
    const head = buildCabecera(baseProps({
      onEnviarTodos: async (tipo) => { llamadas.onEnviarTodos.push(tipo); },
      elegirTipoEnvioFn: async () => null,
    }));

    const btn = [...head.querySelectorAll("button")].find((b) => b.textContent === "Enviar todos");
    btn.dispatchEvent(new window.Event("click"));
    await esperar(20);

    assert.deepEqual(llamadas.onEnviarTodos, []);
    assert.equal(btn.disabled, false, "debe quedar habilitado de nuevo tras cancelar");
  });

  test("sin pendientes -> el botón nace deshabilitado", () => {
    const head = buildCabecera(baseProps({ hayPendientes: false }));
    const btn = [...head.querySelectorAll("button")].find((b) => b.textContent === "Enviar todos");
    assert.equal(btn.disabled, true);
  });
}
