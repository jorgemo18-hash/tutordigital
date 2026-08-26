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

  test("la sección pinta su cabecera y le da al diario un contenedor propio", async () => {
    // renderDiario hace innerHTML=\"\" al cambiar de fecha: si se le pasara
    // el contenedor de la sección, se llevaría por delante el título.
    let recibido = null;
    const section = createDarClaseSection({ renderDiarioFn: async (el) => { recibido = el; } });
    const container = document.createElement("div");
    await section.render(container);

    assert.ok(container.querySelector(".ac-title").textContent.includes("Dar clase"));
    assert.ok(recibido, "el diario se ha renderizado");
    assert.notEqual(recibido, container, "en su propio hueco, no en el de la sección");
    recibido.innerHTML = "";
    assert.ok(container.querySelector(".ac-title"), "la cabecera sobrevive a que el diario se repinte");
  });

  test("no se le pide al admin el aviso de sustituciones", async () => {
    // "Hoy cubres a X" es de un profesor que sustituye a otro. Un admin no
    // sustituye a nadie: pedirlo sería una petición garantizada a vacío en
    // cada carga.
    let opts = null;
    const section = createDarClaseSection({ renderDiarioFn: async (_el, o) => { opts = o; } });
    await section.render(document.createElement("div"));
    assert.deepEqual(await opts.fetchMisSustitucionesFn(), []);
  });

  test("REGRESIÓN: pide el diario con ámbito de profesor, no el del centro entero", async () => {
    // Sin esto el servidor le devuelve al admin TODOS los alumnos: correcto
    // gestionando, inservible dando clase en una academia con 5 profesores.
    const { fetchDiarioComoProfesor } = await import("../../assets/academia/admin/js/apiDarClase.js");
    let opts = null;
    const section = createDarClaseSection({ renderDiarioFn: async (_el, o) => { opts = o; } });
    await section.render(document.createElement("div"));
    assert.equal(opts.fetchDiarioFn, fetchDiarioComoProfesor, "no la llamada genérica del panel de profesor");

    const fs = await import("node:fs");
    const src = fs.readFileSync(new URL("../../assets/academia/admin/js/apiDarClase.js", import.meta.url), "utf8");
    assert.ok(src.includes("ambito=profesor"), "el parámetro va en la URL");
  });

  test("el aviso de 'sin alumnos' no le dice al admin que se lo pida al admin", async () => {
    let opts = null;
    const section = createDarClaseSection({ renderDiarioFn: async (_el, o) => { opts = o; } });
    await section.render(document.createElement("div"));
    assert.ok(opts.mensajeSinAlumnos, "trae su propio texto");
    assert.equal(/pide al administrador/i.test(opts.mensajeSinAlumnos), false);
    assert.ok(/profesores/i.test(opts.mensajeSinAlumnos), "y dice dónde asignárselos");
  });

  test("volver a entrar en la sección no apila dos diarios", async () => {
    let veces = 0;
    const section = createDarClaseSection({ renderDiarioFn: async () => { veces++; } });
    const container = document.createElement("div");
    await section.render(container);
    await section.render(container);
    assert.equal(veces, 2);
    assert.equal(container.querySelectorAll(".ac-title").length, 1, "una sola cabecera");
  });
}
