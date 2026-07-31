import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

// PUT /:id/horario cerraba y recreaba SIEMPRE, y guardarCambios() en el
// drawer lo llama en cada guardado del alumno aunque no se toque el
// horario — verificado en producción (2026-08-01): 32 de 47 filas de
// Lyceo estaban cerradas para alumnos que siguen activos, puro churn de
// guardados sin relación con el horario. Este es el test de regresión
// explícito pedido: guardar sin tocar el horario no debe crear ninguna
// fila nueva ni cerrar la vigente.
export async function run({ test, assert }) {
  const { horarioSinCambios, fetchHorarioVigente, actualizarHorarioSiCambia } = await import(
    "../../server/lib/academiaAlumnoHelpers.js"
  );

  const TENANT_ID = "tenant-1";
  const ALUMNO_ID = "alumno-1";

  function seed(horarioVigente) {
    return makeFakeSupabaseAdmin({
      academia_horario: horarioVigente.map((h, i) => ({
        id: `h${i}`, tenant_id: TENANT_ID, alumno_id: ALUMNO_ID, fecha_inicio: "2026-01-01", fecha_fin: null, ...h,
      })),
    });
  }

  test("horarioSinCambios: mismo conjunto en distinto orden -> sin cambios", () => {
    const vigente = [{ dia_semana: 1, hora_inicio: "16:00:00", hora_fin: "17:00:00" }, { dia_semana: 3, hora_inicio: "17:00:00", hora_fin: "18:00:00" }];
    const nuevo = [{ dia_semana: 3, hora_inicio: "17:00", hora_fin: "18:00" }, { dia_semana: 1, hora_inicio: "16:00", hora_fin: "17:00" }];
    assert.equal(horarioSinCambios(vigente, nuevo), true);
  });

  test("horarioSinCambios: normaliza 'HH:MM:SS' (BD) contra 'HH:MM' (petición) — no son 'distintos' por el formato", () => {
    const vigente = [{ dia_semana: 1, hora_inicio: "16:00:00", hora_fin: "17:00:00" }];
    const nuevo = [{ dia_semana: 1, hora_inicio: "16:00", hora_fin: "17:00" }];
    assert.equal(horarioSinCambios(vigente, nuevo), true);
  });

  test("horarioSinCambios: una hora distinta -> SÍ hay cambio", () => {
    const vigente = [{ dia_semana: 1, hora_inicio: "16:00", hora_fin: "17:00" }];
    const nuevo = [{ dia_semana: 1, hora_inicio: "16:15", hora_fin: "17:15" }];
    assert.equal(horarioSinCambios(vigente, nuevo), false);
  });

  test("horarioSinCambios: distinto número de tramos -> SÍ hay cambio", () => {
    const vigente = [{ dia_semana: 1, hora_inicio: "16:00", hora_fin: "17:00" }];
    const nuevo = [{ dia_semana: 1, hora_inicio: "16:00", hora_fin: "17:00" }, { dia_semana: 3, hora_inicio: "16:00", hora_fin: "17:00" }];
    assert.equal(horarioSinCambios(vigente, nuevo), false);
  });

  test("REGRESIÓN — guardar el MISMO horario no crea ninguna fila nueva ni cierra la vigente", async () => {
    const admin = seed([{ dia_semana: 1, hora_inicio: "16:00:00", hora_fin: "17:00:00" }]);
    const antesCount = admin._state.tables.academia_horario.length;

    const { error, cambiado } = await actualizarHorarioSiCambia(
      admin, TENANT_ID, ALUMNO_ID,
      [{ dia_semana: 1, hora_inicio: "16:00", hora_fin: "17:00" }],
      "2026-08-01"
    );

    assert.equal(error, null);
    assert.equal(cambiado, false, "el horario enviado es idéntico al vigente");
    assert.equal(admin._state.tables.academia_horario.length, antesCount, "no debe crearse ninguna fila nueva");
    assert.equal(admin._state.tables.academia_horario[0].fecha_fin, null, "la fila vigente no debe cerrarse");
    assert.equal(admin._state.tables.academia_horario[0].id, "h0", "sigue siendo la misma fila, no una recreada");
  });

  test("guardar un horario REALMENTE distinto sí cierra lo vigente y crea lo nuevo", async () => {
    const admin = seed([{ dia_semana: 1, hora_inicio: "16:00:00", hora_fin: "17:00:00" }]);

    const { error, cambiado } = await actualizarHorarioSiCambia(
      admin, TENANT_ID, ALUMNO_ID,
      [{ dia_semana: 2, hora_inicio: "17:00", hora_fin: "18:00" }],
      "2026-08-01"
    );

    assert.equal(error, null);
    assert.equal(cambiado, true);
    const filas = admin._state.tables.academia_horario;
    assert.equal(filas.length, 2, "la vieja se cierra (no se borra) y se inserta una nueva");
    assert.equal(filas.find((f) => f.id === "h0").fecha_fin, "2026-08-01");
    // La fila insertada no fija fecha_fin explícitamente (columna nullable,
    // sin valor por defecto propio en insertarHorario) — !f.fecha_fin
    // cubre tanto null como key ausente, no solo `=== null`.
    assert.equal(filas.filter((f) => !f.fecha_fin).length, 1);
    assert.equal(filas.find((f) => !f.fecha_fin).dia_semana, 2);
  });

  test("guardar un horario vacío cuando ya estaba vacío -> sin cambios, nada que cerrar ni insertar", async () => {
    const admin = seed([]);
    const { error, cambiado } = await actualizarHorarioSiCambia(admin, TENANT_ID, ALUMNO_ID, [], "2026-08-01");
    assert.equal(error, null);
    assert.equal(cambiado, false);
    assert.equal(admin._state.tables.academia_horario.length, 0);
  });

  test("fetchHorarioVigente: solo trae filas vigentes del alumno y tenant pedidos", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_horario: [
        { id: "h1", tenant_id: TENANT_ID, alumno_id: ALUMNO_ID, dia_semana: 1, hora_inicio: "16:00", hora_fin: "17:00", fecha_fin: null },
        { id: "h2", tenant_id: TENANT_ID, alumno_id: ALUMNO_ID, dia_semana: 2, hora_inicio: "17:00", hora_fin: "18:00", fecha_fin: "2026-01-01" },
        { id: "h3", tenant_id: TENANT_ID, alumno_id: "otro-alumno", dia_semana: 1, hora_inicio: "16:00", hora_fin: "17:00", fecha_fin: null },
      ],
    });
    const { horario, error } = await fetchHorarioVigente(admin, TENANT_ID, ALUMNO_ID);
    assert.equal(error, undefined);
    assert.equal(horario.length, 1);
    assert.equal(horario[0].dia_semana, 1);
  });
}
