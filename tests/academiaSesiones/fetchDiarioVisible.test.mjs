import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

// fetchDiarioVisible() es la función completa que corre GET
// /api/v1/academia/sesiones (el diario) — extraída de
// academia.sesiones.routes.js para poder testearla sin Fastify/auth
// real. Caso crítico: REGLA DE SEGURIDAD INNEGOCIABLE — un profesor sin
// ninguna asignación debe recibir alumnos: [], nunca el diario de otros
// alumnos del tenant (mismo antipatrón que el bug de aislamiento de
// GET /api/v1/tasks).
export async function run({ test, assert }) {
  const { fetchDiarioVisible } = await import("../../server/routes/v1/academia.sesiones.routes.js");

  const TENANT_ID = "tenant-1";
  const TENANT_SLUG = "academia-demo";
  const USER_ID = "user-profe-1";
  const PROFESOR_ID = "profesor-1";
  const FECHA = "2026-07-27"; // lunes -> dia_semana 1
  const DIA_SEMANA = 1;

  function seed() {
    return makeFakeSupabaseAdmin({
      academia_horario: [
        {
          tenant_id: TENANT_ID, alumno_id: "alumno-a", dia_semana: DIA_SEMANA,
          hora_inicio: "16:00", hora_fin: "17:00", fecha_inicio: "2026-01-01", fecha_fin: null,
          alumno: { id: "alumno-a", nombre: "Ana", curso: "1 ESO", nivel: "eso", activo: true },
        },
        {
          tenant_id: TENANT_ID, alumno_id: "alumno-b", dia_semana: DIA_SEMANA,
          hora_inicio: "17:00", hora_fin: "18:00", fecha_inicio: "2026-01-01", fecha_fin: null,
          alumno: { id: "alumno-b", nombre: "Bea", curso: "2 ESO", nivel: "eso", activo: true },
        },
      ],
      academia_sesiones: [
        {
          id: "s-extra", tenant_id: TENANT_ID, alumno_id: "alumno-c", fecha: FECHA, hora: "19:00",
          tipo: "clase", asignatura: "Mates", tema: null, asignaturas: [], comentario: null,
          comentario_privado: null, motivo_ausencia: null,
          alumno: { id: "alumno-c", nombre: "Carlos", curso: "3 ESO", nivel: "eso" },
        },
      ],
    });
  }

  test("admin ve TODO el diario del tenant (alumnos de horario + extra)", async () => {
    const admin = seed();
    const res = await fetchDiarioVisible(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "admin",
      findProfesorIdFn: async () => { throw new Error("no debería llamarse para un admin"); },
      fecha: FECHA, diaSemana: DIA_SEMANA,
    });
    assert.equal(res.error, undefined);
    assert.equal(res.sinAlumnosAsignados, false);
    assert.deepEqual(res.alumnos.map((a) => a.alumno_id).sort(), ["alumno-a", "alumno-b", "alumno-c"]);
  });

  test("REGRESIÓN — profesor sin NINGUNA asignación -> alumnos: [], nunca el diario de otros", async () => {
    const admin = seed();
    const res = await fetchDiarioVisible(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher",
      findProfesorIdFn: async () => PROFESOR_ID,
      fecha: FECHA, diaSemana: DIA_SEMANA,
    });
    assert.deepEqual(res, { alumnos: [], sinAlumnosAsignados: true });
  });

  test("profesor con 1 alumno asignado (de horario) -> solo ese alumno", async () => {
    const admin = seed();
    admin._state.tables.academia_profesor_alumnos = [
      { tenant_id: TENANT_ID, profesor_id: PROFESOR_ID, alumno_id: "alumno-a" },
    ];
    const res = await fetchDiarioVisible(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher",
      findProfesorIdFn: async () => PROFESOR_ID,
      fecha: FECHA, diaSemana: DIA_SEMANA,
    });
    assert.deepEqual(res.alumnos.map((a) => a.alumno_id), ["alumno-a"]);
  });

  test("profesor con el alumno 'extra' (sin horario ese día) asignado -> lo ve, y solo a él", async () => {
    const admin = seed();
    admin._state.tables.academia_profesor_alumnos = [
      { tenant_id: TENANT_ID, profesor_id: PROFESOR_ID, alumno_id: "alumno-c" },
    ];
    const res = await fetchDiarioVisible(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher",
      findProfesorIdFn: async () => PROFESOR_ID,
      fecha: FECHA, diaSemana: DIA_SEMANA,
    });
    assert.deepEqual(res.alumnos.map((a) => a.alumno_id), ["alumno-c"]);
  });

  test("REGRESIÓN — alumno propio -> via_sustitucion: null (nunca el badge para asignación directa)", async () => {
    const admin = seed();
    admin._state.tables.academia_profesor_alumnos = [
      { tenant_id: TENANT_ID, profesor_id: PROFESOR_ID, alumno_id: "alumno-a" },
    ];
    const res = await fetchDiarioVisible(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher",
      findProfesorIdFn: async () => PROFESOR_ID,
      fecha: FECHA, diaSemana: DIA_SEMANA,
    });
    assert.equal(res.alumnos.find((a) => a.alumno_id === "alumno-a").via_sustitucion, null);
  });

  test("alumno visible por sustitución -> via_sustitucion con el nombre del profesor cubierto", async () => {
    // fetchDiarioVisible no acepta hoyISO — resuelve "hoy" con la fecha
    // real del sistema (ver mismo comentario en fetchFranjasVisibles.test.mjs),
    // así que la sustitución sembrada debe cubrir el día real de hoy.
    const hoy = new Date().toISOString().slice(0, 10);
    const admin = seed();
    admin._state.tables.academia_profesor_alumnos = [
      { tenant_id: TENANT_ID, profesor_id: "profesor-sustituido", alumno_id: "alumno-a" },
    ];
    admin._state.tables.academia_sustituciones = [
      { tenant_id: TENANT_ID, profesor_sustituto_id: PROFESOR_ID, profesor_sustituido_id: "profesor-sustituido", fecha_inicio: hoy, fecha_fin: hoy, revocada_at: null },
    ];
    admin._state.tables.teacher_profiles = [{ id: "profesor-sustituido", display_name: "Marta" }];
    const res = await fetchDiarioVisible(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher",
      findProfesorIdFn: async () => PROFESOR_ID,
      fecha: FECHA, diaSemana: DIA_SEMANA,
    });
    const entry = res.alumnos.find((a) => a.alumno_id === "alumno-a");
    assert.deepEqual(entry.via_sustitucion, { sustituido_nombre: "Marta" });
  });

  test("profesor CON asignaciones pero sin clase hoy -> alumnos: [], sinAlumnosAsignados: false (no es lo mismo que 'sin alumnos')", async () => {
    const admin = seed();
    admin._state.tables.academia_profesor_alumnos = [
      // asignado a un alumno que ese día no tiene horario ni sesión
      { tenant_id: TENANT_ID, profesor_id: PROFESOR_ID, alumno_id: "alumno-sin-clase-hoy" },
    ];
    const res = await fetchDiarioVisible(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher",
      findProfesorIdFn: async () => PROFESOR_ID,
      fecha: FECHA, diaSemana: DIA_SEMANA,
    });
    assert.deepEqual(res.alumnos, []);
    assert.equal(res.sinAlumnosAsignados, false, "tiene asignación — el frontend no debe decir 'pide que te asignen alumnos'");
  });
}
