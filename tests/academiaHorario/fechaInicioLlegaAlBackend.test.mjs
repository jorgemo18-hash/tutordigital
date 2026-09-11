import fs from "node:fs";
import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

const RAIZ = new URL("../../", import.meta.url).pathname;

// La fecha de "Empieza el" LLEGA al backend.
//
// EL FALLO (Jorge, 11/09/2026): *"lo de la fecha de inicio no está haciendo
// efecto en diario"*. El campo se pintaba, se leía, avisaba con su nota…
// y nunca salía del navegador.
//
// LA CADENA ESTABA COMPLETA MENOS UN ESLABÓN: `horarioSection.js` creaba el
// control y lo metía en el DOM, pero su objeto de retorno NO exponía
// `getFechaInicio`. El drawer lo pedía como
// `getSections().horario.getFechaInicio?.()` —con interrogación— así que en
// vez de reventar devolvía `undefined`, `JSON.stringify` se comía la clave, y
// el backend aplicaba su valor por defecto: HOY.
//
// LO QUE SE VE EN PRODUCCIÓN (comprobado el 11/09): 5 alumnos de Lyceo con
// `fecha_inicio` = el día en que Jorge los guardó, y CERO filas con fecha
// futura en toda la tabla. No es que el filtro del Diario fallara —filtra
// bien desde el principio—: es que no había ninguna fecha futura que filtrar.
//
// POR QUÉ EL `?.` ES EL CULPABLE Y NO UN DETALLE. Sin él, el primer guardado
// habría dado "getFechaInicio is not a function" en la consola y el fallo se
// habría visto entero en un segundo. Con él, la app guarda, dice que ha
// guardado, y escribe un dato distinto del que hay en pantalla. Un `?.` sobre
// un método propio no protege de nada: convierte un error en datos malos.
export async function run({ test, assert }) {
  const { buildFechaInicioHorario } = await import(
    "../../assets/academia/admin/js/drawer/horario/fechaInicioHorario.js"
  );

  // ── El eslabón que faltaba ────────────────────────────────────────────

  test("REGRESIÓN: la sección de horario EXPONE getFechaInicio", () => {
    // Se lee del archivo y no montando la sección entera (necesita config,
    // profesores y ocupación) porque lo que se comprueba es justo que la
    // clave está en el objeto de retorno.
    const seccion = fs.readFileSync(`${RAIZ}assets/academia/admin/js/drawer/horarioSection.js`, "utf8");
    assert.match(
      seccion, /getFechaInicio: \(\) => fechaInicioCtl\.getValue\(\)/,
      "sin esto el drawer manda undefined y el backend pone hoy"
    );
  });

  test("REGRESIÓN: el drawer la pide SIN `?.`", () => {
    // La interrogación es lo que convirtió un error a gritos en un dato
    // silenciosamente equivocado.
    const acciones = fs.readFileSync(`${RAIZ}assets/academia/admin/js/drawer/alumnoDrawerActions.js`, "utf8");
    assert.equal(
      /getFechaInicio\?\./.test(acciones), false,
      "un `?.` sobre un método propio esconde el cable suelto"
    );
    assert.equal(
      (acciones.match(/getFechaInicio\(\)/g) || []).length, 4,
      "los CUATRO guardados que tocan el horario: alta, borrador, guardar cambios y dar de alta"
    );
  });

  test("REGRESIÓN: dar de alta a un borrador también manda la fecha", () => {
    // Era el cuarto sitio, y el peor: el borrador de "empieza en octubre" es
    // justo el caso para el que existe el campo, y al activarlo se le ponía
    // el horario empezando hoy.
    const acciones = fs.readFileSync(`${RAIZ}assets/academia/admin/js/drawer/alumnoDrawerActions.js`, "utf8");
    const darDeAlta = acciones.slice(acciones.indexOf("async function darDeAlta"));
    assert.match(darDeAlta.slice(0, 900), /updateHorarioAlumno\([\s\S]*?getFechaInicio\(\)/);
  });

  test("el cliente manda la clave que el esquema espera: fecha_inicio", async () => {
    // El otro extremo del mismo tipo de fallo: el nombre de la clave. El
    // alta manda `horario_fecha_inicio` (va dentro del alumno) y el horario
    // manda `fecha_inicio` (va solo). Dos nombres, y ninguno de los dos
    // falla si se equivoca — zod descarta las claves que no conoce.
    const api = fs.readFileSync(`${RAIZ}assets/academia/admin/js/api.js`, "utf8");
    const fn = api.slice(api.indexOf("export async function updateHorarioAlumno"));
    assert.match(fn.slice(0, 400), /fecha_inicio: fechaInicio \|\| undefined/);

    const { HorarioUpdateSchema, buildAlumnoCreateSchema } = await import(
      "../../server/lib/academiaAlumnoSchemas.js"
    );
    assert.equal(
      HorarioUpdateSchema.safeParse({ horario: [], fecha_inicio: "2026-10-06" }).data.fecha_inicio,
      "2026-10-06"
    );
    const alta = buildAlumnoCreateSchema({ exigeEmailAlumno: false }).safeParse({
      nombre: "Nuevo", curso: "1º ESO", fecha_alta: "2026-09-11", horario_fecha_inicio: "2026-10-06",
    });
    assert.equal(alta.data.horario_fecha_inicio, "2026-10-06");
  });

  // ── El campo, que ya funcionaba y sigue funcionando ───────────────────

  test("devuelve lo que hay escrito, no lo que había al abrir", () => {
    const ctl = buildFechaInicioHorario({ hoyISO: "2026-09-11" });
    assert.equal(ctl.getValue(), "2026-09-11", "por defecto, hoy");
    ctl.wrap.querySelector("input").value = "2026-10-06";
    assert.equal(ctl.getValue(), "2026-10-06");
  });

  test("con una fecha futura dice dónde se va a ver al alumno y dónde no", () => {
    const ctl = buildFechaInicioHorario({ hoyISO: "2026-09-11", fechaInicioActual: "2026-10-06" });
    const nota = ctl.wrap.querySelector(".ac-field-hint");
    assert.match(nota.textContent, /cuadrante desde ya/);
    assert.match(nota.textContent, /Diario a partir del 06\/10\/2026/);
  });

  // ── El año imposible ──────────────────────────────────────────────────

  test("REGRESIÓN: un año imposible no se puede guardar", () => {
    // EL CASO REAL: un alumno de Lyceo tenía fecha_alta = 1013-11-05, y de
    // ahí se copió al inicio de su horario (5 filas) y de su tarifa (1).
    const ctl = buildFechaInicioHorario({ hoyISO: "2026-09-11" });
    ctl.wrap.querySelector("input").value = "1013-11-05";
    assert.equal(ctl.esValida(), false);
    assert.match(ctl.motivoInvalido(), /1013/, "dice el año, que es el dato que se ve mal");
  });

  test("el aviso del año tapa el de la consecuencia, no se suman", () => {
    // "Saldrá en el Diario a partir del 5 de noviembre de 3026" sería contar
    // lo que va a pasar con una fecha que no se va a poder guardar.
    const ctl = buildFechaInicioHorario({ hoyISO: "2026-09-11" });
    const input = ctl.wrap.querySelector("input");
    input.value = "3026-11-05";
    input.dispatchEvent(new window.Event("input"));
    const nota = ctl.wrap.querySelector(".ac-field-hint");
    assert.match(nota.textContent, /3026 no puede ser/);
    assert.equal(/Diario a partir/.test(nota.textContent), false);
    assert.ok(nota.classList.contains("ac-field-hint--error"));
  });

  test("el input lleva min y max, para que el navegador lo marque al teclear", () => {
    const input = buildFechaInicioHorario({ hoyISO: "2026-09-11" }).wrap.querySelector("input");
    assert.equal(input.min, "2006-09-11");
    assert.equal(input.max, "2031-09-11");
  });

  test("REGRESIÓN: el drawer se niega a guardar con la fecha imposible", () => {
    const acciones = fs.readFileSync(`${RAIZ}assets/academia/admin/js/drawer/alumnoDrawerActions.js`, "utf8");
    assert.match(acciones, /fechaInicioValida\(\)\) \{/);
    assert.match(
      acciones, /motivoFechaInicio\(\)/,
      "con el motivo, no un 'revisa los datos'"
    );
  });

  test("REGRESIÓN: y el backend también, que un PATCH no pasa por la pantalla", async () => {
    const { HorarioUpdateSchema, AlumnoUpdateSchema } = await import(
      "../../server/lib/academiaAlumnoSchemas.js"
    );
    assert.equal(HorarioUpdateSchema.safeParse({ horario: [], fecha_inicio: "1013-11-05" }).success, false);
    assert.equal(HorarioUpdateSchema.safeParse({ horario: [], fecha_inicio: "3026-11-05" }).success, false);
    assert.equal(HorarioUpdateSchema.safeParse({ horario: [], fecha_inicio: "2026-10-06" }).success, true);
    assert.equal(
      AlumnoUpdateSchema.safeParse({ fecha_alta: "1013-11-05" }).success, false,
      "la fecha de alta es POR DONDE ENTRÓ el 1013 en producción"
    );
  });

  test("la ventana es relativa a hoy, no dos años escritos a mano", async () => {
    const { rangoFechaRazonable, fechaRazonable } = await import(
      "../../assets/shared/js/fechaRazonable.js"
    );
    assert.deepEqual(rangoFechaRazonable("2026-09-11"), { min: "2006-09-11", max: "2031-09-11" });
    assert.equal(fechaRazonable("2019-06-01", "2026-09-11"), true, "el histórico de un alumno viejo vale");
    assert.equal(fechaRazonable("", "2026-09-11"), true, "vacío no es irrazonable: es 'no hay dato'");
    assert.equal(fechaRazonable("06/10/2026", "2026-09-11"), false, "y el formato español no es YMD");
  });
}
