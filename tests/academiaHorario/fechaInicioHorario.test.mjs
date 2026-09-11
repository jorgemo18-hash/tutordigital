import fs from "node:fs";
import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// "Empieza el ___": desde cuándo cuenta el horario de un alumno.
//
// EL PROBLEMA (Jorge, 11/09/2026): *"tengo alumnos activos pero que no
// vienen hasta la semana que viene o hasta octubre, pero los tengo activos
// para que salgan en el horario y hacerme a la idea... tengo que estar todos
// los días marcando ausencia y es un poco rollo"*.
//
// LO QUE YA ESTABA, y es la razón de que esto sea pequeño: la columna
// `academia_horario.fecha_inicio` existe, GET /academia/sesiones (el Diario)
// filtra por ella (`fecha_inicio <= fecha`) y GET /academia/horario (el
// cuadrante) NO. O sea que una franja con fecha futura ya salía en el
// cuadrante y no en el diario. Faltaban dos cosas: poder poner la fecha, y
// que el guardado no la machacara con "hoy".
//
// POR QUÉ NO ES LA FECHA DE ALTA. Lo decidió este argumento de Jorge: *"si
// se dio de alta ya el año pasado, pero este año no empieza la academia
// hasta octubre, no le voy a cambiar la fecha de alta que es del año
// pasado"*. La fecha de alta es un dato histórico y de ella dependen los
// descuentos por intervalo (`primer_trimestre` cuenta 3 meses desde ella).
// Son dos hechos distintos sobre la misma persona, y meterlos en la misma
// columna obliga a mentir en uno para arreglar el otro.
const RAIZ = new URL("../../", import.meta.url).pathname;

