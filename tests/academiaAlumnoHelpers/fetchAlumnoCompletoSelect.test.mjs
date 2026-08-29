// Qué columnas trae la ficha completa del alumno (GET /:id, POST y PUT).
//
// La regresión que vive aquí: profesor_id del horario. La rejilla del drawer se pinta con este
// horario y, al guardar, actualizarHorarioSiCambia compara lo que devuelve
// la rejilla contra la base de datos INCLUYENDO el profesor
// (entra en horarioKey). Sin traerlo, el drawer veía siempre "sin profesor"
// y cada edición de la ficha borraba en silencio quién imparte cada franja —
// un dato que el admin acababa de poner.
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

  test("y sigue trayendo lo de siempre (día, horas y familia)", async () => {
    const admin = adminFalso();
    await fetchAlumnoCompleto(admin, "t1", "a1");
    for (const col of ["dia_semana", "hora_inicio", "hora_fin"]) {
      assert.ok(admin.selects.academia_horario.includes(col), `falta ${col}`);
    }
    assert.ok(admin.selects.academia_alumnos.includes("familia:academia_familias"));
  });
}
