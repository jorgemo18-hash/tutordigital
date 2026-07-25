import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

// Filtrado estricto de /academia/notas-examen (GET/POST/DELETE): un
// profesor solo puede leer/crear/borrar notas de un alumno dentro de su
// conjunto visible (asignado directamente o vía sustitución activa hoy).
export async function run({ test, assert }) {
  const { assertAlumnoVisible } = await import("../../server/routes/v1/academia.notas-examen.routes.js");

  const TENANT_ID = "tenant-1";
  const TENANT_SLUG = "academia-demo";
  const USER_ID = "user-profe-1";
  const PROFESOR_ID = "profesor-1";

  test("admin -> siempre ok", async () => {
    const admin = makeFakeSupabaseAdmin({});
    const res = await assertAlumnoVisible(admin, { tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "admin", alumnoId: "cualquiera" });
    assert.deepEqual(res, { ok: true });
  });

  test("profesor con el alumno asignado -> ok", async () => {
    const admin = makeFakeSupabaseAdmin({
      teacher_profiles: [{ id: PROFESOR_ID, tenant_slug: TENANT_SLUG, user_id: USER_ID }],
      academia_profesor_alumnos: [{ tenant_id: TENANT_ID, profesor_id: PROFESOR_ID, alumno_id: "alumno-a" }],
    });
    const res = await assertAlumnoVisible(admin, { tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher", alumnoId: "alumno-a" });
    assert.deepEqual(res, { ok: true });
  });

  test("profesor SIN el alumno asignado -> 403 alumno_no_visible", async () => {
    const admin = makeFakeSupabaseAdmin({
      teacher_profiles: [{ id: PROFESOR_ID, tenant_slug: TENANT_SLUG, user_id: USER_ID }],
      academia_profesor_alumnos: [{ tenant_id: TENANT_ID, profesor_id: PROFESOR_ID, alumno_id: "alumno-a" }],
    });
    const res = await assertAlumnoVisible(admin, { tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher", alumnoId: "alumno-de-otro" });
    assert.deepEqual(res, { ok: false, status: 403, code: "alumno_no_visible" });
  });

  test("profesor cubriendo por sustitución HOY -> puede escribir notas del alumno del sustituido", async () => {
    const admin = makeFakeSupabaseAdmin({
      teacher_profiles: [{ id: PROFESOR_ID, tenant_slug: TENANT_SLUG, user_id: USER_ID }],
      academia_profesor_alumnos: [{ tenant_id: TENANT_ID, profesor_id: "profesor-sustituido", alumno_id: "alumno-del-sustituido" }],
      academia_sustituciones: [
        { tenant_id: TENANT_ID, profesor_sustituto_id: PROFESOR_ID, profesor_sustituido_id: "profesor-sustituido", fecha_inicio: new Date().toISOString().slice(0, 10), fecha_fin: new Date().toISOString().slice(0, 10), revocada_at: null },
      ],
    });
    const res = await assertAlumnoVisible(admin, { tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher", alumnoId: "alumno-del-sustituido" });
    assert.deepEqual(res, { ok: true });
  });
}
