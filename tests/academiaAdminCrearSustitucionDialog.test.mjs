import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

export async function run({ test, assert }) {
  const { abrirCrearSustitucionDialog } = await import("../assets/academia/admin/js/sections/sustituciones/crearSustitucionDialog.js");

  const PROFESORES = [
    { id: "p1", display_name: "Ana" },
    { id: "p2", display_name: "Bea" },
  ];
  const HOY = "2026-07-26";

  test("fechas prellenadas a hoy, sustituido preseleccionado distinto del sustituto", async () => {
    const promesa = abrirCrearSustitucionDialog(PROFESORES, { hoyISO: HOY });
    const overlay = document.querySelector(".ac-modal-overlay");
    const [selectSustituto, selectSustituido] = overlay.querySelectorAll("select");
    const [inputInicio, inputFin] = overlay.querySelectorAll("input[type=date]");
    assert.equal(inputInicio.value, HOY);
    assert.equal(inputFin.value, HOY);
    assert.notEqual(selectSustituto.value, selectSustituido.value);
    overlay.querySelector(".ac-btn.ghost").dispatchEvent(new window.Event("click"));
    assert.equal(await promesa, null);
  });

  test("crear con datos válidos resuelve con el payload correcto", async () => {
    const promesa = abrirCrearSustitucionDialog(PROFESORES, { hoyISO: HOY });
    const overlay = document.querySelector(".ac-modal-overlay");
    const [selectSustituto, selectSustituido] = overlay.querySelectorAll("select");
    const [inputInicio, inputFin] = overlay.querySelectorAll("input[type=date]");
    selectSustituto.value = "p1";
    selectSustituido.value = "p2";
    inputInicio.value = "2026-08-01";
    inputFin.value = "2026-08-05";
    overlay.querySelector(".ac-btn.primary").dispatchEvent(new window.Event("click"));
    const resultado = await promesa;
    assert.deepEqual(resultado, {
      profesor_sustituto_id: "p1", profesor_sustituido_id: "p2", fecha_inicio: "2026-08-01", fecha_fin: "2026-08-05",
    });
  });

  test("sustituto y sustituido iguales -> muestra aviso, no resuelve", async () => {
    const promesa = abrirCrearSustitucionDialog(PROFESORES, { hoyISO: HOY });
    const overlay = document.querySelector(".ac-modal-overlay");
    const [selectSustituto, selectSustituido] = overlay.querySelectorAll("select");
    selectSustituto.value = "p1";
    selectSustituido.value = "p1";
    overlay.querySelector(".ac-btn.primary").dispatchEvent(new window.Event("click"));
    assert.ok(overlay.querySelector(".ac-drawer-msg").textContent.includes("no pueden ser el mismo"));
    overlay.querySelector(".ac-btn.ghost").dispatchEvent(new window.Event("click"));
    assert.equal(await promesa, null);
  });

  test("fecha_fin anterior a fecha_inicio -> muestra aviso, no resuelve", async () => {
    const promesa = abrirCrearSustitucionDialog(PROFESORES, { hoyISO: HOY });
    const overlay = document.querySelector(".ac-modal-overlay");
    const [inputInicio, inputFin] = overlay.querySelectorAll("input[type=date]");
    inputInicio.value = "2026-08-10";
    inputFin.value = "2026-08-05";
    overlay.querySelector(".ac-btn.primary").dispatchEvent(new window.Event("click"));
    assert.ok(overlay.querySelector(".ac-drawer-msg").textContent.includes("no puede ser anterior"));
    overlay.querySelector(".ac-btn.ghost").dispatchEvent(new window.Event("click"));
    assert.equal(await promesa, null);
  });

  test("clic fuera del panel (overlay) cancela, igual que Cancelar", async () => {
    const promesa = abrirCrearSustitucionDialog(PROFESORES, { hoyISO: HOY });
    const overlay = document.querySelector(".ac-modal-overlay");
    overlay.dispatchEvent(new window.Event("click"));
    assert.equal(await promesa, null);
  });
}
