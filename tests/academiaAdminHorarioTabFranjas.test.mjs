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
    "../assets/academia/admin/js/sections/ajustes/horario/franjasPanel.js"
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
    // La vista previa enseña las FILAS que va a tener el horario, que es lo
    // que el admin ve luego en el cuadrante: 15:30-20:30 con clases de 60
    // min son 5. (Antes listaba las marcas de media hora, diez cajas
    // apiladas que parecían editables y no lo eran.)
    const container = montar();
    await new Promise((r) => setTimeout(r, 10));

    assert.equal(container.textContent.includes("Cargando…"), false);
    assert.ok(container.textContent.includes("5 filas en el horario"));
    assert.ok(container.textContent.includes("15:30 – 16:30"), "la primera fila, con sus dos horas");
    assert.ok(container.textContent.includes("19:30 – 20:30"), "y la última");
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
    assert.ok(container.textContent.includes("15:30 – 17:00"), "una clase de 90 min es una fila de hora y media");
  });

  test("cambiar el cierre sí cambia la rejilla", async () => {
    const container = montar();
    await new Promise((r) => setTimeout(r, 10));

    const finInput = container.querySelectorAll('input[type="time"]')[1];
    finInput.value = "19:30";
    finInput.dispatchEvent(new window.Event("input"));

    assert.ok(container.textContent.includes("4 filas en el horario"), "15:30-19:30 son 4 clases de una hora");
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
  // ── Jornada partida (migración 111) ───────────────────────────────────

  test("por defecto, jornada continua: el segundo tramo ni se ve", async () => {
    const container = montar();
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(container.querySelector("select").value, "continua");
    assert.ok(container.querySelector(".ac-field-row.three.hidden"), "el segundo tramo está oculto");
  });

  test("un centro con dos tramos abre en modo partida", async () => {
    const container = montar({
      fetchConfigFn: async () => ({
        franja_inicio: "09:00", franja_fin: "14:00",
        franja_inicio_2: "16:00", franja_fin_2: "21:00", franja_duracion: 60,
      }),
    });
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(container.querySelector("select").value, "partida");
    // 09:00-14:00 son 5 clases de una hora, y 16:00-21:00 otras 5.
    assert.ok(container.textContent.includes("10 filas en el horario"), "5 por la mañana y 5 por la tarde");
  });

  test("cambiar a partida enseña el segundo tramo y suma sus horas", async () => {
    const container = montar();
    await new Promise((r) => setTimeout(r, 10));
    const select = container.querySelector("select");
    select.value = "partida";
    select.dispatchEvent(new window.Event("change"));

    assert.equal(container.querySelector(".ac-field-row.three.hidden"), null, "ya se ve");
    // 15:30-20:30 + el segundo por defecto 16:00-21:00, que se solapa: lo
    // que importa aquí es que las filas no se dupliquen.
    const filas = [...container.querySelectorAll(".ac-franja-horas .ac-franja-chip")].map((c) => c.textContent);
    assert.ok(filas.length, "se pintan filas");
    assert.equal(new Set(filas).size, filas.length, "ninguna fila repetida");
  });

  test("REGRESIÓN: volver a continua NO manda el segundo tramo", async () => {
    // Si se colara, el centro se quedaría con un horario partido que el
    // admin acaba de quitar de la pantalla.
    let guardado = null;
    const container = montar({
      fetchConfigFn: async () => ({
        franja_inicio: "09:00", franja_fin: "14:00",
        franja_inicio_2: "16:00", franja_fin_2: "21:00", franja_duracion: 60,
      }),
      updateConfigFn: async (payload) => { guardado = payload; },
      fetchImpactoHorarioFn: async () => 0,
    });
    await new Promise((r) => setTimeout(r, 10));

    const select = container.querySelector("select");
    select.value = "continua";
    select.dispatchEvent(new window.Event("change"));
    container.querySelector("button.ac-btn.primary").dispatchEvent(new window.Event("click"));
    await new Promise((r) => setTimeout(r, 10));

    assert.equal(guardado.franja_inicio_2, null, "se vacía explícitamente, no se deja como estaba");
    assert.equal(guardado.franja_fin_2, null);
  });

  test("guardar en partida manda los dos tramos", async () => {
    let guardado = null;
    const container = montar({
      updateConfigFn: async (payload) => { guardado = payload; },
      fetchImpactoHorarioFn: async () => 0,
    });
    await new Promise((r) => setTimeout(r, 10));

    const select = container.querySelector("select");
    select.value = "partida";
    select.dispatchEvent(new window.Event("change"));
    const horas = container.querySelectorAll('input[type="time"]');
    horas[0].value = "09:00";
    horas[1].value = "14:00";
    horas[2].value = "16:00";
    horas[3].value = "21:00";
    horas[3].dispatchEvent(new window.Event("input"));
    container.querySelector("button.ac-btn.primary").dispatchEvent(new window.Event("click"));
    await new Promise((r) => setTimeout(r, 10));

    assert.deepEqual(guardado, {
      franja_inicio: "09:00", franja_fin: "14:00",
      franja_inicio_2: "16:00", franja_fin_2: "21:00", franja_duracion: 60,
    });
  });
}
