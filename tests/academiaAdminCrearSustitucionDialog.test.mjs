import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

export async function run({ test, assert }) {
  const { abrirCrearSustitucionDialog, rangoIncluyeHoy } = await import("../assets/academia/admin/js/sections/sustituciones/crearSustitucionDialog.js");

  const PROFESORES = [
    { id: "p1", display_name: "Ana" },
    { id: "p2", display_name: "Bea" },
    { id: "p3", display_name: "Carlos" },
  ];
  const HOY = "2026-07-26";

  test("rangoIncluyeHoy: hoy dentro del rango -> true", () => {
    assert.equal(rangoIncluyeHoy("2026-07-20", "2026-07-30", HOY), true);
  });
  test("rangoIncluyeHoy: rango futuro (aún no empezó) -> false", () => {
    assert.equal(rangoIncluyeHoy("2026-08-01", "2026-08-05", HOY), false);
  });
  test("rangoIncluyeHoy: rango pasado (ya terminó) -> false", () => {
    assert.equal(rangoIncluyeHoy("2026-07-01", "2026-07-05", HOY), false);
  });
  test("rangoIncluyeHoy: sin alguna fecha -> false, no revienta", () => {
    assert.equal(rangoIncluyeHoy("", "2026-07-30", HOY), false);
    assert.equal(rangoIncluyeHoy("2026-07-01", "", HOY), false);
  });

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

  test("REGRESIÓN — elegir un sustituto deshabilita esa misma opción en el desplegable de sustituido", async () => {
    const promesa = abrirCrearSustitucionDialog(PROFESORES, { hoyISO: HOY });
    const overlay = document.querySelector(".ac-modal-overlay");
    const [selectSustituto, selectSustituido] = overlay.querySelectorAll("select");

    selectSustituto.value = "p3";
    selectSustituto.dispatchEvent(new window.Event("change"));

    const opcionP3EnSustituido = [...selectSustituido.options].find((o) => o.value === "p3");
    assert.equal(opcionP3EnSustituido.disabled, true);

    overlay.querySelector(".ac-btn.ghost").dispatchEvent(new window.Event("click"));
    assert.equal(await promesa, null);
  });

  test("REGRESIÓN — si sustituido apuntaba al profesor que ahora se elige como sustituto, se mueve a otra opción disponible", async () => {
    const promesa = abrirCrearSustitucionDialog(PROFESORES, { hoyISO: HOY });
    const overlay = document.querySelector(".ac-modal-overlay");
    const [selectSustituto, selectSustituido] = overlay.querySelectorAll("select");

    selectSustituido.value = "p3";
    selectSustituto.value = "p3";
    selectSustituto.dispatchEvent(new window.Event("change"));

    assert.notEqual(selectSustituido.value, "p3", "no puede quedarse en la misma opción que el sustituto");

    overlay.querySelector(".ac-btn.ghost").dispatchEvent(new window.Event("click"));
    assert.equal(await promesa, null);
  });

  test("REGRESIÓN — rango sin hoy muestra el aviso informativo (no bloqueante) al crear", async () => {
    const promesa = abrirCrearSustitucionDialog(PROFESORES, { hoyISO: HOY });
    const overlay = document.querySelector(".ac-modal-overlay");
    const [inputInicio, inputFin] = overlay.querySelectorAll("input[type=date]");

    const avisoSinHoy = overlay.querySelector(".ac-nota");
    assert.ok(avisoSinHoy.classList.contains("hidden"), "con las fechas prellenadas a hoy, no debe verse todavía");

    inputInicio.value = "2026-08-01";
    inputInicio.dispatchEvent(new window.Event("change"));
    inputFin.value = "2026-08-05";
    inputFin.dispatchEvent(new window.Event("change"));

    assert.equal(avisoSinHoy.classList.contains("hidden"), false);
    assert.ok(avisoSinHoy.textContent.includes("no incluye el día de hoy"));

    overlay.querySelector(".ac-btn.ghost").dispatchEvent(new window.Event("click"));
    assert.equal(await promesa, null);
  });

  test("un rango que sí incluye hoy no muestra el aviso, y crear no queda bloqueado por él", async () => {
    const promesa = abrirCrearSustitucionDialog(PROFESORES, { hoyISO: HOY });
    const overlay = document.querySelector(".ac-modal-overlay");
    const [selectSustituto, selectSustituido] = overlay.querySelectorAll("select");
    const [inputInicio, inputFin] = overlay.querySelectorAll("input[type=date]");
    selectSustituto.value = "p1";
    selectSustituido.value = "p2";
    inputInicio.value = "2026-07-20";
    inputInicio.dispatchEvent(new window.Event("change"));
    inputFin.value = "2026-07-30";
    inputFin.dispatchEvent(new window.Event("change"));

    const avisoSinHoy = overlay.querySelector(".ac-nota");
    assert.ok(avisoSinHoy.classList.contains("hidden"));

    overlay.querySelector(".ac-btn.primary").dispatchEvent(new window.Event("click"));
    const resultado = await promesa;
    assert.deepEqual(resultado, {
      profesor_sustituto_id: "p1", profesor_sustituido_id: "p2", fecha_inicio: "2026-07-20", fecha_fin: "2026-07-30",
    });
  });
}
