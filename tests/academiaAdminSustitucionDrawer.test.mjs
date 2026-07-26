import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

export async function run({ test, assert }) {
  const { createSustitucionDrawer, rangoIncluyeHoy } = await import("../assets/academia/admin/js/sections/sustituciones/sustitucionDrawer.js");

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

  function montar(overrides = {}) {
    const root = document.createElement("div");
    const drawer = createSustitucionDrawer(root, {
      hoyISO: () => HOY,
      onGuardar: async () => {},
      ...overrides,
    });
    return { root, drawer };
  }

  test("open() monta el drawer en el root y le añade la clase open; close() la quita", () => {
    const { root, drawer } = montar();
    assert.equal(root.querySelector(".ac-drawer-overlay.open"), null);
    drawer.open(PROFESORES);
    assert.ok(root.querySelector(".ac-drawer-overlay.open"));
    drawer.close();
    assert.equal(root.querySelector(".ac-drawer-overlay.open"), null);
  });

  test("fechas prellenadas a hoy, sustituido preseleccionado distinto del sustituto", () => {
    const { root, drawer } = montar();
    drawer.open(PROFESORES);
    const [selectSustituto, selectSustituido] = root.querySelectorAll("select");
    const [inputInicio, inputFin] = root.querySelectorAll("input[type=date]");
    assert.equal(inputInicio.value, HOY);
    assert.equal(inputFin.value, HOY);
    assert.notEqual(selectSustituto.value, selectSustituido.value);
  });

  test("Cancelar cierra el drawer sin llamar a onGuardar", () => {
    let llamadas = 0;
    const { root, drawer } = montar({ onGuardar: async () => { llamadas++; } });
    drawer.open(PROFESORES);
    root.querySelector(".ac-btn.ghost").dispatchEvent(new window.Event("click"));
    assert.equal(llamadas, 0);
    assert.equal(root.querySelector(".ac-drawer-overlay.open"), null);
  });

  test("crear con datos válidos llama a onGuardar con el payload correcto y cierra", async () => {
    let recibido = null;
    const { root, drawer } = montar({ onGuardar: async (datos) => { recibido = datos; } });
    drawer.open(PROFESORES);
    const [selectSustituto, selectSustituido] = root.querySelectorAll("select");
    const [inputInicio, inputFin] = root.querySelectorAll("input[type=date]");
    selectSustituto.value = "p1";
    selectSustituido.value = "p2";
    inputInicio.value = "2026-08-01";
    inputFin.value = "2026-08-05";
    root.querySelector(".ac-btn.primary").dispatchEvent(new window.Event("click"));
    await new Promise((r) => setTimeout(r, 10));
    assert.deepEqual(recibido, {
      profesor_sustituto_id: "p1", profesor_sustituido_id: "p2", fecha_inicio: "2026-08-01", fecha_fin: "2026-08-05",
    });
    assert.equal(root.querySelector(".ac-drawer-overlay.open"), null);
  });

  test("sustituto y sustituido iguales -> muestra aviso, no llama a onGuardar ni cierra", async () => {
    let llamadas = 0;
    const { root, drawer } = montar({ onGuardar: async () => { llamadas++; } });
    drawer.open(PROFESORES);
    const [selectSustituto, selectSustituido] = root.querySelectorAll("select");
    selectSustituto.value = "p1";
    selectSustituido.value = "p1";
    root.querySelector(".ac-btn.primary").dispatchEvent(new window.Event("click"));
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(llamadas, 0);
    assert.ok(root.querySelector(".ac-drawer-msg").textContent.includes("no pueden ser el mismo"));
    assert.ok(root.querySelector(".ac-drawer-overlay.open"), "el drawer sigue abierto");
  });

  test("fecha_fin anterior a fecha_inicio -> muestra aviso, no llama a onGuardar", async () => {
    let llamadas = 0;
    const { root, drawer } = montar({ onGuardar: async () => { llamadas++; } });
    drawer.open(PROFESORES);
    const [inputInicio, inputFin] = root.querySelectorAll("input[type=date]");
    inputInicio.value = "2026-08-10";
    inputFin.value = "2026-08-05";
    root.querySelector(".ac-btn.primary").dispatchEvent(new window.Event("click"));
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(llamadas, 0);
    assert.ok(root.querySelector(".ac-drawer-msg").textContent.includes("no puede ser anterior"));
  });

  test("un fallo de onGuardar muestra el error y no cierra el drawer", async () => {
    const { root, drawer } = montar({ onGuardar: async () => { throw new Error("no se pudo crear"); } });
    drawer.open(PROFESORES);
    root.querySelector(".ac-btn.primary").dispatchEvent(new window.Event("click"));
    await new Promise((r) => setTimeout(r, 10));
    assert.ok(root.querySelector(".ac-drawer-msg").textContent.includes("no se pudo crear"));
    assert.ok(root.querySelector(".ac-drawer-overlay.open"));
  });

  test("REGRESIÓN — elegir un sustituto deshabilita esa misma opción en el desplegable de sustituido", () => {
    const { root, drawer } = montar();
    drawer.open(PROFESORES);
    const [selectSustituto, selectSustituido] = root.querySelectorAll("select");

    selectSustituto.value = "p3";
    selectSustituto.dispatchEvent(new window.Event("change"));

    const opcionP3EnSustituido = [...selectSustituido.options].find((o) => o.value === "p3");
    assert.equal(opcionP3EnSustituido.disabled, true);
  });

  test("REGRESIÓN — si sustituido apuntaba al profesor que ahora se elige como sustituto, se mueve a otra opción disponible", () => {
    const { root, drawer } = montar();
    drawer.open(PROFESORES);
    const [selectSustituto, selectSustituido] = root.querySelectorAll("select");

    selectSustituido.value = "p3";
    selectSustituto.value = "p3";
    selectSustituto.dispatchEvent(new window.Event("change"));

    assert.notEqual(selectSustituido.value, "p3", "no puede quedarse en la misma opción que el sustituto");
  });

  test("REGRESIÓN — rango sin hoy muestra el aviso informativo (no bloqueante) al crear", async () => {
    let llamadas = 0;
    const { root, drawer } = montar({ onGuardar: async () => { llamadas++; } });
    drawer.open(PROFESORES);
    const [inputInicio, inputFin] = root.querySelectorAll("input[type=date]");

    const avisoSinHoy = root.querySelector(".ac-nota");
    assert.ok(avisoSinHoy.classList.contains("hidden"), "con las fechas prellenadas a hoy, no debe verse todavía");

    inputInicio.value = "2026-08-01";
    inputInicio.dispatchEvent(new window.Event("change"));
    inputFin.value = "2026-08-05";
    inputFin.dispatchEvent(new window.Event("change"));

    assert.equal(avisoSinHoy.classList.contains("hidden"), false);
    assert.ok(avisoSinHoy.textContent.includes("no incluye el día de hoy"));

    root.querySelector(".ac-btn.primary").dispatchEvent(new window.Event("click"));
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(llamadas, 1, "el aviso es informativo, no bloquea la creación");
  });

  test("abrir el drawer una segunda vez reconstruye el formulario desde cero (sin residuos de la vez anterior)", () => {
    const { root, drawer } = montar();
    drawer.open(PROFESORES);
    const [selectSustituto] = root.querySelectorAll("select");
    selectSustituto.value = "p3";
    drawer.close();

    drawer.open(PROFESORES);
    const [selectSustitutoDeNuevo] = root.querySelectorAll("select");
    assert.equal(selectSustitutoDeNuevo.value, "p1");
  });
}
