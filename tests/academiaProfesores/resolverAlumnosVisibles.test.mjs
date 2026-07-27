import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

// resolverAlumnoIdsVisibles() es el único punto de decisión de "qué
// alumnos puede ver este usuario" para horario/diario del profesor —
// aquí vive el test de regresión explícito de la regla de seguridad:
// un profesor sin ninguna asignación NUNCA debe recibir "sin filtro"
// (null), que es el antipatrón que causó el bug de aislamiento de datos
// en GET /api/v1/tasks. Siempre debe ser un array, vacío si no tiene nada.
export async function run({ test, assert }) {
  const { resolverAlumnoIdsVisibles } = await import("../../server/lib/academiaProfesores/resolverAlumnosVisibles.js");

  const TENANT_ID = "tenant-1";
  const TENANT_SLUG = "academia-demo";
  const USER_ID = "user-profe-1";
  const PROFESOR_ID = "profesor-1";

  test("admin -> alumnoIds: null (sin filtro, ve todo el tenant)", async () => {
    const admin = makeFakeSupabaseAdmin({});
    const res = await resolverAlumnoIdsVisibles(admin, {
      tenantId: TENANT_ID,
      tenantSlug: TENANT_SLUG,
      userId: USER_ID,
      role: "admin",
      findProfesorIdFn: async () => { throw new Error("no debería llamarse para un admin"); },
    });
    assert.deepEqual(res, { alumnoIds: null });
  });

  test("REGRESIÓN — profesor sin NINGUNA asignación -> alumnoIds: [] (nunca null, nunca datos de otros)", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_profesor_alumnos: [
        // asignaciones de OTRO profesor en el mismo tenant — no deben colarse
        { tenant_id: TENANT_ID, profesor_id: "otro-profesor", alumno_id: "alumno-de-otro" },
      ],
    });
    const res = await resolverAlumnoIdsVisibles(admin, {
      tenantId: TENANT_ID,
      tenantSlug: TENANT_SLUG,
      userId: USER_ID,
      role: "teacher",
      findProfesorIdFn: async () => PROFESOR_ID,
    });
    assert.deepEqual(res, { alumnoIds: [] });
    assert.notEqual(res.alumnoIds, null, "null equivaldría a 'sin filtro' — nunca para un profesor");
  });

  test("profesor sin fila en teacher_profiles (findProfesorIdFn -> null) -> alumnoIds: [] igualmente", async () => {
    const admin = makeFakeSupabaseAdmin({});
    const res = await resolverAlumnoIdsVisibles(admin, {
      tenantId: TENANT_ID,
      tenantSlug: TENANT_SLUG,
      userId: USER_ID,
      role: "teacher",
      findProfesorIdFn: async () => null,
    });
    assert.deepEqual(res, { alumnoIds: [] });
  });

  test("profesor con asignaciones -> alumnoIds trae solo las suyas, no las de otro profesor", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_profesor_alumnos: [
        { tenant_id: TENANT_ID, profesor_id: PROFESOR_ID, alumno_id: "alumno-a" },
        { tenant_id: TENANT_ID, profesor_id: PROFESOR_ID, alumno_id: "alumno-b" },
        { tenant_id: TENANT_ID, profesor_id: "otro-profesor", alumno_id: "alumno-de-otro" },
        { tenant_id: "otro-tenant", profesor_id: PROFESOR_ID, alumno_id: "alumno-otro-tenant" },
      ],
    });
    const res = await resolverAlumnoIdsVisibles(admin, {
      tenantId: TENANT_ID,
      tenantSlug: TENANT_SLUG,
      userId: USER_ID,
      role: "teacher",
      findProfesorIdFn: async () => PROFESOR_ID,
    });
    assert.deepEqual(res.alumnoIds.sort(), ["alumno-a", "alumno-b"]);
  });

  test("profesor sustituto: ve además los alumnos del profesor al que sustituye HOY", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_profesor_alumnos: [
        { tenant_id: TENANT_ID, profesor_id: PROFESOR_ID, alumno_id: "alumno-propio" },
        { tenant_id: TENANT_ID, profesor_id: "profesor-sustituido", alumno_id: "alumno-del-sustituido" },
        { tenant_id: TENANT_ID, profesor_id: "profesor-sin-relacion", alumno_id: "alumno-ajeno" },
      ],
      academia_sustituciones: [
        { tenant_id: TENANT_ID, profesor_sustituto_id: PROFESOR_ID, profesor_sustituido_id: "profesor-sustituido", fecha_inicio: "2026-07-26", fecha_fin: "2026-07-26", revocada_at: null },
      ],
    });
    const res = await resolverAlumnoIdsVisibles(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher",
      findProfesorIdFn: async () => PROFESOR_ID, hoyISO: "2026-07-26",
    });
    assert.deepEqual(res.alumnoIds.sort(), ["alumno-del-sustituido", "alumno-propio"]);
    // REGRESIÓN — badge "vía sustitución" (horario/diario): solo el
    // alumno que viene por cubrir a otro profesor se marca, y con el id
    // del profesor sustituido correcto — el alumno propio nunca aparece
    // aquí, ni con este ni con ningún otro profesor.
    assert.deepEqual(res.sustitucionPorAlumnoId, { "alumno-del-sustituido": "profesor-sustituido" });
  });

  test("alumno COMPARTIDO (propio Y también asignado al profesor sustituido) -> la asignación propia manda, nunca se marca como sustitución", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_profesor_alumnos: [
        { tenant_id: TENANT_ID, profesor_id: PROFESOR_ID, alumno_id: "alumno-compartido" },
        { tenant_id: TENANT_ID, profesor_id: "profesor-sustituido", alumno_id: "alumno-compartido" },
      ],
      academia_sustituciones: [
        { tenant_id: TENANT_ID, profesor_sustituto_id: PROFESOR_ID, profesor_sustituido_id: "profesor-sustituido", fecha_inicio: "2026-07-26", fecha_fin: "2026-07-26", revocada_at: null },
      ],
    });
    const res = await resolverAlumnoIdsVisibles(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher",
      findProfesorIdFn: async () => PROFESOR_ID, hoyISO: "2026-07-26",
    });
    assert.deepEqual(res.alumnoIds, ["alumno-compartido"]);
    assert.equal(res.sustitucionPorAlumnoId, undefined, "propio manda: no debe aparecer marcado como vía sustitución");
  });

  test("sin sustituciones activas -> el resultado ni siquiera incluye sustitucionPorAlumnoId (no un objeto vacío)", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_profesor_alumnos: [
        { tenant_id: TENANT_ID, profesor_id: PROFESOR_ID, alumno_id: "alumno-propio" },
      ],
    });
    const res = await resolverAlumnoIdsVisibles(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher",
      findProfesorIdFn: async () => PROFESOR_ID, hoyISO: "2026-07-26",
    });
    assert.deepEqual(res, { alumnoIds: ["alumno-propio"] });
  });

  test("sustitución de OTRO día (no hoy) no amplía nada", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_profesor_alumnos: [
        { tenant_id: TENANT_ID, profesor_id: PROFESOR_ID, alumno_id: "alumno-propio" },
        { tenant_id: TENANT_ID, profesor_id: "profesor-sustituido", alumno_id: "alumno-del-sustituido" },
      ],
      academia_sustituciones: [
        { tenant_id: TENANT_ID, profesor_sustituto_id: PROFESOR_ID, profesor_sustituido_id: "profesor-sustituido", fecha_inicio: "2026-08-01", fecha_fin: "2026-08-01", revocada_at: null },
      ],
    });
    const res = await resolverAlumnoIdsVisibles(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher",
      findProfesorIdFn: async () => PROFESOR_ID, hoyISO: "2026-07-26",
    });
    assert.deepEqual(res.alumnoIds, ["alumno-propio"]);
  });

  test("sustitución REVOCADA no amplía nada, aunque hoy esté dentro del rango original", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_profesor_alumnos: [
        { tenant_id: TENANT_ID, profesor_id: "profesor-sustituido", alumno_id: "alumno-del-sustituido" },
      ],
      academia_sustituciones: [
        { tenant_id: TENANT_ID, profesor_sustituto_id: PROFESOR_ID, profesor_sustituido_id: "profesor-sustituido", fecha_inicio: "2026-07-26", fecha_fin: "2026-07-26", revocada_at: "2026-07-26T09:00:00Z" },
      ],
    });
    const res = await resolverAlumnoIdsVisibles(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher",
      findProfesorIdFn: async () => PROFESOR_ID, hoyISO: "2026-07-26",
    });
    assert.deepEqual(res.alumnoIds, []);
  });

  test("REGRESIÓN — sin asignaciones NI sustituciones activas -> alumnoIds: [] (sigue innegociable con sustituciones en juego)", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_sustituciones: [
        // sustitución de OTRO profesor, no del nuestro — no debe colar nada
        { tenant_id: TENANT_ID, profesor_sustituto_id: "otro-profesor", profesor_sustituido_id: "otro-mas", fecha_inicio: "2026-07-26", fecha_fin: "2026-07-26", revocada_at: null },
      ],
    });
    const res = await resolverAlumnoIdsVisibles(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher",
      findProfesorIdFn: async () => PROFESOR_ID, hoyISO: "2026-07-26",
    });
    assert.deepEqual(res, { alumnoIds: [] });
  });

  test("error al buscar asignaciones se propaga (no se confunde con 'sin asignaciones')", async () => {
    const admin = {
      from(table) {
        if (table === "academia_profesor_alumnos") {
          return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: null, error: { message: "boom" } }) }) }) };
        }
        return makeFakeSupabaseAdmin({}).from(table);
      },
    };
    const res = await resolverAlumnoIdsVisibles(admin, {
      tenantId: TENANT_ID,
      tenantSlug: TENANT_SLUG,
      userId: USER_ID,
      role: "teacher",
      findProfesorIdFn: async () => PROFESOR_ID,
    });
    assert.ok(res.error, "un error real debe distinguirse de 'sin asignaciones' — no debe devolver alumnoIds: []");
    assert.equal(res.alumnoIds, undefined);
  });
}
