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
