import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

export async function run({ test, assert }) {
  const { crearSustitucion, revocarSustitucion } = await import("../../server/lib/academiaSustituciones/gestion.js");

  const TENANT_ID = "tenant-1";
  const TENANT_SLUG = "academia-demo";
  const SUSTITUTO_ID = "profesor-sustituto";
  const SUSTITUIDO_ID = "profesor-sustituido";

  function seedProfesores() {
    return makeFakeSupabaseAdmin({
      teacher_profiles: [
        { id: SUSTITUTO_ID, tenant_slug: TENANT_SLUG, display_name: "Ana", is_active: true },
        { id: SUSTITUIDO_ID, tenant_slug: TENANT_SLUG, display_name: "Bea", is_active: true },
        { id: "profesor-otro-tenant", tenant_slug: "otro-tenant", display_name: "Carla", is_active: true },
      ],
    });
  }

  test("crearSustitucion inserta la fila con los campos esperados", async () => {
    const admin = seedProfesores();
    const resultado = await crearSustitucion(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG,
      profesorSustitutoId: SUSTITUTO_ID, profesorSustituidoId: SUSTITUIDO_ID,
      fechaInicio: "2026-07-26", fechaFin: "2026-07-26",
      declaradaPor: "user-1", origen: "autodeclarada",
    });
    assert.equal(resultado.ok, true);
    assert.equal(resultado.sustitucion.profesor_sustituto_id, SUSTITUTO_ID);
    assert.equal(resultado.sustitucion.origen, "autodeclarada");
    const filas = admin._state.tables.academia_sustituciones;
    assert.equal(filas.length, 1);
    assert.equal(filas[0].declarada_por, "user-1");
  });

  test("rechaza si sustituto y sustituido son el mismo profesor", async () => {
    const admin = seedProfesores();
    const resultado = await crearSustitucion(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG,
      profesorSustitutoId: SUSTITUTO_ID, profesorSustituidoId: SUSTITUTO_ID,
      fechaInicio: "2026-07-26", fechaFin: "2026-07-26",
      declaradaPor: "user-1", origen: "autodeclarada",
    });
    assert.deepEqual(resultado, { ok: false, code: "mismo_profesor" });
    assert.equal((admin._state.tables.academia_sustituciones || []).length, 0);
  });

  test("rechaza si fecha_fin es anterior a fecha_inicio", async () => {
    const admin = seedProfesores();
    const resultado = await crearSustitucion(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG,
      profesorSustitutoId: SUSTITUTO_ID, profesorSustituidoId: SUSTITUIDO_ID,
      fechaInicio: "2026-07-26", fechaFin: "2026-07-20",
      declaradaPor: "user-1", origen: "admin",
    });
    assert.deepEqual(resultado, { ok: false, code: "rango_invalido" });
  });

  test("rechaza si el profesor sustituido no pertenece al tenant", async () => {
    const admin = seedProfesores();
    const resultado = await crearSustitucion(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG,
      profesorSustitutoId: SUSTITUTO_ID, profesorSustituidoId: "profesor-otro-tenant",
      fechaInicio: "2026-07-26", fechaFin: "2026-07-26",
      declaradaPor: "user-1", origen: "admin",
    });
    assert.deepEqual(resultado, { ok: false, code: "profesor_not_found" });
  });

  test("revocarSustitucion (admin) marca revocada_at/revocada_por, no borra la fila", async () => {
    const admin = seedProfesores();
    const { sustitucion } = await crearSustitucion(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG,
      profesorSustitutoId: SUSTITUTO_ID, profesorSustituidoId: SUSTITUIDO_ID,
      fechaInicio: "2026-07-26", fechaFin: "2026-07-26",
      declaradaPor: "user-1", origen: "autodeclarada",
    });
    const resultado = await revocarSustitucion(admin, { tenantId: TENANT_ID, sustitucionId: sustitucion.id, revocadaPor: "admin-1", role: "admin" });
    assert.equal(resultado.ok, true);
    const fila = admin._state.tables.academia_sustituciones.find((f) => f.id === sustitucion.id);
    assert.ok(fila, "la fila sigue existiendo — nunca se borra");
    assert.ok(fila.revocada_at);
    assert.equal(fila.revocada_por, "admin-1");
  });

  test("revocar una sustitución ya revocada -> ya_revocada, no la vuelve a tocar", async () => {
    const admin = seedProfesores();
    const { sustitucion } = await crearSustitucion(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG,
      profesorSustitutoId: SUSTITUTO_ID, profesorSustituidoId: SUSTITUIDO_ID,
      fechaInicio: "2026-07-26", fechaFin: "2026-07-26",
      declaradaPor: "user-1", origen: "autodeclarada",
    });
    await revocarSustitucion(admin, { tenantId: TENANT_ID, sustitucionId: sustitucion.id, revocadaPor: "admin-1", role: "admin" });
    const segunda = await revocarSustitucion(admin, { tenantId: TENANT_ID, sustitucionId: sustitucion.id, revocadaPor: "admin-2", role: "admin" });
    assert.deepEqual(segunda, { ok: false, code: "ya_revocada" });
    const fila = admin._state.tables.academia_sustituciones.find((f) => f.id === sustitucion.id);
    assert.equal(fila.revocada_por, "admin-1", "la segunda llamada no debe pisar quién revocó de verdad");
  });

  test("revocar una sustitución que no existe (o de otro tenant) -> not_found", async () => {
    const admin = seedProfesores();
    const resultado = await revocarSustitucion(admin, { tenantId: TENANT_ID, sustitucionId: "no-existe", revocadaPor: "admin-1", role: "admin" });
    assert.deepEqual(resultado, { ok: false, code: "not_found" });
  });

  // Regresión — el profesor recuperó la capacidad de deshacer SU PROPIA
  // sustitución autodeclarada (revierte parcialmente "solo el admin
  // revoca"), pero nunca una del admin ni la de otro profesor.
  test("REGRESIÓN — el profesor sustituto revoca su propia sustitución autodeclarada -> OK, fila marcada (no borrada)", async () => {
    const admin = seedProfesores();
    const { sustitucion } = await crearSustitucion(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG,
      profesorSustitutoId: SUSTITUTO_ID, profesorSustituidoId: SUSTITUIDO_ID,
      fechaInicio: "2026-07-26", fechaFin: "2026-07-26",
      declaradaPor: "user-1", origen: "autodeclarada",
    });
    const resultado = await revocarSustitucion(admin, {
      tenantId: TENANT_ID, sustitucionId: sustitucion.id, revocadaPor: "profile-del-sustituto",
      role: "teacher", profesorId: SUSTITUTO_ID,
    });
    assert.deepEqual(resultado, { ok: true });
    const fila = admin._state.tables.academia_sustituciones.find((f) => f.id === sustitucion.id);
    assert.ok(fila, "la fila sigue existiendo — nunca se borra");
    assert.equal(fila.revocada_por, "profile-del-sustituto");
  });

  test("REGRESIÓN — el profesor NO puede revocar una sustitución de origen='admin' -> 403 solo_autodeclaradas", async () => {
    const admin = seedProfesores();
    const { sustitucion } = await crearSustitucion(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG,
      profesorSustitutoId: SUSTITUTO_ID, profesorSustituidoId: SUSTITUIDO_ID,
      fechaInicio: "2026-07-26", fechaFin: "2026-07-26",
      declaradaPor: "admin-1", origen: "admin",
    });
    const resultado = await revocarSustitucion(admin, {
      tenantId: TENANT_ID, sustitucionId: sustitucion.id, revocadaPor: "profile-del-sustituto",
      role: "teacher", profesorId: SUSTITUTO_ID,
    });
    assert.deepEqual(resultado, { ok: false, code: "solo_autodeclaradas" });
    const fila = admin._state.tables.academia_sustituciones.find((f) => f.id === sustitucion.id);
    assert.equal(fila.revocada_at, undefined, "no debe tocarse la fila");
  });

  test("REGRESIÓN — el profesor NO puede revocar la sustitución de OTRO profesor -> 403 no_es_tu_sustitucion", async () => {
    const admin = seedProfesores();
    const { sustitucion } = await crearSustitucion(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG,
      profesorSustitutoId: SUSTITUTO_ID, profesorSustituidoId: SUSTITUIDO_ID,
      fechaInicio: "2026-07-26", fechaFin: "2026-07-26",
      declaradaPor: "user-1", origen: "autodeclarada",
    });
    const resultado = await revocarSustitucion(admin, {
      tenantId: TENANT_ID, sustitucionId: sustitucion.id, revocadaPor: "profile-de-otro",
      role: "teacher", profesorId: SUSTITUIDO_ID,
    });
    assert.deepEqual(resultado, { ok: false, code: "no_es_tu_sustitucion" });
  });

  test("admin revoca cualquiera, incluida una de origen='admin' (el admin nunca está limitado)", async () => {
    const admin = seedProfesores();
    const { sustitucion } = await crearSustitucion(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG,
      profesorSustitutoId: SUSTITUTO_ID, profesorSustituidoId: SUSTITUIDO_ID,
      fechaInicio: "2026-07-26", fechaFin: "2026-07-26",
      declaradaPor: "admin-1", origen: "admin",
    });
    const resultado = await revocarSustitucion(admin, {
      tenantId: TENANT_ID, sustitucionId: sustitucion.id, revocadaPor: "admin-1", role: "admin",
    });
    assert.deepEqual(resultado, { ok: true });
  });
}
