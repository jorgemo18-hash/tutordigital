import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

// Hallazgo de la sesión anterior: dar de baja a un alumno dejaba su
// horario vigente para siempre (2 filas en producción, verificado
// 2026-08-01), oculto solo por el filtro de alumno.activo en la rejilla
// del profesor. Test de regresión explícito pedido: archivar cierra el
// horario con la fecha de baja; restaurar NO lo reactiva (decisión de
// producto: la plaza pudo darse a otro alumno mientras tanto).
export async function run({ test, assert }) {
  const { marcarBajaYCerrarHorario, restaurarAlumno, fetchHorarioVigente } = await import(
    "../../server/lib/academiaAlumnoHelpers.js"
  );

  const TENANT_ID = "tenant-1";
  const ALUMNO_ID = "alumno-1";

  function seed() {
    return makeFakeSupabaseAdmin({
      academia_alumnos: [{ id: ALUMNO_ID, tenant_id: TENANT_ID, activo: true, fecha_baja: null }],
      academia_horario: [
        { id: "h1", tenant_id: TENANT_ID, alumno_id: ALUMNO_ID, dia_semana: 1, hora_inicio: "16:30:00", hora_fin: "17:30:00", fecha_inicio: "2026-01-01", fecha_fin: null },
        { id: "h2", tenant_id: TENANT_ID, alumno_id: ALUMNO_ID, dia_semana: 2, hora_inicio: "15:30:00", hora_fin: "16:30:00", fecha_inicio: "2026-01-01", fecha_fin: null },
      ],
    });
  }

  test("REGRESIÓN — archivar un alumno con horario vigente deja sus filas cerradas con la fecha de baja", async () => {
    const admin = seed();
    const { error, paso } = await marcarBajaYCerrarHorario(admin, TENANT_ID, ALUMNO_ID, "2026-08-01");

    assert.equal(error, null);
    assert.equal(paso, null);

    const alumno = admin._state.tables.academia_alumnos.find((a) => a.id === ALUMNO_ID);
    assert.equal(alumno.activo, false);
    assert.equal(alumno.fecha_baja, "2026-08-01");

    const filas = admin._state.tables.academia_horario;
    assert.equal(filas.length, 2, "no se borra ninguna fila, se cierran");
    assert.ok(filas.every((f) => f.fecha_fin === "2026-08-01"), "las 2 filas quedan cerradas con la MISMA fecha_baja, no 'hoy' recalculado aparte");
  });

  test("REGRESIÓN — restaurar un alumno de baja no le devuelve ninguna fila de horario vigente", async () => {
    const admin = seed();
    await marcarBajaYCerrarHorario(admin, TENANT_ID, ALUMNO_ID, "2026-08-01");

    const { error } = await restaurarAlumno(admin, TENANT_ID, ALUMNO_ID);
    assert.equal(error, null);

    const alumno = admin._state.tables.academia_alumnos.find((a) => a.id === ALUMNO_ID);
    assert.equal(alumno.activo, true);
    assert.equal(alumno.fecha_baja, null);

    const { horario: vigente } = await fetchHorarioVigente(admin, TENANT_ID, ALUMNO_ID);
    assert.deepEqual(vigente, [], "restaurar no reactiva el horario — el admin lo reasigna a mano");
  });

  test("restaurar no toca academia_horario en absoluto (ni siquiera lo consulta)", async () => {
    const admin = seed();
    await marcarBajaYCerrarHorario(admin, TENANT_ID, ALUMNO_ID, "2026-08-01");
    const filasAntes = JSON.stringify(admin._state.tables.academia_horario);

    await restaurarAlumno(admin, TENANT_ID, ALUMNO_ID);

    assert.equal(JSON.stringify(admin._state.tables.academia_horario), filasAntes, "academia_horario queda exactamente igual tras restaurar");
  });
}
