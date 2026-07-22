import { Window } from "happy-dom";

// Entorno DOM (happy-dom), mismo patrón que academiaAdminInformeCardGenerar.test.mjs.
const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeFakeApi({ comentarioInicial = "Ya generado", enviadoAtInicial = null } = {}) {
  const llamadas = { enviarInforme: [] };
  return {
    llamadas,
    fetchInformePreview: async () => ({ comentario: comentarioInicial, dias: [{ dia: 1, asignatura: "Mates" }], enviadoAt: enviadoAtInicial }),
    enviarInforme: async (args) => { llamadas.enviarInforme.push(args); return { enviado: true }; },
  };
}

export async function run({ test, assert }) {
  const { buildInformeCard } = await import("../assets/academia/admin/js/sections/envioFamilias/informeCard.js");

  test("informe con comentario, no enviado -> 'Enviar informe' llama a api.enviarInforme con confirmar:false", async () => {
    const api = makeFakeApi({ enviadoAtInicial: null });
    const card = buildInformeCard({ id: "a1", nombre: "Ana" }, { mes: 7, anio: 2026, api, onCambio: () => {} });
    await esperar(20);

    const btn = [...card.querySelectorAll("button")].find((b) => b.textContent.trim() === "Enviar informe");
    assert.ok(btn, "debe mostrar 'Enviar informe' cuando hay comentario y no está enviado");

    btn.dispatchEvent(new window.Event("click"));
    await esperar(20);

    assert.deepEqual(api.llamadas.enviarInforme, [{ alumno_id: "a1", mes: 7, anio: 2026, confirmar: false }]);
  });

  // Antes de este cambio, "Enviar informe" desaparecía en cuanto el informe
  // estaba enviado (igual que le pasaba a "Regenerar informe") — sin forma
  // de reenviarlo. Ahora sigue disponible, con confirmación forward-only.
  test("informe YA enviado -> 'Enviar informe' sigue visible (ya no se oculta) y sigue llamando a api.enviarInforme", async () => {
    const api = makeFakeApi({ enviadoAtInicial: "2026-07-01T10:00:00.000Z" });
    const card = buildInformeCard({ id: "a1", nombre: "Ana" }, { mes: 7, anio: 2026, api, onCambio: () => {} });
    await esperar(20);

    assert.ok(card.textContent.includes("Enviado el"), "debe seguir mostrando el badge de enviado");
    const btn = [...card.querySelectorAll("button")].find((b) => b.textContent.trim() === "Enviar informe");
    assert.ok(btn, "el botón 'Enviar informe' ya no debe ocultarse cuando el informe está enviado");

    const regenerarBtn = [...card.querySelectorAll("button")].find((b) => b.textContent.includes("Regenerar informe"));
    assert.ok(regenerarBtn, "Regenerar informe también debe seguir disponible junto a Enviar");

    btn.dispatchEvent(new window.Event("click"));
    await esperar(20);

    assert.deepEqual(api.llamadas.enviarInforme, [{ alumno_id: "a1", mes: 7, anio: 2026, confirmar: false }]);
  });
}
