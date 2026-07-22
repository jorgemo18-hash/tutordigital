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
    hayPendientes: true,
    onCambiarPeriodo: () => {}, onRegenerar: async () => ({}), onEnviar: async () => ({}),
    ...overrides,
  };
}

export async function run({ test, assert }) {
  const { buildCabecera } = await import("../assets/academia/admin/js/sections/envioFamilias/cabecera.js");

  test("solo dos botones de acción: 'Regenerar' y 'Enviar' (ya no hay 'Regenerar recibos'/'Regenerar informes'/'Enviar todos' sueltos)", () => {
    const head = buildCabecera(baseProps());
    const labels = [...head.querySelectorAll("button")].map((b) => b.textContent);
    assert.deepEqual(labels, ["Regenerar", "Enviar"]);
  });

  test("'Regenerar' abre el diálogo con las 3 opciones de lote y llama a onRegenerar(tipo) con lo elegido", async () => {
    const llamadas = { elegirAccion: [], onRegenerar: [] };
    const head = buildCabecera(baseProps({
      onRegenerar: async (tipo) => { llamadas.onRegenerar.push(tipo); },
      elegirAccionFn: async ({ titulo, opciones }) => { llamadas.elegirAccion.push(titulo); return opciones.find((o) => o.tipo === "solo_informe"); },
    }));

    const btn = [...head.querySelectorAll("button")].find((b) => b.textContent === "Regenerar");
    btn.dispatchEvent(new window.Event("click"));
    await esperar(20);

    assert.deepEqual(llamadas.elegirAccion, ["¿Qué quieres regenerar?"]);
    assert.deepEqual(llamadas.onRegenerar, ["solo_informe"]);
  });

  test("'Enviar' abre el diálogo con las 3 opciones de lote y llama a onEnviar(tipo) con lo elegido", async () => {
    const llamadas = { onEnviar: [] };
    const head = buildCabecera(baseProps({
      onEnviar: async (tipo) => { llamadas.onEnviar.push(tipo); },
      elegirAccionFn: async ({ opciones }) => opciones.find((o) => o.tipo === "solo_recibo"),
    }));

    const btn = [...head.querySelectorAll("button")].find((b) => b.textContent === "Enviar");
    btn.dispatchEvent(new window.Event("click"));
    await esperar(20);

    assert.deepEqual(llamadas.onEnviar, ["solo_recibo"]);
  });

  test("cancelar cualquiera de los dos diálogos -> no llama a onRegenerar/onEnviar", async () => {
    const llamadas = { onRegenerar: [], onEnviar: [] };
    const head = buildCabecera(baseProps({
      onRegenerar: async (t) => llamadas.onRegenerar.push(t),
      onEnviar: async (t) => llamadas.onEnviar.push(t),
      elegirAccionFn: async () => null,
    }));

    for (const label of ["Regenerar", "Enviar"]) {
      const btn = [...head.querySelectorAll("button")].find((b) => b.textContent === label);
      btn.dispatchEvent(new window.Event("click"));
      await esperar(20);
    }
    assert.deepEqual(llamadas, { onRegenerar: [], onEnviar: [] });
  });

  test("sin pendientes -> 'Enviar' nace deshabilitado; 'Regenerar' sigue habilitado", () => {
    const head = buildCabecera(baseProps({ hayPendientes: false }));
    const enviarBtn = [...head.querySelectorAll("button")].find((b) => b.textContent === "Enviar");
    const regenerarBtn = [...head.querySelectorAll("button")].find((b) => b.textContent === "Regenerar");
    assert.equal(enviarBtn.disabled, true);
    assert.equal(regenerarBtn.disabled, false);
  });
}
