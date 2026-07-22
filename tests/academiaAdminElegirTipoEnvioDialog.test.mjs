import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function run({ test, assert }) {
  const { elegirTipoEnvio } = await import("../assets/academia/admin/js/sections/envioFamilias/elegirTipoEnvioDialog.js");

  test("muestra las 3 opciones + Cancelar, con 'Recibo + informes' como opción por defecto (foco)", async () => {
    const promesa = elegirTipoEnvio();
    await esperar(10);
    const overlay = document.querySelector(".ac-modal-overlay");
    assert.ok(overlay, "debe montar el overlay del modal");
    const labels = [...overlay.querySelectorAll("button")].map((b) => b.textContent);
    assert.deepEqual(labels, ["Recibo + informes", "Solo recibo", "Solo informe(s)", "Cancelar"]);

    const defecto = [...overlay.querySelectorAll("button")].find((b) => b.textContent === "Recibo + informes");
    assert.equal(document.activeElement, defecto, "'Recibo + informes' debe tener el foco por defecto");

    defecto.dispatchEvent(new window.Event("click"));
    assert.equal(await promesa, "completo");
    assert.equal(document.querySelector(".ac-modal-overlay"), null, "debe desmontar el overlay al cerrar");
  });

  test("clic en 'Solo recibo' resuelve con 'solo_recibo'", async () => {
    const promesa = elegirTipoEnvio();
    await esperar(10);
    const btn = [...document.querySelectorAll(".ac-modal-overlay button")].find((b) => b.textContent === "Solo recibo");
    btn.dispatchEvent(new window.Event("click"));
    assert.equal(await promesa, "solo_recibo");
  });

  test("clic en 'Solo informe(s)' resuelve con 'solo_informe'", async () => {
    const promesa = elegirTipoEnvio();
    await esperar(10);
    const btn = [...document.querySelectorAll(".ac-modal-overlay button")].find((b) => b.textContent === "Solo informe(s)");
    btn.dispatchEvent(new window.Event("click"));
    assert.equal(await promesa, "solo_informe");
  });

  test("clic en 'Cancelar' resuelve con null", async () => {
    const promesa = elegirTipoEnvio();
    await esperar(10);
    const btn = [...document.querySelectorAll(".ac-modal-overlay button")].find((b) => b.textContent === "Cancelar");
    btn.dispatchEvent(new window.Event("click"));
    assert.equal(await promesa, null);
  });

  test("Escape resuelve con null", async () => {
    const promesa = elegirTipoEnvio();
    await esperar(10);
    document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
    assert.equal(await promesa, null);
  });

  test("clic en el overlay (fuera del panel) resuelve con null; clic dentro del panel no cierra", async () => {
    const promesa = elegirTipoEnvio();
    await esperar(10);
    const overlay = document.querySelector(".ac-modal-overlay");
    const panel = overlay.querySelector(".ac-modal-panel");
    panel.dispatchEvent(new window.Event("click", { bubbles: true }));
    assert.ok(document.querySelector(".ac-modal-overlay"), "un clic dentro del panel no debe cerrar el diálogo");
    overlay.dispatchEvent(new window.Event("click"));
    assert.equal(await promesa, null);
  });
}
