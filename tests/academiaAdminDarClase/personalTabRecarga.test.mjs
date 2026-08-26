import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// Guardar "el administrador da clase" tiene que verse al momento.
//
// Este ajuste cambia el MENÚ (aparece o desaparece "Dar clase") y el menú se
// construye una sola vez al arrancar el panel: se guardaba y no pasaba nada
// visible hasta recargar por cuenta propia, que es exactamente lo que parece
// un fallo. Le pasó a Jorge la primera vez que lo usó.
export async function run({ test, assert }) {
  const { buildPersonalTab } = await import(
    "../../assets/academia/admin/js/sections/ajustes/tabs/personalTab.js"
  );

  const asentar = () => new Promise((r) => setTimeout(r, 0));

  function montar(configInicial) {
    const guardados = [];
    let recargas = 0;
    const wrap = buildPersonalTab({
      fetchConfigFn: async () => configInicial,
      updateConfigFn: async (cambios) => { guardados.push(cambios); },
      recargarFn: () => { recargas++; },
    });
    return { wrap, guardados, recargas: () => recargas };
  }

  // El panel de "da clase" es el primero de la pestaña (ver buildPersonalTab).
  const panelDaClase = (wrap) => wrap.querySelectorAll(".ac-panel")[0];
  const guardarDe = (panel) => [...panel.querySelectorAll("button")].find((b) => b.textContent === "Guardar");
  const toggleDe = (panel) => panel.querySelector('input[type="checkbox"]');

  test("REGRESIÓN: al encenderlo, recarga para que aparezca «Dar clase»", async () => {
    const { wrap, guardados, recargas } = montar({ admin_imparte_clases: false });
    await asentar();
    const panel = panelDaClase(wrap);
    toggleDe(panel).checked = true;
    guardarDe(panel).click();
    await asentar();

    assert.deepEqual(guardados, [{ admin_imparte_clases: true }]);
    assert.equal(recargas(), 1);
  });

  test("al apagarlo también recarga: la sección tiene que desaparecer", async () => {
    const { wrap, recargas } = montar({ admin_imparte_clases: true });
    await asentar();
    const panel = panelDaClase(wrap);
    toggleDe(panel).checked = false;
    guardarDe(panel).click();
    await asentar();
    assert.equal(recargas(), 1);
  });

  test("guardar sin haber cambiado el interruptor NO recarga", async () => {
    // Recargar sin motivo tira lo que el admin estuviera mirando.
    const { wrap, guardados, recargas } = montar({ admin_imparte_clases: true });
    await asentar();
    const panel = panelDaClase(wrap);
    guardarDe(panel).click();
    await asentar();

    assert.deepEqual(guardados, [{ admin_imparte_clases: true }], "sí se guarda");
    assert.equal(recargas(), 0, "pero no recarga");
  });

  test("si el guardado falla, ni recarga ni miente", async () => {
    let recargas = 0;
    const wrap = buildPersonalTab({
      fetchConfigFn: async () => ({ admin_imparte_clases: false }),
      updateConfigFn: async () => { throw new Error("Sin conexión."); },
      recargarFn: () => { recargas++; },
    });
    await asentar();
    const panel = panelDaClase(wrap);
    toggleDe(panel).checked = true;
    guardarDe(panel).click();
    await asentar();

    assert.equal(recargas, 0);
    assert.ok(panel.textContent.includes("Sin conexión."), "el error queda a la vista");
  });
}
