import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function reciboFixture() {
  return {
    id: "r1", estado: "borrador",
    concepto: "Julio 2026", descuento_puntual_pct: 0, descuento_puntual_nota: null,
    familia: { email: "familia@example.com" },
  };
}

export async function run({ test, assert }) {
  const { buildReciboEditor } = await import("../assets/academia/admin/js/sections/envioFamilias/reciboEditor.js");

  test("'Enviar a [email]' abre el diálogo de tipo primero, y llama a onEnviar(tipo, false) con lo elegido", async () => {
    const llamadas = { elegirTipoEnvio: 0, onEnviar: [] };
    const wrap = buildReciboEditor(reciboFixture(), {
      onGuardar: async () => {},
      onRegenerar: async () => {},
      onEnviar: async (tipo, confirmar) => { llamadas.onEnviar.push({ tipo, confirmar }); return { ok: true }; },
      elegirTipoEnvioFn: async () => { llamadas.elegirTipoEnvio += 1; return "solo_recibo"; },
    });

    const btn = [...wrap.querySelectorAll("button")].find((b) => b.textContent.includes("Enviar a familia@example.com"));
    assert.ok(btn, "debe mostrar el botón 'Enviar a [email]'");

    btn.dispatchEvent(new window.Event("click"));
    await esperar(20);

    assert.equal(llamadas.elegirTipoEnvio, 1);
    assert.deepEqual(llamadas.onEnviar, [{ tipo: "solo_recibo", confirmar: false }]);
    assert.equal(btn.textContent, "✓ Enviado");
  });

  test("cancelar el diálogo de tipo (resuelve null) -> NO llama a onEnviar, ni muestra error, vuelve a idle", async () => {
    const llamadas = { onEnviar: [] };
    const wrap = buildReciboEditor(reciboFixture(), {
      onGuardar: async () => {},
      onRegenerar: async () => {},
      onEnviar: async (tipo, confirmar) => { llamadas.onEnviar.push({ tipo, confirmar }); return { ok: true }; },
      elegirTipoEnvioFn: async () => null,
    });

    const btn = [...wrap.querySelectorAll("button")].find((b) => b.textContent.includes("Enviar a familia@example.com"));
    btn.dispatchEvent(new window.Event("click"));
    await esperar(20);

    assert.deepEqual(llamadas.onEnviar, [], "cancelar el diálogo no debe disparar el envío");
    assert.equal(btn.textContent, "Enviar a familia@example.com");
    const msg = wrap.querySelector(".ac-drawer-msg.error");
    assert.equal(msg, null, "cancelar no es un error, no debe mostrar aviso");
  });

  test("sin email de familia -> muestra aviso en vez del botón de enviar", async () => {
    const recibo = { ...reciboFixture(), familia: {} };
    const wrap = buildReciboEditor(recibo, { onGuardar: async () => {}, onRegenerar: async () => {}, onEnviar: async () => {} });
    assert.equal(wrap.textContent.includes("La familia no tiene email"), true);
  });
}
