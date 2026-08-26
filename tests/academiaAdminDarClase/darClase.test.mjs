import { Window } from "happy-dom";

// No se pisa un window ya instalado por otro archivo de test: varios
// módulos de la suite comparten estos globals y todos se importan antes de
// que corra ningún test (ver rejillaCentro.test.mjs).
const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// "Dar clase": el diario dentro del panel de admin.
//
// En una academia pequeña el dueño es admin y profesor a la vez, y el
// diario solo existía en el panel de profesor — había que tener dos
// cuentas y cerrar sesión para pasar de una tarea a otra.
//
// No hizo falta tocar el servidor: las rutas de sesiones y notas de examen
// ya aceptaban rol admin, y GET /academia/sesiones le devuelve al admin
// todos los alumnos del centro. Y NO se pudo dar de alta al admin también
// como profesor: tenant_memberships tiene UNIQUE (tenant_id, user_id).
export async function run({ test, assert }) {
  const { seccionesAdmin, SECTIONS, SECTION_DAR_CLASE, SECTION_FICHAJES } = await import(
    "../../assets/academia/admin/js/sidebar.js"
  );
  const { createDarClaseSection } = await import(
    "../../assets/academia/admin/js/sections/darClaseSection.js"
  );
  const { buildIcon } = await import("../../assets/academia/admin/js/icons.js");

  const ids = (config) => seccionesAdmin(config).map((s) => s.id);

  test("apagado por defecto: un centro sin configurar no ve la sección", () => {
    assert.equal(ids({}).includes("dar_clase"), false);
    assert.equal(ids({ admin_imparte_clases: false }).includes("dar_clase"), false);
    assert.deepEqual(ids({}), SECTIONS.map((s) => s.id), "sin config, el menú es el de siempre");
  });

  test("encendido: aparece justo después de Horario, no al final", () => {
    // Rellenar el diario es la tarea más frecuente del curso. Enterrada
    // debajo de Ajustes se deja de hacer.
    const lista = ids({ admin_imparte_clases: true });
    assert.equal(lista[lista.indexOf("horario") + 1], "dar_clase");
    assert.notEqual(lista[lista.length - 1], "dar_clase");
  });

  test("REGRESIÓN: no rompe la adyacencia Alumnos → Profesores", () => {
    // Decisión anterior fijada por academiaAdminSidebarOrden.test.mjs.
    for (const config of [{}, { admin_imparte_clases: true }, { admin_imparte_clases: true, control_horario_activo: true }]) {
      const lista = ids(config);
      assert.equal(lista[lista.indexOf("alumnos") + 1], "profesores", JSON.stringify(config));
    }
  });

  test("Control horario sigue yendo al final, y conviven los dos", () => {
    const lista = ids({ admin_imparte_clases: true, control_horario_activo: true });
    assert.equal(lista[lista.length - 1], SECTION_FICHAJES.id);
    assert.ok(lista.includes("dar_clase"));
  });

  test("seccionesAdmin no muta el array base", () => {
    const antes = SECTIONS.length;
    seccionesAdmin({ admin_imparte_clases: true, control_horario_activo: true });
    seccionesAdmin({ admin_imparte_clases: true, control_horario_activo: true });
    assert.equal(SECTIONS.length, antes, "dos llamadas no pueden ir acumulando secciones");
  });

  test("el icono existe de verdad y no repite el de Profesores ni el de Alumnos", () => {
    const svg = buildIcon(SECTION_DAR_CLASE.icon, { size: 14 });
    assert.ok(svg.querySelectorAll("path").length > 0, "debe dibujar algún path, no un SVG vacío");
    const otros = SECTIONS.filter((s) => ["alumnos", "profesores"].includes(s.id)).map((s) => s.icon);
    assert.equal(otros.includes(SECTION_DAR_CLASE.icon), false, "en el sidebar colapsado solo se ve el icono");
  });

  // ── La sección ────────────────────────────────────────────────────────

  // Espías: el diario y el horario reales piden al servidor. Aquí solo
  // interesa CÓMO se les llama.
  function montar() {
    const llamadas = { diario: [], horario: [] };
    const section = createDarClaseSection({
      renderDiarioFn: async (el, opts) => { llamadas.diario.push({ el, opts }); },
      renderHorarioFn: async (el, opts) => { llamadas.horario.push({ el, opts }); },
    });
    return { section, llamadas };
  }

  test("abre en Horario, con las dos pestañas del panel de profesor", async () => {
    const { section, llamadas } = montar();
    const container = document.createElement("div");
    await section.render(container);

    assert.ok(container.querySelector(".ac-title").textContent.includes("Dar clase"));
    const etiquetas = [...container.querySelectorAll(".ac-list-tab")].map((b) => b.textContent);
    assert.deepEqual(etiquetas, ["Horario", "Diario"], "mismo orden que el panel de profesor");
    assert.equal(llamadas.horario.length, 1, "abre en Horario");
    assert.equal(llamadas.diario.length, 0);
  });

  test("cambiar de pestaña pinta la otra vista y no deja la anterior debajo", async () => {
    const { section, llamadas } = montar();
    const container = document.createElement("div");
    await section.render(container);

    const diarioBtn = [...container.querySelectorAll(".ac-list-tab")].find((b) => b.textContent === "Diario");
    diarioBtn.click();
    assert.equal(llamadas.diario.length, 1);
    assert.equal(diarioBtn.classList.contains("active"), true);
    assert.equal(llamadas.diario[0].el, llamadas.horario[0].el, "mismo hueco reutilizado, se vacía entre medias");
  });

  test("la cabecera y las pestañas sobreviven a que la vista se repinte sola", async () => {
    // renderDiario/renderHorario hacen innerHTML="" al recargar (cambio de
    // fecha): si se les pasara el contenedor de la sección, se llevarían
    // por delante el título y las propias pestañas.
    const { section, llamadas } = montar();
    const container = document.createElement("div");
    await section.render(container);

    const slot = llamadas.horario[0].el;
    assert.notEqual(slot, container, "en su propio hueco");
    slot.innerHTML = "";
    assert.ok(container.querySelector(".ac-title"));
    assert.equal(container.querySelectorAll(".ac-list-tab").length, 2);
  });

  test("recuerda la pestaña al volver a la sección", async () => {
    // Volver de Finanzas a "Dar clase" no debe devolverte a Horario si
    // estabas rellenando el diario.
    const { section, llamadas } = montar();
    const container = document.createElement("div");
    await section.render(container);
    [...container.querySelectorAll(".ac-list-tab")].find((b) => b.textContent === "Diario").click();

    await section.render(container);
    assert.equal(llamadas.horario.length, 1, "no vuelve a Horario");
    assert.equal(llamadas.diario.length, 2);
    assert.equal(container.querySelectorAll(".ac-title").length, 1, "una sola cabecera");
  });

  test("no se le pide al admin el aviso de sustituciones, en ninguna de las dos", async () => {
    // "Hoy cubres a X" es de un profesor que sustituye a otro. Un admin no
    // sustituye a nadie: pedirlo sería una petición garantizada a vacío en
    // cada carga.
    const { section, llamadas } = montar();
    const container = document.createElement("div");
    await section.render(container);
    [...container.querySelectorAll(".ac-list-tab")].find((b) => b.textContent === "Diario").click();

    assert.deepEqual(await llamadas.horario[0].opts.fetchMisSustitucionesFn(), []);
    assert.deepEqual(await llamadas.diario[0].opts.fetchMisSustitucionesFn(), []);
  });

  test("REGRESIÓN: las dos vistas piden con ámbito de profesor, no el centro entero", async () => {
    // Sin esto el servidor le devuelve al admin TODOS los alumnos: correcto
    // gestionando, inservible dando clase en una academia con 5 profesores.
    const { fetchDiarioComoProfesor, fetchHorarioComoProfesor } = await import(
      "../../assets/academia/admin/js/apiDarClase.js"
    );
    const { section, llamadas } = montar();
    const container = document.createElement("div");
    await section.render(container);
    [...container.querySelectorAll(".ac-list-tab")].find((b) => b.textContent === "Diario").click();

    assert.equal(llamadas.horario[0].opts.fetchHorarioFn, fetchHorarioComoProfesor);
    assert.equal(llamadas.diario[0].opts.fetchDiarioFn, fetchDiarioComoProfesor);

    // Se comprueba sobre las URLs concretas, no contando la palabra suelta:
    // aparece también en un comentario y un recuento se rompería solo.
    const fs = await import("node:fs");
    const src = fs.readFileSync(new URL("../../assets/academia/admin/js/apiDarClase.js", import.meta.url), "utf8");
    assert.ok(/academia\/sesiones\?[^`"']*ambito=profesor/.test(src), "el diario lo lleva en la URL");
    assert.ok(/academia\/horario\?[^`"']*ambito=profesor/.test(src), "el horario lo lleva en la URL");
  });

  test("el aviso de 'sin alumnos' no le dice al admin que se lo pida al admin", async () => {
    const { section, llamadas } = montar();
    const container = document.createElement("div");
    await section.render(container);
    [...container.querySelectorAll(".ac-list-tab")].find((b) => b.textContent === "Diario").click();

    for (const { opts } of [llamadas.horario[0], llamadas.diario[0]]) {
      assert.ok(opts.mensajeSinAlumnos, "trae su propio texto");
      assert.equal(/pide al administrador/i.test(opts.mensajeSinAlumnos), false);
      assert.ok(/profesores/i.test(opts.mensajeSinAlumnos), "y dice dónde asignárselos");
    }
  });
}
