import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

// verificarAlumnoVisible() es la guarda usada por los tres endpoints de
// escritura sobre un alumno concreto (POST /academia/sesiones, POST
// /academia/diario/ausencia-email, /academia/notas-examen) — deriva de
// resolverAlumnoIdsVisibles, así que cubre tanto asignación directa como
// sustitución activa sin repetir la regla.
export async function run({ test, assert }) {
  const { verificarAlumnoVisible } = await import("../../server/lib/academiaProfesores/verificarAlumnoVisible.js");

  const TENANT_ID = "tenant-1";
  const TENANT_SLUG = "academia-demo";
  const USER_ID = "user-profe-1";
  const PROFESOR_ID = "profesor-1";

  test("admin -> siempre ok, cualquier alumno", async () => {
    const admin = makeFakeSupabaseAdmin({});
    const res = await verificarAlumnoVisible(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "admin",
      findProfesorIdFn: async () => { throw new Error("no debería llamarse"); },
      alumnoId: "cualquier-alumno",
    });
    assert.deepEqual(res, { ok: true });
  });

  test("profesor con el alumno asignado -> ok", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_profesor_alumnos: [{ tenant_id: TENANT_ID, profesor_id: PROFESOR_ID, alumno_id: "alumno-a" }],
    });
    const res = await verificarAlumnoVisible(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher",
      findProfesorIdFn: async () => PROFESOR_ID, alumnoId: "alumno-a",
    });
    assert.deepEqual(res, { ok: true });
  });

  test("profesor SIN el alumno asignado ni sustitución -> rechazado (alumno_no_visible)", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_profesor_alumnos: [{ tenant_id: TENANT_ID, profesor_id: PROFESOR_ID, alumno_id: "alumno-a" }],
    });
    const res = await verificarAlumnoVisible(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher",
      findProfesorIdFn: async () => PROFESOR_ID, alumnoId: "alumno-de-otro-profesor",
    });
    assert.deepEqual(res, { ok: false, code: "alumno_no_visible" });
  });

  test("profesor sin ninguna asignación -> rechazado para CUALQUIER alumno (nunca 'sin filtro')", async () => {
    const admin = makeFakeSupabaseAdmin({});
    const res = await verificarAlumnoVisible(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher",
      findProfesorIdFn: async () => PROFESOR_ID, alumnoId: "cualquier-alumno",
    });
    assert.deepEqual(res, { ok: false, code: "alumno_no_visible" });
  });

  test("profesor sustituto: el alumno del profesor sustituido SÍ es visible hoy", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_profesor_alumnos: [{ tenant_id: TENANT_ID, profesor_id: "profesor-sustituido", alumno_id: "alumno-del-sustituido" }],
      academia_sustituciones: [
        { tenant_id: TENANT_ID, profesor_sustituto_id: PROFESOR_ID, profesor_sustituido_id: "profesor-sustituido", fecha_inicio: "2026-07-26", fecha_fin: "2026-07-26", revocada_at: null },
      ],
    });
    const res = await verificarAlumnoVisible(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher",
      findProfesorIdFn: async () => PROFESOR_ID, alumnoId: "alumno-del-sustituido", hoyISO: "2026-07-26",
    });
    assert.deepEqual(res, { ok: true });
  });

  test("error al resolver visibilidad se propaga, nunca se confunde con 'no visible'", async () => {
    const admin = {
      from(table) {
        if (table === "academia_profesor_alumnos") {
          return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: null, error: { message: "boom" } }) }) }) };
        }
        return makeFakeSupabaseAdmin({}).from(table);
      },
    };
    const res = await verificarAlumnoVisible(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher",
      findProfesorIdFn: async () => PROFESOR_ID, alumnoId: "alumno-a",
    });
    assert.equal(res.ok, false);
    assert.equal(res.code, "visibilidad_fetch_failed");
    assert.ok(res.error);
  });
}
