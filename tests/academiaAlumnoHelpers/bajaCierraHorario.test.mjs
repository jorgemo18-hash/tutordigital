import fs from "node:fs";
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
      academia_tarifas: [
        { id: "t1", tenant_id: TENANT_ID, alumno_id: ALUMNO_ID, precio_bruto: 75, descuento_pct: 0, precio_neto: 75, fecha_inicio: "2026-01-01", fecha_fin: null },
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

  test("REGRESIÓN — archivar cierra también la TARIFA, no solo el horario", async () => {
    // Auditoría del 08/09/2026: se cerraba el horario y no la tarifa. En
    // producción quedaron 13 alumnos de baja con precio vigente, 1.065 €/mes
    // de tarifas abiertas de gente que ya no viene. Hoy no se les cobra
    // porque los recibos filtran por alumno activo, pero el primer informe
    // de "ingresos previstos" que lea tarifas vigentes dará un número
    // inflado sin que nada falle.
    const admin = seed();
    const { error, paso } = await marcarBajaYCerrarHorario(admin, TENANT_ID, ALUMNO_ID, "2026-08-01");

    assert.equal(error, null);
    assert.equal(paso, null);

    const tarifas = admin._state.tables.academia_tarifas;
    assert.equal(tarifas.length, 1, "la tarifa no se borra: es histórico");
    assert.equal(tarifas[0].fecha_fin, "2026-08-01", "se cierra con la MISMA fecha de baja");
  });

  test("la tarifa de OTRO alumno no se toca", () => {
    // cerrarTarifaVigente filtra por alumno y por centro; sin uno de los dos
    // una baja cerraría las tarifas de media academia.
    const src = fs.readFileSync(
      new URL("../../server/lib/academiaAlumnoHelpers.js", import.meta.url),
      "utf8"
    );
    const i = src.indexOf("export async function cerrarTarifaVigente");
    const cuerpo = src.slice(i, i + 400);
    assert.match(cuerpo, /\.eq\("tenant_id", tenantId\)/);
    assert.match(cuerpo, /\.eq\("alumno_id", alumnoId\)/);
    assert.match(cuerpo, /\.is\("fecha_fin", null\)/);
  });
}