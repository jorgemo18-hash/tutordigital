import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function itemFixture() {
  return {
    familia_id: "f1",
    recibo: { id: "r1", estado: "borrador", fecha_envio: null },
    alumnos_activos: [{ id: "a1", nombre: "Ana" }, { id: "a2", nombre: "Luis" }],
  };
}

function fakeApi() {
  const llamadas = { regenerarRecibo: [], generarInforme: [], enviarFamilia: [], enviarInforme: [] };
  return {
    llamadas,
    regenerarRecibo: async (id, confirmar) => { llamadas.regenerarRecibo.push({ id, confirmar }); return {}; },
    generarReciboFamilia: async () => ({ reciboId: "r-nuevo" }),
    generarInforme: async (args) => { llamadas.generarInforme.push(args); return {}; },
    enviarFamilia: async (args) => { llamadas.enviarFamilia.push(args); return {}; },
    enviarInforme: async (args) => { llamadas.enviarInforme.push(args); return {}; },
  };
}

export async function run({ test, assert }) {
  const { buildAccionesFamilia } = await import("../assets/academia/admin/js/sections/envioFamilias/acciones/accionesFamiliaBoton.js");

  test("'Regenerar' abre el diálogo con las opciones de familia (incluidos los hermanos) y ejecuta la elegida", async () => {
    const item = itemFixture();
    const api = fakeApi();
    let onAccionFamiliaLlamado = 0;
    const opcionesRecibidas = [];
    const wrap = buildAccionesFamilia(item, {
      mes: 7, anio: 2026, api,
      onAccionFamilia: async () => { onAccionFamiliaLlamado += 1; },
      elegirAccionFn: async ({ titulo, opciones }) => {
        opcionesRecibidas.push({ titulo, labels: opciones.map((o) => o.label) });
        return opciones.find((o) => o.label === "Regenerar informe de Luis");
      },
    });

    const btn = [...wrap.querySelectorAll("button")].find((b) => b.textContent === "Regenerar");
    btn.dispatchEvent(new window.Event("click"));
    await esperar(20);

    assert.equal(opcionesRecibidas[0].titulo, "¿Qué quieres regenerar?");
    assert.ok(opcionesRecibidas[0].labels.includes("Regenerar informe de Luis"));
    assert.deepEqual(api.llamadas.generarInforme, [{ alumno_id: "a2", mes: 7, anio: 2026, forzar: true, confirmar: false }]);
    assert.equal(api.llamadas.regenerarRecibo.length, 0, "eligió solo el informe de Luis, no debe tocar el recibo");
    assert.equal(onAccionFamiliaLlamado, 1, "debe refrescar lista+panel tras la acción");
  });

  test("'Enviar' con tipo 'solo_recibo' llama a enviarFamilia con ese tipo, no a enviarInforme", async () => {
    const item = itemFixture();
    const api = fakeApi();
    const wrap = buildAccionesFamilia(item, {
      mes: 7, anio: 2026, api, onAccionFamilia: async () => {},
      elegirAccionFn: async ({ opciones }) => opciones.find((o) => o.label === "Solo recibo"),
    });

    const btn = [...wrap.querySelectorAll("button")].find((b) => b.textContent === "Enviar");
    btn.dispatchEvent(new window.Event("click"));
    await esperar(20);

    assert.deepEqual(api.llamadas.enviarFamilia, [{ familia_id: "f1", mes: 7, anio: 2026, tipo: "solo_recibo", confirmar: false }]);
    assert.equal(api.llamadas.enviarInforme.length, 0);
  });

  test("cancelar el diálogo (resuelve null) -> no ejecuta nada, no llama a onAccionFamilia, sin error", async () => {
    const item = itemFixture();
    const api = fakeApi();
    let onAccionFamiliaLlamado = 0;
    const wrap = buildAccionesFamilia(item, {
      mes: 7, anio: 2026, api,
      onAccionFamilia: async () => { onAccionFamiliaLlamado += 1; },
      elegirAccionFn: async () => null,
    });

    const btn = [...wrap.querySelectorAll("button")].find((b) => b.textContent === "Regenerar");
    btn.dispatchEvent(new window.Event("click"));
    await esperar(20);

    assert.equal(api.llamadas.regenerarRecibo.length, 0);
    assert.equal(api.llamadas.generarInforme.length, 0);
    assert.equal(onAccionFamiliaLlamado, 0);
    assert.equal(wrap.querySelector(".ac-drawer-msg.error"), null, "cancelar no es un error");
  });
}