export async function run({ test, assert }) {
  const { buildFechaInicioHorario } = await import(
    "../../assets/academia/admin/js/drawer/horario/fechaInicioHorario.js"
  );
  const { buildBadgeDesde } = await import(
    "../../assets/academia/profesor/js/horarioCelda.js"
  );

  const HOY = "2026-09-11";

  // ── El campo del drawer ───────────────────────────────────────────────

  test("por defecto, hoy en un alumno nuevo", () => {
    const ctl = buildFechaInicioHorario({ hoyISO: HOY });
    assert.equal(ctl.getValue(), HOY);
  });

  test("y la fecha que ya tenía su horario cuando se reabre la ficha", () => {
    // Es lo que impide que el propio arreglo se deshaga: si al abrir la
    // ficha el campo volviera a hoy, el siguiente guardado adelantaría al
    // alumno al Diario.
    const ctl = buildFechaInicioHorario({ hoyISO: HOY, fechaInicioActual: "2026-10-06" });
    assert.equal(ctl.getValue(), "2026-10-06");
  });

  test("nunca devuelve vacío", () => {
    // Un horario sin fecha de inicio no se sabe desde cuándo cuenta.
    const ctl = buildFechaInicioHorario({ hoyISO: HOY, fechaInicioActual: "" });
    assert.equal(ctl.getValue(), HOY);
    ctl.wrap.querySelector("input").value = "";
    assert.equal(ctl.getValue(), HOY);
  });

  test("con fecha futura avisa de la CONSECUENCIA, no de la mecánica", () => {
    const ctl = buildFechaInicioHorario({ hoyISO: HOY, fechaInicioActual: "2026-10-06" });
    const nota = ctl.wrap.querySelector(".ac-field-hint");
    assert.equal(nota.hidden, false);
    assert.match(nota.textContent, /cuadrante/i, "tiene que decir dónde SÍ se ve");
    assert.match(nota.textContent, /Diario/i, "y dónde no, hasta cuándo");
    assert.match(nota.textContent, /06\/10\/2026/, "y la fecha en formato de aquí");
  });

  test("con la fecha de hoy no avisa de nada: es el caso normal", () => {
    const ctl = buildFechaInicioHorario({ hoyISO: HOY });
    assert.equal(ctl.wrap.querySelector(".ac-field-hint").hidden, true);
  });

  test("una fecha pasada tampoco avisa", () => {
    // Un alumno que lleva viniendo desde marzo no tiene nada de particular.
    const ctl = buildFechaInicioHorario({ hoyISO: HOY, fechaInicioActual: "2026-03-02" });
    assert.equal(ctl.wrap.querySelector(".ac-field-hint").hidden, true);
  });

  // ── La marca del cuadrante ────────────────────────────────────────────

  test("el cuadrante marca 'desde D/M' al que aún no ha empezado", () => {
    // Decisión de Jorge: "sí, que se vea". Sin la marca, el cuadrante
    // enseña el hueco ocupado y no dice que esa plaza sigue libre esta
    // semana — que es el lío de prometer una plaza ya prometida.
    const badge = buildBadgeDesde("2026-10-06", HOY);
    assert.ok(badge);
    assert.equal(badge.textContent, "desde 6/10");
    assert.match(badge.title, /todavía no aparece en el Diario/i);
  });

  test("y NO marca a los que ya vienen, que son casi todos", () => {
    // Una marca en cada alumno no marcaría nada.
    for (const fecha of [HOY, "2026-03-02", "", null, undefined]) {
      assert.equal(buildBadgeDesde(fecha, HOY), null, `no debería marcar ${JSON.stringify(fecha)}`);
    }
  });

  test("REGRESIÓN: la fecha se compara como TEXTO, no con Date", () => {
    // Con Date, el 1 de octubre a medianoche se convierte en el 30 de
    // septiembre por la zona horaria, y el alumno aparecería un día antes
    // en el Diario. Mismo criterio que en aniosArchivo.js.
    assert.equal(buildBadgeDesde("2027-01-01", "2026-12-31").textContent, "desde 1/1");
    assert.equal(buildBadgeDesde("2026-12-31", "2026-12-31"), null, "el mismo día ya cuenta");
  });

  // ── El cableado, que es donde esto se rompe ───────────────────────────

  test("REGRESIÓN: cambiar SOLO la fecha cuenta como cambio y se guarda", async () => {
    // EL FALLO, y es mío, de una hora después de escribir esta función
    // (Jorge: "cambio cuando empieza, le doy a guardar, se guarda, cambio de
    // pestaña, vuelvo, abro ese alumno y no me ha guardado la fecha").
    //
    // `horarioSinCambios` comparaba solo día + horas + profesor. Al cambiar
    // únicamente la fecha decía "esto no ha cambiado", el guardado se daba
    // la vuelta y la fecha no se escribía. Sin error, sin log: el alumno
    // seguía apareciendo en el diario y nada lo explicaba.
    //
    // Es la guarda que existe para evitar el churn de filas del horario
    // (32 de 47 cerradas en producción por guardados que no tocaban nada) y
    // que, al protegerlo, bloqueaba en silencio un cambio legítimo.
    const { horarioSinCambios } = await import("../../server/lib/academiaAlumnoHelpers.js");
    const vigente = [{ dia_semana: 2, hora_inicio: "17:30", hora_fin: "18:30", profesor_id: null, fecha_inicio: "2026-03-02" }];
    const mismasFranjas = [{ dia_semana: 2, hora_inicio: "17:30", hora_fin: "18:30", profesor_id: null }];

    assert.equal(
      horarioSinCambios(vigente, mismasFranjas, "2026-10-06"), false,
      "solo cambia la fecha, pero HAY cambio: la fecha es parte del horario"
    );
    assert.equal(
      horarioSinCambios(vigente, mismasFranjas, "2026-03-02"), true,
      "la misma fecha sigue siendo 'sin cambios': si no, cada guardado recrearía las filas"
    );
  });

  test("un llamador que no manda fecha compara solo las franjas, como siempre", async () => {
    // Sin esto volvería el churn: el drawer manda el horario en CADA
    // guardado del alumno, y comparar contra "hoy" por defecto haría que
    // abrir una ficha para corregir un teléfono cerrara y recreara sus
    // franjas.
    const { horarioSinCambios } = await import("../../server/lib/academiaAlumnoHelpers.js");
    const vigente = [{ dia_semana: 2, hora_inicio: "17:30", hora_fin: "18:30", profesor_id: null, fecha_inicio: "2026-03-02" }];
    const mismasFranjas = [{ dia_semana: 2, hora_inicio: "17:30", hora_fin: "18:30", profesor_id: null }];
    assert.equal(horarioSinCambios(vigente, mismasFranjas), true);
    assert.equal(horarioSinCambios(vigente, mismasFranjas, null), true);
  });

  test("sin franjas vigentes no hay fecha con la que comparar", async () => {
    const { horarioSinCambios } = await import("../../server/lib/academiaAlumnoHelpers.js");
    assert.equal(horarioSinCambios([], [], "2026-10-06"), true, "nada contra nada: sin cambios");
  });

  test("REGRESIÓN: fetchHorarioVigente trae fecha_inicio", async () => {
    // Cuarto SELECT incompleto del mismo día. Sin esta columna no hay con
    // qué comparar y el arreglo de arriba no puede funcionar.
    const helpers = fs.readFileSync(`${RAIZ}server/lib/academiaAlumnoHelpers.js`, "utf8");
    const consulta = helpers.slice(
      helpers.indexOf("export async function fetchHorarioVigente"),
      helpers.indexOf("export async function actualizarHorarioSiCambia")
    );
    assert.match(consulta, /\.select\("[^"]*fecha_inicio[^"]*"\)/);
  });

  test("REGRESIÓN: cerrar el horario viejo y empezar el nuevo son DOS fechas", () => {
    // El viejo se cierra HOY; el nuevo empieza en la fecha pedida. Si
    // compartieran parámetro, poner una fecha futura cerraría el horario
    // actual en el futuro y el alumno seguiría saliendo en el diario.
    const helpers = fs.readFileSync(`${RAIZ}server/lib/academiaAlumnoHelpers.js`, "utf8");
    assert.match(helpers, /actualizarHorarioSiCambia\([^)]*hoy,\s*fechaInicio = null\)/);
    assert.match(helpers, /cerrarHorarioVigente\(admin, tenantId, alumnoId, hoy\)/);
    assert.match(helpers, /insertarHorario\(\s*admin, tenantId, alumnoId, horarioNuevo, fechaInicio \|\| hoy\s*\)/);
  });

  test("las CUATRO puertas de guardado mandan la fecha", () => {
    // Alta completa, borrador, "guardar cambios" y dar de alta a un
    // borrador. Si una se queda fuera, ese camino sigue poniendo hoy y el
    // fallo aparece solo por ahí.
    //
    // ERAN TRES hasta el 11/09/2026: "dar de alta" llamaba a
    // updateHorarioAlumno sin la fecha, y es el caso para el que existe el
    // campo (el borrador de "empieza en octubre"). Este test lo contaba y
    // daba 3 porque su número era el de entonces.
    //
    // Y CONTAR NO BASTABA: los tres sitios llamaban con `?.` a un método
    // que la sección no exponía, así que la cuenta salía bien y la fecha no
    // salía del navegador. Lo que faltaba se comprueba en
    // fechaInicioLlegaAlBackend.test.mjs — aquí solo que no se olvide
    // ninguna puerta.
    const acciones = fs.readFileSync(
      `${RAIZ}assets/academia/admin/js/drawer/alumnoDrawerActions.js`, "utf8"
    );
    const veces = acciones.split("\n").filter((l) => l.includes("getFechaInicio")).length;
    assert.equal(veces, 4, "alta, borrador, guardar cambios y dar de alta");
  });

  test("el backend acepta la fecha en los dos endpoints que guardan horario", () => {
    const esquemas = fs.readFileSync(`${RAIZ}server/lib/academiaAlumnoSchemas.js`, "utf8");
    // FechaDeAcademia = FECHA_RE + año posible (ver fechaRazonable.js): en
    // producción entró un 1013-11-05 que la forma daba por bueno.
    assert.match(esquemas, /horario_fecha_inicio: FechaDeAcademia\.optional\(\)/, "POST /alumnos");
    assert.match(esquemas, /fecha_inicio: FechaDeAcademia\.optional\(\)/, "PUT /alumnos/:id/horario");
  });

  test("REGRESIÓN: el Diario sigue filtrando por fecha_inicio", () => {
    // Es la mitad del mecanismo y no la ha escrito este cambio: si alguien
    // quita ese filtro, "Empieza el" deja de servir para nada y el campo se
    // queda ahí prometiendo algo que ya no hace.
    const sesiones = fs.readFileSync(`${RAIZ}server/routes/v1/academia.sesiones.routes.js`, "utf8");
    assert.match(sesiones, /\.lte\("fecha_inicio", fecha\)/);
  });

  test("REGRESIÓN: el cuadrante NO filtra por fecha_inicio", () => {
    // La otra mitad, y es igual de deliberada: el cuadrante tiene que
    // enseñar al alumno que viene en octubre, para eso se mira.
    const horario = fs.readFileSync(`${RAIZ}server/routes/v1/academia.horario.routes.js`, "utf8");
    const consulta = horario.slice(0, horario.indexOf("const franjas ="));
    assert.equal(
      /\.lte\("fecha_inicio"/.test(consulta), false,
      "si el cuadrante empieza a filtrar por fecha, el alumno de octubre desaparece de la rejilla"
    );
  });
}
