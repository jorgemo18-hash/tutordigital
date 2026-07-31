import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

// fetchFranjasVisibles() es la función completa que corre GET
// /api/v1/academia/horario (extraída de academia.horario.routes.js para
// poder testearla sin Fastify/auth real). El caso crítico es el de la
// REGLA DE SEGURIDAD INNEGOCIABLE: un profesor sin ninguna asignación
// debe recibir franjas: [], nunca las franjas de otros alumnos del
// tenant (mismo antipatrón que el bug de aislamiento de GET /api/v1/tasks).
export async function run({ test, assert }) {
  const { fetchFranjasVisibles } = await import("../../server/routes/v1/academia.horario.routes.js");

  const TENANT_ID = "tenant-1";
  const TENANT_SLUG = "academia-demo";
  const USER_ID = "user-profe-1";
  const PROFESOR_ID = "profesor-1";

  function seedHorario() {
    return makeFakeSupabaseAdmin({
      academia_horario: [
        {
          id: "h1", tenant_id: TENANT_ID, alumno_id: "alumno-a", dia_semana: 1,
          hora_inicio: "16:00", hora_fin: "17:00", fecha_inicio: "2026-01-01", fecha_fin: null,
          alumno: { id: "alumno-a", nombre: "Ana", curso: "1 ESO", nivel: "eso", activo: true },
        },
        {
          id: "h2", tenant_id: TENANT_ID, alumno_id: "alumno-b", dia_semana: 2,
          hora_inicio: "17:00", hora_fin: "18:00", fecha_inicio: "2026-01-01", fecha_fin: null,
          alumno: { id: "alumno-b", nombre: "Bea", curso: "2 ESO", nivel: "eso", activo: true },
        },
      ],
    });
  }

  test("admin ve TODAS las franjas VIGENTES del tenant (sin filtro de alumno)", async () => {
    const admin = seedHorario();
    const res = await fetchFranjasVisibles(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "admin",
      findProfesorIdFn: async () => { throw new Error("no debería llamarse para un admin"); },
    });
    assert.equal(res.error, undefined);
    assert.equal(res.sinAlumnosAsignados, false);
    assert.deepEqual(res.franjas.map((f) => f.id).sort(), ["h1", "h2"]);
  });

  test("REGRESIÓN — profesor sin NINGUNA asignación -> franjas: [], nunca el horario de otros alumnos", async () => {
    const admin = seedHorario();
    // sin sembrar academia_profesor_alumnos: este profesor no tiene ninguna fila
    const res = await fetchFranjasVisibles(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher",
      findProfesorIdFn: async () => PROFESOR_ID,
    });
    assert.deepEqual(res, { franjas: [], sinAlumnosAsignados: true });
  });

  test("profesor con 1 alumno asignado -> solo la franja de ese alumno, no la del otro", async () => {
    const admin = seedHorario();
    admin._state.tables.academia_profesor_alumnos = [
      { tenant_id: TENANT_ID, profesor_id: PROFESOR_ID, alumno_id: "alumno-a" },
    ];
    const res = await fetchFranjasVisibles(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher",
      findProfesorIdFn: async () => PROFESOR_ID,
    });
    assert.equal(res.franjas.length, 1);
    assert.equal(res.franjas[0].id, "h1");
    assert.equal(res.sinAlumnosAsignados, false);
  });

  test("REGRESIÓN — franja de un alumno propio -> via_sustitucion: null (nunca el badge para asignación directa)", async () => {
    const admin = seedHorario();
    admin._state.tables.academia_profesor_alumnos = [
      { tenant_id: TENANT_ID, profesor_id: PROFESOR_ID, alumno_id: "alumno-a" },
    ];
    const res = await fetchFranjasVisibles(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher",
      findProfesorIdFn: async () => PROFESOR_ID,
    });
    assert.equal(res.franjas[0].via_sustitucion, null);
  });

  test("franja de un alumno visible por sustitución -> via_sustitucion con el nombre del profesor cubierto", async () => {
    // fetchFranjasVisibles no acepta hoyISO (a diferencia de
    // resolverAlumnoIdsVisibles) — siempre resuelve "hoy" con la fecha
    // real del sistema, así que la sustitución sembrada debe cubrir HOY
    // de verdad para que este test no dependa de en qué día se ejecute.
    const hoy = new Date().toISOString().slice(0, 10);
    const admin = seedHorario();
    admin._state.tables.academia_profesor_alumnos = [
      { tenant_id: TENANT_ID, profesor_id: "profesor-sustituido", alumno_id: "alumno-a" },
    ];
    admin._state.tables.academia_sustituciones = [
      { tenant_id: TENANT_ID, profesor_sustituto_id: PROFESOR_ID, profesor_sustituido_id: "profesor-sustituido", fecha_inicio: hoy, fecha_fin: hoy, revocada_at: null },
    ];
    admin._state.tables.teacher_profiles = [{ id: "profesor-sustituido", display_name: "Marta" }];
    const res = await fetchFranjasVisibles(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher",
      findProfesorIdFn: async () => PROFESOR_ID,
    });
    const franja = res.franjas.find((f) => f.id === "h1");
    assert.deepEqual(franja.via_sustitucion, { sustituido_nombre: "Marta" });
  });

  test("REGRESIÓN — una franja CERRADA (fecha_fin no nulo) no aparece, aunque el alumno siga activo", async () => {
    // Verificado en producción (2026-08-01): 32 de 47 filas de Lyceo
    // estaban cerradas por guardados del alumno que no tocaban el
    // horario, y esta consulta las mostraba igual porque no filtraba.
    const admin = makeFakeSupabaseAdmin({
      academia_horario: [
        {
          id: "h-vigente", tenant_id: TENANT_ID, alumno_id: "alumno-a", dia_semana: 1,
          hora_inicio: "16:00", hora_fin: "17:00", fecha_inicio: "2026-01-01", fecha_fin: null,
          alumno: { id: "alumno-a", nombre: "Ana", curso: "1 ESO", nivel: "eso", activo: true },
        },
        {
          id: "h-cerrada", tenant_id: TENANT_ID, alumno_id: "alumno-a", dia_semana: 2,
          hora_inicio: "17:00", hora_fin: "18:00", fecha_inicio: "2026-01-01", fecha_fin: "2026-06-01",
          alumno: { id: "alumno-a", nombre: "Ana", curso: "1 ESO", nivel: "eso", activo: true },
        },
      ],
    });
    const res = await fetchFranjasVisibles(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "admin",
      findProfesorIdFn: async () => { throw new Error("no debería llamarse"); },
    });
    assert.deepEqual(res.franjas.map((f) => f.id), ["h-vigente"]);
  });

  test("una franja de un alumno inactivo no se cuenta (ni para admin ni para profesor)", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_horario: [
        {
          id: "h1", tenant_id: TENANT_ID, alumno_id: "alumno-baja", dia_semana: 1,
          hora_inicio: "16:00", hora_fin: "17:00", fecha_inicio: "2026-01-01", fecha_fin: null,
          alumno: { id: "alumno-baja", nombre: "Carlos", curso: "1 ESO", nivel: "eso", activo: false },
        },
      ],
    });
    const res = await fetchFranjasVisibles(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "admin",
      findProfesorIdFn: async () => { throw new Error("no debería llamarse"); },
    });
    assert.deepEqual(res.franjas, []);
  });
}
