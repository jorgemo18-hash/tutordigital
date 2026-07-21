import { Window } from "happy-dom";

// Entorno DOM (happy-dom), mismo patrón que academiaAdminDescuentosRecurrentesSection.test.mjs.
const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeFakeApi({ comentarioInicial = null, diasInicial = [{ dia: 1, asignatura: "Mates" }], enviadoAtInicial = null } = {}) {
  const llamadas = { generarInforme: [] };
  return {
    llamadas,
    fetchInformePreview: async () => ({ comentario: comentarioInicial, dias: diasInicial, enviadoAt: enviadoAtInicial }),
    generarInforme: async (args) => {
      llamadas.generarInforme.push(args);
      return { comentario: "Comentario generado", dias: diasInicial };
    },
  };
}

export async function run({ test, assert }) {
  const { buildInformeCard } = await import("../assets/academia/admin/js/sections/envioFamilias/informeCard.js");

  test("sin comentario -> el botón 'Generar informe' llama a generarInforme con forzar:false", async () => {
    const api = makeFakeApi({ comentarioInicial: null });
    const card = buildInformeCard({ id: "a1", nombre: "Ana", curso: "1º ESO" }, { mes: 7, anio: 2026, api, onCambio: () => {} });
    await esperar(20);

    const btn = [...card.querySelectorAll("button")].find((b) => b.textContent.includes("Generar informe"));
    assert.ok(btn, "debe mostrar el botón 'Generar informe' cuando no hay comentario todavía");

    btn.dispatchEvent(new window.Event("click"));
    await esperar(20);

    assert.deepEqual(api.llamadas.generarInforme, [{ alumno_id: "a1", mes: 7, anio: 2026, forzar: false }]);
  });

  test("con comentario ya generado (no enviado) -> el botón 'Regenerar informe' llama a generarInforme con forzar:true", async () => {
    const api = makeFakeApi({ comentarioInicial: "Ya tiene comentario", enviadoAtInicial: null });
    const card = buildInformeCard({ id: "a1", nombre: "Ana" }, { mes: 7, anio: 2026, api, onCambio: () => {} });
    await esperar(20);

    const btn = [...card.querySelectorAll("button")].find((b) => b.textContent.includes("Regenerar informe"));
    assert.ok(btn, "con comentario existente debe mostrar 'Regenerar informe', no 'Generar informe'");

    btn.dispatchEvent(new window.Event("click"));
    await esperar(20);

    assert.deepEqual(api.llamadas.generarInforme, [{ alumno_id: "a1", mes: 7, anio: 2026, forzar: true, confirmar: false }]);
  });
}
