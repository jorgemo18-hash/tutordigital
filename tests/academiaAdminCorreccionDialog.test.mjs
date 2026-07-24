import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function run({ test, assert }) {
  const { abrirCorreccionDialog } = await import("../assets/academia/admin/js/sections/fichajes/correccionDialog.js");

  test("tipo + motivo, sin notas -> resuelve con notas:null", async () => {
    const promesa = abrirCorreccionDialog({ tipoSugerido: "entrada" });
    await esperar(5);
    document.querySelector("textarea").value = "Se le olvidó fichar";
    document.querySelector(".ac-btn.primary").dispatchEvent(new window.Event("click"));
    const resultado = await promesa;
    assert.deepEqual(resultado, { tipo: "entrada", motivo: "Se le olvidó fichar", notas: null });
  });

  test("con notas rellenas, viajan en el resultado", async () => {
    const promesa = abrirCorreccionDialog({ tipoSugerido: "salida" });
    await esperar(5);
    const textareas = document.querySelectorAll("textarea");
    textareas[0].value = "Se le olvidó fichar";
    textareas[1].value = "Confirmado con el compañero de guardia.";
    document.querySelector(".ac-btn.primary").dispatchEvent(new window.Event("click"));
    const resultado = await promesa;
    assert.equal(resultado.notas, "Confirmado con el compañero de guardia.");
    assert.equal(resultado.tipo, "salida");
  });

  test("notas es un campo aparte del motivo — nunca obligatorio", async () => {
    const promesa = abrirCorreccionDialog({});
    await esperar(5);
    const labels = [...document.querySelectorAll(".ac-field-label")].map((el) => el.textContent);
    assert.ok(labels.some((l) => l.includes("Motivo") && l.includes("obligatorio")));
    assert.ok(labels.some((l) => l.includes("Notas") && l.includes("opcional")));
    document.querySelector("textarea").value = "motivo";
    document.querySelector(".ac-btn.primary").dispatchEvent(new window.Event("click"));
    const resultado = await promesa;
    assert.equal(resultado.notas, null, "dejar notas vacío no debe bloquear el guardado");
  });

  test("guardar sin motivo muestra aviso y no resuelve todavía", async () => {
    const promesa = abrirCorreccionDialog({});
    await esperar(5);
    document.querySelector(".ac-btn.primary").dispatchEvent(new window.Event("click"));
    await esperar(5);
    assert.equal(document.querySelector(".ac-drawer-msg.error").textContent, "El motivo es obligatorio.");
    document.querySelector(".ac-btn.ghost").dispatchEvent(new window.Event("click"));
    assert.equal(await promesa, null);
  });

  test("cancelar resuelve con null", async () => {
    const promesa = abrirCorreccionDialog({});
    await esperar(5);
    document.querySelector(".ac-btn.ghost").dispatchEvent(new window.Event("click"));
    assert.equal(await promesa, null);
  });
}
