// Qué columnas trae la ficha completa del alumno (GET /:id, POST y PUT).
//
// Dos regresiones reales viven aquí:
//
// 1) profesor_id del horario. La rejilla del drawer se pinta con este
//    horario y, al guardar, actualizarHorarioSiCambia compara lo que
//    devuelve la rejilla contra la base de datos INCLUYENDO el profesor
//    (entra en horarioKey). Sin traerlo, el drawer veía siempre "sin
//    profesor" y cada edición de la ficha borraba en silencio quién imparte
//    cada franja — un dato que el admin acababa de poner.
//
// 2) ficha_url. Sin ella, la ficha de inscripción guardada no se puede
//    enseñar al abrir el alumno, que es justamente para lo que se guarda.
//
// 3) fecha_inicio del horario (11/09/2026). Es lo que el drawer enseña en
//    "Empieza el" y decide desde cuándo el alumno aparece en el Diario. Sin
//    ella el campo se rellenaría con hoy al abrir la ficha, y el primer
//    guardado adelantaría al Diario a un alumno que empieza en octubre —
//    es decir, el propio arreglo se desharía al usarlo. Tres regresiones
//    con la MISMA forma: una columna que falta en el SELECT llega como
//    undefined, y undefined se lee como un valor legítimo.
export async function run({ test, assert }) {
  const { fetchAlumnoCompleto } = await import("../../server/lib/academiaAlumnoHelpers.js");

  function adminFalso() {
    const selects = {};
    const filaPorTabla = {
      academia_alumnos: { id: "a1", nombre: "Alejandra" },
      academia_horario: [],
      academia_tarifas: null,
    };
    return {
      selects,
      from(tabla) {
        const builder = {
          select(cols) { selects[tabla] = cols; return builder; },
          eq: () => builder,
          is: () => builder,
          order: () => builder,
          maybeSingle: async () => ({ data: filaPorTabla[tabla], error: null }),
          // El horario resuelve al encadenar (no lleva maybeSingle).
          then(resolve) { return Promise.resolve({ data: filaPorTabla[tabla], error: null }).then(resolve); },
        };
        return builder;
      },
    };
  }

  test("REGRESIÓN: el horario trae profesor_id — si no, editar la ficha lo borraba", async () => {
    const admin = adminFalso();
    await fetchAlumnoCompleto(admin, "t1", "a1");
    assert.ok(
      admin.selects.academia_horario.includes("profesor_id"),
      "sin esta columna, guardar el alumno deja todas sus franjas sin profesor"
    );
  });

  test("REGRESIÓN: el horario trae fecha_inicio — si no, el arreglo se deshace al guardar", async () => {
    const admin = adminFalso();
    await fetchAlumnoCompleto(admin, "t1", "a1");
    assert.ok(
      admin.selects.academia_horario.includes("fecha_inicio"),
      "sin esta columna, 'Empieza el' se rellena con hoy y el alumno salta al Diario"
    );
  });

  test("el alumno trae ficha_url para poder enseñar la ficha guardada", async () => {
    const admin = adminFalso();
    await fetchAlumnoCompleto(admin, "t1", "a1");
    assert.ok(admin.selects.academia_alumnos.includes("ficha_url"));
  });

  test("y sigue trayendo lo de siempre (día, horas y familia)", async () => {
    const admin = adminFalso();
    await fetchAlumnoCompleto(admin, "t1", "a1");
    for (const col of ["dia_semana", "hora_inicio", "hora_fin"]) {
      assert.ok(admin.selects.academia_horario.includes(col), `falta ${col}`);
    }
    assert.ok(admin.selects.academia_alumnos.includes("familia:academia_familias"));
  });
}
