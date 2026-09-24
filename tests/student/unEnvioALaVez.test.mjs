import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;
if (!globalThis.localStorage) globalThis.localStorage = window.localStorage;

// MENSAJES DUPLICADOS A LOS DOS SEGUNDOS (conversaciones reales de mayo-junio).
// El botón se deshabilitaba tarde y solo el botón: Enter seguía enviando.
export async function run({ test, assert }) {
  const { createSendController } = await import("../../assets/student/controllers/send.js");
  const { crearCerrojoDeEnvio } = await import("../../assets/student/controllers/envio/unEnvioALaVez.js");

  function montar() {
    const llamadas = [];
    const pendientes = [];
    const inp = document.createElement("textarea");
    const ctl = createSendController({
      STATE: {}, inp, btn: document.createElement("button"),
      getModeChosen: () => true, getSelectedTopic: () => "Matemáticas",
      getPendingImage: () => null, getHistory: () => [], setHistory: () => {}, add: () => {},
      askGPT: (args) => { llamadas.push(args.text); return new Promise((r) => { pendientes.push(r); }); },
    });
    // Contesta a TODO lo pendiente: si el cerrojo fallara y salieran dos,
    // el test tiene que fallar por la cuenta, no quedarse colgado.
    return { ctl, inp, llamadas, responder: (t) => pendientes.splice(0).forEach((r) => r(t)) };
  }

  test("REGRESIÓN: Enter dos veces mientras el tutor contesta manda UN mensaje", async () => {
    const { ctl, inp, llamadas, responder } = montar();
    inp.value = "¿Cuánto es -3 + 5?";
    const primero = ctl.safeSend();
    await new Promise((r) => setTimeout(r, 0));
    inp.value = "¿Cuánto es -3 + 5?";
    const segundo = ctl.safeSend();
    const tercero = ctl.sendText("otra cosa");
    await new Promise((r) => setTimeout(r, 0));
    const enviados = llamadas.length;
    const quedo = inp.value;
    responder("2");
    await Promise.all([primero, segundo, tercero]);
    assert.equal(enviados, 1);
    assert.equal(quedo, "¿Cuánto es -3 + 5?", "lo escrito durante el envío no se pierde");
  });

  test("terminado el envío, el siguiente sí sale", async () => {
    const { ctl, inp, llamadas, responder } = montar();
    inp.value = "uno";
    const p = ctl.safeSend();
    await new Promise((r) => setTimeout(r, 0));
    responder("vale");
    await p;
    inp.value = "dos";
    const q = ctl.safeSend();
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(llamadas.length, 2);
    responder("ok"); await q;
  });

  test("el cerrojo se libera aunque el envío falle", async () => {
    const c = crearCerrojoDeEnvio();
    const f = c.envolver(async () => { throw new Error("red"); });
    await assert.rejects(f());
    assert.equal(c.ocupado, false);
  });
}
