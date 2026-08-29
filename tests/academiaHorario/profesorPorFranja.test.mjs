import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// Quién imparte cada franja (migración 109).
//
// Antes una franja era (alumno, día, hora) y nada más: "el horario de un
// profesor" se deducía de sus alumnos asignados, lo que hace imposible
// expresar "a Marta la lleva María los martes y Pedro los jueves". Con un
// profesor da igual; con cinco es el caso normal.
//
// La columna es POR FRANJA, pero el selector de la ficha del alumno es UNO
// para todo su horario: lo normal es que todas sus clases las dé la misma
// persona, y un desplegable por casilla serían 30 en una rejilla de 5x6.
export async function run({ test, assert }) {
  const { valorInicial, profesorDeFranja, buildProfesorSelector, VALOR_VARIOS } = await import(
    "../../assets/academia/admin/js/drawer/horario/profesorSelector.js"
  );
  const { horarioSinCambios } = await import("../../server/lib/academiaAlumnoHelpers.js");
  const { buildHorarioSection } = await import(
    "../../assets/academia/admin/js/drawer/horarioSection.js"
  );

  const PROFES = [
    { id: "p-maria", display_name: "María" },
    { id: "p-pedro", display_name: "Pedro" },
  ];
  const CONFIG = { dias_laborables: [1, 2], franja_inicio: "17:00", franja_fin: "19:00", franja_duracion: 60 };

  // ── Qué valor le toca al selector ────────────────────────────────────

  test("sin franjas todavía: sin asignar", () => {
    assert.equal(valorInicial([]), "");
  });

  test("todas las franjas con el mismo profesor: ese", () => {
    assert.equal(valorInicial([{ profesor_id: "p-maria" }, { profesor_id: "p-maria" }]), "p-maria");
  });

  test("franjas con profesores distintos: (varios)", () => {
    assert.equal(valorInicial([{ profesor_id: "p-maria" }, { profesor_id: "p-pedro" }]), VALOR_VARIOS);
  });

  test("una asignada y otra sin asignar también es (varios)", () => {
    assert.equal(valorInicial([{ profesor_id: "p-maria" }, { profesor_id: null }]), VALOR_VARIOS);
  });

  // ── Qué profesor se guarda en cada franja ────────────────────────────

  test("elegir un profesor lo aplica a la franja", () => {
    assert.equal(profesorDeFranja("p-pedro", "p-maria"), "p-pedro");
  });

  test("elegir 'Sin asignar' deja la franja a null", () => {
    assert.equal(profesorDeFranja("", "p-maria"), null);
  });

  test("REGRESIÓN: con (varios), cada franja CONSERVA el suyo", () => {
    // Si al guardar se aplanaran todas al mismo profesor, se destruiría en
    // silencio lo que alguien cuadró franja a franja en la vista del centro.
    assert.equal(profesorDeFranja(VALOR_VARIOS, "p-maria"), "p-maria");
    assert.equal(profesorDeFranja(VALOR_VARIOS, "p-pedro"), "p-pedro");
    assert.equal(profesorDeFranja(VALOR_VARIOS, null), null);
  });

  // ── El selector ──────────────────────────────────────────────────────

  // `select.options` no se usa a propósito: bajo happy-dom ese getter
  // revienta cuando pdf-parse (cargado por otro test de la suite) ya ha
  // parcheado Object.defineProperty global. querySelectorAll da lo mismo.
  const valoresDeOpciones = (sel) => [...sel.querySelectorAll("option")].map((o) => o.value);

  test("(varios) solo aparece como opción cuando de verdad los hay", () => {
    const mezclado = buildProfesorSelector({ profesores: PROFES, horarioActual: [{ profesor_id: "p-maria" }, { profesor_id: "p-pedro" }] });
    assert.ok(valoresDeOpciones(mezclado.select).includes(VALOR_VARIOS));

    const uniforme = buildProfesorSelector({ profesores: PROFES, horarioActual: [{ profesor_id: "p-maria" }] });
    assert.equal(valoresDeOpciones(uniforme.select).includes(VALOR_VARIOS), false, "ofrecerla siempre invita a elegirla sin saber qué es");
    assert.deepEqual(valoresDeOpciones(uniforme.select), ["", "p-maria", "p-pedro"]);
    assert.equal(uniforme.getValue(), "p-maria");
  });

  // ── La rejilla del drawer ────────────────────────────────────────────

  test("sin profesores dados de alta, la rejilla no pinta selector ni cambia nada", () => {
    const seccion = buildHorarioSection({ config: CONFIG, horarioActual: [], profesores: [] });
    assert.equal(seccion.wrap.querySelector("select"), null, "un desplegable con una sola opción vacía es ruido");
    const casilla = seccion.wrap.querySelectorAll('input[type="checkbox"]')[0];
    casilla.checked = true;
    assert.equal(seccion.getValue()[0].profesor_id, null);
  });

  test("el profesor elegido viaja en cada franja marcada", () => {
    const seccion = buildHorarioSection({ config: CONFIG, horarioActual: [], profesores: PROFES });
    seccion.wrap.querySelector("select").value = "p-pedro";
    for (const c of seccion.wrap.querySelectorAll('input[type="checkbox"]')) c.checked = true;
    const valores = seccion.getValue();
    // Marcar la rejilla entera (2 días x 4 medias horas) son DOS clases,
    // una por día de 17:00 a 19:00: las casillas contiguas se funden.
    assert.equal(valores.length, 2, "una clase por día, no una por casilla");
    assert.deepEqual(valores.map((v) => [v.hora_inicio, v.hora_fin]), [["17:00", "19:00"], ["17:00", "19:00"]]);
    assert.ok(valores.every((v) => v.profesor_id === "p-pedro"));
  });

  test("REGRESIÓN: en (varios), guardar respeta el profesor de cada franja", () => {
    const horarioActual = [
      { dia_semana: 1, hora_inicio: "17:00:00", hora_fin: "18:00", profesor_id: "p-maria" },
      { dia_semana: 2, hora_inicio: "18:00:00", hora_fin: "19:00", profesor_id: "p-pedro" },
    ];
    const seccion = buildHorarioSection({ config: CONFIG, horarioActual, profesores: PROFES });
    assert.equal(seccion.wrap.querySelector("select").value, VALOR_VARIOS);

    const porClave = new Map(seccion.getValue().map((v) => [`${v.dia_semana}|${v.hora_inicio}`, v.profesor_id]));
    assert.equal(porClave.get("1|17:00"), "p-maria");
    assert.equal(porClave.get("2|18:00"), "p-pedro");
  });

  // ── El guardado en el servidor ───────────────────────────────────────

  test("REGRESIÓN: cambiar SOLO el profesor cuenta como cambio de horario", () => {
    // horarioKey no incluía profesor_id: sin esto, mover una clase de María
    // a Pedro sin tocar el día ni la hora se leería como "no ha cambiado
    // nada" y el guardado se descartaría en silencio.
    const vigente = [{ dia_semana: 1, hora_inicio: "17:00:00", hora_fin: "18:00:00", profesor_id: "p-maria" }];
    const nuevo = [{ dia_semana: 1, hora_inicio: "17:00", hora_fin: "18:00", profesor_id: "p-pedro" }];
    assert.equal(horarioSinCambios(vigente, nuevo), false);
  });

  test("mismo horario y mismo profesor sigue siendo 'sin cambios'", () => {
    // La otra mitad: no volver a cerrar y recrear filas en cada guardado de
    // la ficha (era el bug de las 32 filas cerradas de Lyceo).
    const vigente = [{ dia_semana: 1, hora_inicio: "17:00:00", hora_fin: "18:00:00", profesor_id: "p-maria" }];
    const nuevo = [{ dia_semana: 1, hora_inicio: "17:00", hora_fin: "18:00", profesor_id: "p-maria" }];
    assert.equal(horarioSinCambios(vigente, nuevo), true);
  });

  test("una franja sin profesor y otra con null se consideran iguales", () => {
    const vigente = [{ dia_semana: 1, hora_inicio: "17:00:00", hora_fin: "18:00:00", profesor_id: null }];
    const nuevo = [{ dia_semana: 1, hora_inicio: "17:00", hora_fin: "18:00" }];
    assert.equal(horarioSinCambios(vigente, nuevo), true, "undefined y null son lo mismo aquí");
  });

  test("el esquema acepta profesor_id, lo omite o lo deja a null", async () => {
    const { HorarioEntrySchema } = await import("../../server/lib/academiaAlumnoSchemas.js");
    const base = { dia_semana: 1, hora_inicio: "17:00", hora_fin: "18:00" };
    assert.equal(HorarioEntrySchema.safeParse(base).success, true, "una academia de un profesor no tiene por qué rellenarlo");
    assert.equal(HorarioEntrySchema.safeParse({ ...base, profesor_id: null }).success, true);
    assert.equal(
      HorarioEntrySchema.safeParse({ ...base, profesor_id: "6f1b1e5e-6a3a-4d0f-9b2a-3c9d8e7f0a11" }).success,
      true
    );
    // Un <select> vacío manda "", no null.
    const vacio = HorarioEntrySchema.safeParse({ ...base, profesor_id: "" });
    assert.equal(vacio.success, true);
    assert.equal(vacio.data.profesor_id, null);
    assert.equal(HorarioEntrySchema.safeParse({ ...base, profesor_id: "no-soy-un-uuid" }).success, false);
  });
  // ── El selector aparece aunque la lista llegue tarde ──────────────────

  test("REGRESIÓN: el selector se mete cuando llega la lista, sin tocar la rejilla", async () => {
    // La lista de profesores llega del servidor DESPUÉS de pintar la ficha.
    // Antes el drawer reconstruía la sección entera y, para no borrar lo ya
    // marcado, se saltaba el repintado si el alumno tenía horario: el primer
    // alumno que se abría tras cargar la página se quedaba SIN selector.
    const seccion = buildHorarioSection({
      config: CONFIG,
      horarioActual: [{ dia_semana: 1, hora_inicio: "17:00", hora_fin: "18:00", profesor_id: null }],
      profesores: [],
    });
    assert.equal(seccion.wrap.querySelector("select"), null, "todavía no hay lista, no hay selector");

    const marcadasAntes = seccion.getValue().length;
    seccion.setProfesores(PROFES);

    assert.ok(seccion.wrap.querySelector("select"), "al llegar la lista aparece el selector");
    assert.equal(seccion.getValue().length, marcadasAntes, "y las casillas marcadas siguen ahí");
  });

  test("setProfesores es idempotente: no apila un segundo selector", () => {
    const seccion = buildHorarioSection({ config: CONFIG, horarioActual: [], profesores: [] });
    seccion.setProfesores(PROFES);
    seccion.setProfesores(PROFES);
    assert.equal(seccion.wrap.querySelectorAll("select").length, 1);
  });

  test("sin profesores en el centro no se pinta ningún selector", () => {
    const seccion = buildHorarioSection({ config: CONFIG, horarioActual: [], profesores: [] });
    seccion.setProfesores([]);
    assert.equal(seccion.wrap.querySelector("select"), null);
  });

  // ── Un solo profesor: predefinido ─────────────────────────────────────

  test("con UN solo profesor en el centro, sale preseleccionado", () => {
    // No hay ambigüedad: solo puede darla él. Obligar a elegirlo en cada
    // alta es papeleo puro.
    assert.equal(valorInicial([], [{ id: "p-unico" }]), "p-unico");
  });

  test("con dos o más profesores se sigue exigiendo elegir", () => {
    assert.equal(valorInicial([], PROFES), "");
  });

  test("un profesor ya guardado manda sobre el predefinido", () => {
    // Aunque hoy solo quede un profesor activo, si la franja dice otro
    // (uno dado de baja, por ejemplo) no se le cambia por la cara.
    assert.equal(valorInicial([{ profesor_id: "p-pedro" }], [{ id: "p-maria" }]), "p-pedro");
  });

  test("el preseleccionado se puede quitar: 'Sin asignar' sigue existiendo", () => {
    const ctl = buildProfesorSelector({ profesores: [{ id: "p-unico", display_name: "Jorge" }], horarioActual: [] });
    const valores = [...ctl.wrap.querySelectorAll("option")].map((o) => o.value);
    assert.ok(valores.includes(""), "sigue habiendo forma de dejarlo sin asignar");
    assert.equal(ctl.getValue(), "p-unico");
  });
}
