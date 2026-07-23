import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function run({ test, assert }) {
  const { abrirInvitarDialog } = await import("../assets/academia/admin/js/sections/profesores/invitarDialog.js");

  test("solo pide nombre y email — no hay ningún selector de grupo/asignatura", async () => {
    const promesa = abrirInvitarDialog();
    await esperar(5);
    assert.equal(document.querySelectorAll("select").length, 0, "un profesor de academia no elige grupos ni asignaturas");
    document.querySelector(".ac-btn.ghost").dispatchEvent(new window.Event("click"));
    await promesa;
  });

  test("guardar sin nombre muestra aviso y no resuelve todavía", async () => {
    const promesa = abrirInvitarDialog();
    await esperar(5);
    document.querySelector('input[type="email"]').value = "profe@demo.com";
    document.querySelector(".ac-btn.primary").dispatchEvent(new window.Event("click"));
    await esperar(5);
    const aviso = document.querySelector(".ac-drawer-msg.error");
    assert.equal(aviso.textContent, "El nombre es obligatorio.");
    document.querySelector(".ac-btn.ghost").dispatchEvent(new window.Event("click"));
    assert.equal(await promesa, null);
  });

  test("guardar con email inválido muestra aviso", async () => {
    const promesa = abrirInvitarDialog();
    await esperar(5);
    document.querySelector('input[type="text"]').value = "Profe Demo";
    document.querySelector('input[type="email"]').value = "no-es-un-email";
    document.querySelector(".ac-btn.primary").dispatchEvent(new window.Event("click"));
    await esperar(5);
    assert.equal(document.querySelector(".ac-drawer-msg.error").textContent, "Introduce un email válido.");
    document.querySelector(".ac-btn.ghost").dispatchEvent(new window.Event("click"));
    await promesa;
  });

  test("nombre + email válidos -> resuelve con ambos campos", async () => {
    const promesa = abrirInvitarDialog();
    await esperar(5);
    document.querySelector('input[type="text"]').value = "Profe Demo";
    document.querySelector('input[type="email"]').value = "profe@demo.com";
    document.querySelector(".ac-btn.primary").dispatchEvent(new window.Event("click"));
    const resultado = await promesa;
    assert.deepEqual(resultado, { email: "profe@demo.com", display_name: "Profe Demo" });
  });

  test("cancelar resuelve con null", async () => {
    const promesa = abrirInvitarDialog();
    await esperar(5);
    document.querySelector(".ac-btn.ghost").dispatchEvent(new window.Event("click"));
    assert.equal(await promesa, null);
  });
}
