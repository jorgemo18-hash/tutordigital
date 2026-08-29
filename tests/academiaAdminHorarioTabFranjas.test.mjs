import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

// Panel Ajustes › Horario, "Franjas horarias": antes era un array editable
// en memoria que nunca guardaba nada (el propio hint decía "sin guardar
// en el servidor todavía" — ver auditoría de la sesión anterior). Foco de
// este test: guarda de verdad, la vista previa es de solo lectura
// calculada con generarHoras(), el aviso de huérfanos solo aparece si los
// tramos generados cambian, y los errores de guardado quedan visibles.
export async function run({ test, assert }) {
  const { buildFranjasPanel } = await import(
    "../assets/academia/admin/js/sections/ajustes/tabs/horarioTab.js"
  );

  const CONFIG = { franja_inicio: "15:30", franja_fin: "20:30", franja_duracion: 60 };

  function montar(overrides = {}) {
    const container = document.createElement("div");
    const panel = buildFranjasPanel({
      fetchConfigFn: async () => CONFIG,
      updateConfigFn: async () => {},
      fetchImpactoHorarioFn: async () => 0,
      confirmFn: () => true,
      ...overrides,
    });
    container.appendChild(panel);
    return container;
  }

  test("carga la config real y pinta la rejilla de medias horas (15:30-20:30) — sin FRANJAS_SEED", async () => {
    // Antes esta vista previa listaba "tramos" de la duración configurada y
    // eso hacía creer que un alumno solo podía entrar a esas horas. La
    // rejilla va por medias horas (ver horarioTramos.js): 15:30-20:30 son 10.
    const container = montar();
    await new Promise((r) => setTimeout(r, 10));

    assert.equal(container.textContent.includes("Cargando…"), false);
    assert.ok(container.textContent.includes("10 medias horas de apertura"));
    assert.ok(container.textContent.includes("15:30"));
    assert.ok(container.textContent.includes("19:30"));
    // No debe quedar ningún botón "Añadir franja" (eliminado del todo).
    assert.equal(container.textContent.includes("Añadir franja"), false);
  });

  test("cambiar la duración estándar dice cuántas casillas ocupa, no cambia la rejilla", async () => {
    const container = montar();
    await new Promise((r) => setTimeout(r, 10));

    const duracionInput = container.querySelector('input[type="number"]');
    duracionInput.value = "90";
    duracionInput.dispatchEvent(new window.Event("input"));

    assert.ok(container.textContent.includes("3 casillas"), "90 min = 3 medias horas");
    assert.ok(container.textContent.includes("10 medias horas de apertura"), "la rejilla no depende de la duración");
  });

  test("cambiar el cierre sí cambia la rejilla", async () => {
    const container = montar();
    await new Promise((r) => setTimeout(r, 10));

    const finInput = container.querySelectorAll('input[type="time"]')[1];
    finInput.value = "19:30";
    finInput.dispatchEvent(new window.Event("input"));

    assert.ok(container.textContent.includes("8 medias horas de apertura"), "15:30-19:30 son 8");
  });

  test("REGRESIÓN: cambiar SOLO la duración ya no avisa de huérfanos", async () => {
    // Antes la duración dibujaba las filas, así que tocarla descolocaba
    // todas las clases. Ahora solo dice cuántas casillas marca un clic: no
    // mueve ninguna clase existente, y preguntar por huérfanos era asustar
    // al admin sin motivo.
    let vecesImpacto = 0;
    const container = montar({ fetchImpactoHorarioFn: async () => { vecesImpacto++; return 47; } });
    await new Promise((r) => setTimeout(r, 10));

    const duracionInput = container.querySelector('input[type="number"]');
    duracionInput.value = "90";
    duracionInput.dispatchEvent(new window.Event("input"));
    container.querySelector("button.ac-btn.primary").dispatchEvent(new window.Event("click"));
    await new Promise((r) => setTimeout(r, 10));

    assert.equal(vecesImpacto, 0);
    assert.ok(container.textContent.includes("✓ Guardado"));
  });

  test("guardar SIN cambiar los tramos generados -> no consulta impacto ni pide confirmación", async () => {
    let vecesImpacto = 0;
    let confirmLlamado = false;
    const container = montar({
      fetchImpactoHorarioFn: async () => { vecesImpacto++; return 5; },
      confirmFn: () => { confirmLlamado = true; return true; },
    });
    await new Promise((r) => setTimeout(r, 10));

    container.querySelector("button.ac-btn.primary").dispatchEvent(new window.Event("click"));
    await new Promise((r) => setTimeout(r, 10));

    assert.equal(vecesImpacto, 0, "los tramos no cambiaron, no hace falta consultar el impacto");
    assert.equal(confirmLlamado, false);
    assert.ok(container.textContent.includes("✓ Guardado"));
  });

  test("guardar cambiando los tramos, SIN huérfanos -> guarda directo, sin confirmación", async () => {
    let confirmLlamado = false;
    const container = montar({
      fetchImpactoHorarioFn: async () => 0,
      confirmFn: () => { confirmLlamado = true; return true; },
    });
    await new Promise((r) => setTimeout(r, 10));

    const finInput = container.querySelectorAll('input[type="time"]')[1];
    finInput.value = "19:30";
    finInput.dispatchEvent(new window.Event("input"));
    container.querySelector("button.ac-btn.primary").dispatchEvent(new window.Event("click"));
    await new Promise((r) => setTimeout(r, 10));

    assert.equal(confirmLlamado, false, "0 huérfanos no necesita confirmación");
    assert.ok(container.textContent.includes("✓ Guardado"));
  });

  test("guardar cambiando los tramos, CON huérfanos -> pide confirmación con el número exacto", async () => {
    let preguntado = null;
    const container = montar({
      fetchImpactoHorarioFn: async () => 47,
      confirmFn: (msg) => { preguntado = msg; return true; },
    });
    await new Promise((r) => setTimeout(r, 10));

    const finInput = container.querySelectorAll('input[type="time"]')[1];
    finInput.value = "19:30";
    finInput.dispatchEvent(new window.Event("input"));
    container.querySelector("button.ac-btn.primary").dispatchEvent(new window.Event("click"));
    await new Promise((r) => setTimeout(r, 10));

    assert.ok(preguntado.includes("47"));
    assert.ok(preguntado.includes("clases asignadas dejarían de aparecer en el horario"));
  });

  test("si se cancela la confirmación de huérfanos -> NO guarda", async () => {
    let guardado = false;
    const container = montar({
      fetchImpactoHorarioFn: async () => 3,
      confirmFn: () => false,
      updateConfigFn: async () => { guardado = true; },
    });
    await new Promise((r) => setTimeout(r, 10));

    const finInput = container.querySelectorAll('input[type="time"]')[1];
    finInput.value = "19:30";
    finInput.dispatchEvent(new window.Event("input"));
    container.querySelector("button.ac-btn.primary").dispatchEvent(new window.Event("click"));
    await new Promise((r) => setTimeout(r, 10));

    assert.equal(guardado, false);
    assert.equal(container.textContent.includes("✓ Guardado"), false);
  });

  test("un fallo al guardar muestra el error visible (mismo componente que lista de espera)", async () => {
    const container = montar({
      updateConfigFn: async () => { throw new Error("No se pudo guardar la franja horaria."); },
    });
    await new Promise((r) => setTimeout(r, 10));

    container.querySelector("button.ac-btn.primary").dispatchEvent(new window.Event("click"));
    await new Promise((r) => setTimeout(r, 10));

    assert.ok(container.textContent.includes("No se pudo guardar la franja horaria."));
    const msgEl = container.querySelector(".ac-drawer-msg");
    assert.ok(msgEl, "debe usar el mismo componente .ac-drawer-msg que lista de espera");
    assert.ok(msgEl.className.includes("error"));
  });

  test("un fallo al calcular el impacto también se muestra visible, no en silencio", async () => {
    const container = montar({
      fetchImpactoHorarioFn: async () => { throw new Error("No se pudo calcular el impacto en el horario."); },
    });
    await new Promise((r) => setTimeout(r, 10));

    const finInput = container.querySelectorAll('input[type="time"]')[1];
    finInput.value = "19:30";
    finInput.dispatchEvent(new window.Event("input"));
    container.querySelector("button.ac-btn.primary").dispatchEvent(new window.Event("click"));
    await new Promise((r) => setTimeout(r, 10));

    assert.ok(container.textContent.includes("No se pudo calcular el impacto en el horario."));
  });

  test("cargar la config falla -> error visible, no pantalla en blanco", async () => {
    const container = montar({ fetchConfigFn: async () => { throw new Error("No se pudo cargar la configuración."); } });
    await new Promise((r) => setTimeout(r, 10));

    assert.ok(container.textContent.includes("No se pudo cargar la configuración."));
  });
}
