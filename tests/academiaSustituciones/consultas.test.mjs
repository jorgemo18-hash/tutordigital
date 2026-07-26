import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

export async function run({ test, assert }) {
  const {
    fetchSustitucionesDelTenant, fetchMisSustitucionesActivas, fetchProfesoresSustituidosHoy, fetchProfesoresParaSelector,
  } = await import("../../server/lib/academiaSustituciones/consultas.js");

  const TENANT_ID = "tenant-1";
  const TENANT_SLUG = "academia-demo";
  const ANA = "profesor-ana";
  const BEA = "profesor-bea";
  const CARLOS = "profesor-carlos";

  function seedTeachers() {
    return {
      teacher_profiles: [
        { id: ANA, tenant_slug: TENANT_SLUG, display_name: "Ana", is_active: true },
        { id: BEA, tenant_slug: TENANT_SLUG, display_name: "Bea", is_active: true },
        { id: CARLOS, tenant_slug: TENANT_SLUG, display_name: "Carlos", is_active: false },
      ],
    };
  }

  test("fetchProfesoresParaSelector solo trae activos, ordenados, y excluye al indicado", async () => {
    const admin = makeFakeSupabaseAdmin(seedTeachers());
    const { profesores, error } = await fetchProfesoresParaSelector(admin, { tenantSlug: TENANT_SLUG, excluirProfesorId: ANA });
    assert.equal(error, undefined);
    assert.deepEqual(profesores.map((p) => p.id), [BEA]); // Carlos inactivo, Ana excluida
  });

  test("fetchProfesoresParaSelector sin excluirProfesorId trae todos los activos", async () => {
    const admin = makeFakeSupabaseAdmin(seedTeachers());
    const { profesores } = await fetchProfesoresParaSelector(admin, { tenantSlug: TENANT_SLUG });
    assert.deepEqual(profesores.map((p) => p.id).sort(), [ANA, BEA]);
  });

  test("fetchProfesoresSustituidosHoy: solo sustituciones activas (no revocadas, hoy en rango)", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_sustituciones: [
        { tenant_id: TENANT_ID, profesor_sustituto_id: ANA, profesor_sustituido_id: BEA, fecha_inicio: "2026-07-26", fecha_fin: "2026-07-26", revocada_at: null },
        { tenant_id: TENANT_ID, profesor_sustituto_id: ANA, profesor_sustituido_id: CARLOS, fecha_inicio: "2026-07-01", fecha_fin: "2026-07-05", revocada_at: null }, // fuera de rango
        { tenant_id: TENANT_ID, profesor_sustituto_id: ANA, profesor_sustituido_id: "profesor-revocado", fecha_inicio: "2026-07-26", fecha_fin: "2026-07-26", revocada_at: "2026-07-26T10:00:00Z" }, // revocada
        { tenant_id: "otro-tenant", profesor_sustituto_id: ANA, profesor_sustituido_id: "de-otro-tenant", fecha_inicio: "2026-07-26", fecha_fin: "2026-07-26", revocada_at: null },
      ],
    });
    const { profesorIds, error } = await fetchProfesoresSustituidosHoy(admin, { tenantId: TENANT_ID, profesorSustitutoId: ANA, hoyISO: "2026-07-26" });
    assert.equal(error, undefined);
    assert.deepEqual(profesorIds, [BEA]);
  });

  test("fetchSustitucionesDelTenant trae TODO (activas, futuras, revocadas), con nombres resueltos", async () => {
    const admin = makeFakeSupabaseAdmin({
      ...seedTeachers(),
      profiles: [
        { id: "u1", display_name: "Admin Uno" },
        { id: "u2", display_name: "Admin Dos" },
      ],
      academia_sustituciones: [
        { id: "s1", tenant_id: TENANT_ID, profesor_sustituto_id: ANA, profesor_sustituido_id: BEA, fecha_inicio: "2026-07-26", fecha_fin: "2026-07-26", origen: "autodeclarada", created_at: "2026-07-26T08:00:00Z", declarada_por: "u1", revocada_at: null, revocada_por: null },
        { id: "s2", tenant_id: TENANT_ID, profesor_sustituto_id: BEA, profesor_sustituido_id: ANA, fecha_inicio: "2026-06-01", fecha_fin: "2026-06-02", origen: "admin", created_at: "2026-06-01T08:00:00Z", declarada_por: "u2", revocada_at: "2026-06-01T09:00:00Z", revocada_por: "u2" },
        { id: "s-otro-tenant", tenant_id: "otro-tenant", profesor_sustituto_id: ANA, profesor_sustituido_id: BEA, fecha_inicio: "2026-07-26", fecha_fin: "2026-07-26", origen: "admin", created_at: "2026-07-26T08:00:00Z", declarada_por: "u1", revocada_at: null, revocada_por: null },
      ],
    });
    const { sustituciones, error } = await fetchSustitucionesDelTenant(admin, TENANT_ID, TENANT_SLUG);
    assert.equal(error, undefined);
    assert.deepEqual(sustituciones.map((s) => s.id).sort(), ["s1", "s2"]);
    const s1 = sustituciones.find((s) => s.id === "s1");
    assert.equal(s1.sustituto_nombre, "Ana");
    assert.equal(s1.sustituido_nombre, "Bea");
    assert.equal(s1.declarada_por_nombre, "Admin Uno");
    assert.equal(s1.revocada_por_nombre, null);
    const s2 = sustituciones.find((s) => s.id === "s2");
    assert.ok(s2.revocada_at, "las revocadas también aparecen — es histórico, no solo activas");
    assert.equal(s2.revocada_por_nombre, "Admin Dos");
  });

  // REGRESIÓN — declarada_por/revocada_por referencian profiles(id), pero
  // para un profesor su nombre real vive en teacher_profiles.display_name
  // (profiles.display_name puede estar a NULL de verdad ahí). Verificado
  // con datos reales de prod antes de escribir este fix: NO es el bug de
  // embed sobre una FK inexistente de /academia/fichajes/trabajadores.
  test("fetchSustitucionesDelTenant: si profiles.display_name es null, cae a teacher_profiles del mismo tenant", async () => {
    const PROFESOR_USER_ID = "profesor-sin-nombre-en-profiles";
    const admin = makeFakeSupabaseAdmin({
      ...seedTeachers(),
      profiles: [{ id: PROFESOR_USER_ID, display_name: null }],
      teacher_profiles: [
        ...seedTeachers().teacher_profiles,
        { id: "otra-fila-profesor", user_id: PROFESOR_USER_ID, tenant_slug: TENANT_SLUG, display_name: "Profe Autor", is_active: true },
      ],
      academia_sustituciones: [
        { id: "s1", tenant_id: TENANT_ID, profesor_sustituto_id: ANA, profesor_sustituido_id: BEA, fecha_inicio: "2026-07-26", fecha_fin: "2026-07-26", origen: "autodeclarada", created_at: "2026-07-26T08:00:00Z", declarada_por: PROFESOR_USER_ID, revocada_at: null, revocada_por: null },
      ],
    });
    const { sustituciones, error } = await fetchSustitucionesDelTenant(admin, TENANT_ID, TENANT_SLUG);
    assert.equal(error, undefined);
    assert.equal(sustituciones[0].declarada_por_nombre, "Profe Autor");
  });

  test("fetchMisSustitucionesActivas: solo activas HOY donde participo (sustituto o sustituido)", async () => {
    const admin = makeFakeSupabaseAdmin({
      ...seedTeachers(),
      academia_sustituciones: [
        { id: "cubro-a-bea", tenant_id: TENANT_ID, profesor_sustituto_id: ANA, profesor_sustituido_id: BEA, fecha_inicio: "2026-07-26", fecha_fin: "2026-07-26", origen: "autodeclarada", revocada_at: null },
        { id: "carlos-me-cubre", tenant_id: TENANT_ID, profesor_sustituto_id: CARLOS, profesor_sustituido_id: ANA, fecha_inicio: "2026-07-26", fecha_fin: "2026-07-26", origen: "admin", revocada_at: null },
        { id: "no-me-toca", tenant_id: TENANT_ID, profesor_sustituto_id: BEA, profesor_sustituido_id: CARLOS, fecha_inicio: "2026-07-26", fecha_fin: "2026-07-26", origen: "admin", revocada_at: null },
        { id: "ya-pasada", tenant_id: TENANT_ID, profesor_sustituto_id: ANA, profesor_sustituido_id: BEA, fecha_inicio: "2026-07-01", fecha_fin: "2026-07-01", origen: "admin", revocada_at: null },
      ],
    });
    const { sustituciones, error } = await fetchMisSustitucionesActivas(admin, { tenantId: TENANT_ID, profesorId: ANA, hoyISO: "2026-07-26" });
    assert.equal(error, undefined);
    assert.deepEqual(sustituciones.map((s) => s.id).sort(), ["carlos-me-cubre", "cubro-a-bea"]);
    const cubroABea = sustituciones.find((s) => s.id === "cubro-a-bea");
    assert.equal(cubroABea.soy_sustituto, true);
    const carlosMeCubre = sustituciones.find((s) => s.id === "carlos-me-cubre");
    assert.equal(carlosMeCubre.soy_sustituto, false);
  });
}
