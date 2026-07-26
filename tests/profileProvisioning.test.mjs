import { makeFakeSupabaseAdmin } from "./support/fakeSupabaseAdmin.mjs";

// Causa raíz del 500 en POST /academia/fichajes/fichar para role='teacher':
// el flujo de invitación de profesor nunca creaba una fila en
// public.profiles, pero academia_fichajes.worker_profile_id/corregido_por
// referencian profiles(id) (ver migración 093) — sin esa fila, cualquier
// INSERT en academia_fichajes revienta con una violación de FK.
export async function run({ test, assert }) {
  const { ensureProfileExists } = await import("../server/lib/profileProvisioning.js");

  const TENANT_SLUG = "academia-demo";

  test("crea la fila si no existe, con el displayName dado", async () => {
    const admin = makeFakeSupabaseAdmin({});
    const resultado = await ensureProfileExists(admin, "user-1", { displayName: "Ana Profe" });
    assert.equal(resultado.created, true);
    const fila = admin._state.tables.profiles.find((p) => p.id === "user-1");
    assert.ok(fila, "debe crear la fila en profiles");
    assert.equal(fila.display_name, "Ana Profe");
  });

  test("no hace nada si la fila ya existe (no revienta, no la sobrescribe)", async () => {
    const admin = makeFakeSupabaseAdmin({
      profiles: [{ id: "user-1", display_name: "Nombre Original" }],
    });
    const resultado = await ensureProfileExists(admin, "user-1", { displayName: "Otro Nombre" });
    assert.equal(resultado.created, false);
    const fila = admin._state.tables.profiles.find((p) => p.id === "user-1");
    assert.equal(fila.display_name, "Nombre Original", "no debe pisar el display_name ya existente");
    assert.equal(admin._state.tables.profiles.length, 1);
  });

  test("sin displayName ni tenantSlug -> crea la fila igualmente con display_name null (no hay ninguna fuente)", async () => {
    const admin = makeFakeSupabaseAdmin({});
    await ensureProfileExists(admin, "user-2");
    const fila = admin._state.tables.profiles.find((p) => p.id === "user-2");
    assert.ok(fila);
    assert.equal(fila.display_name, null);
  });

  // REGRESIÓN — causa raíz confirmada con datos reales de producción: un
  // profesor con teacher_profiles ya creado (con nombre) pero SIN fila de
  // profiles todavía (porque nunca pasó por el flujo de redeem, p.ej. de
  // alta manual) llegaba a fichar antes que nada más creara su profile —
  // ensureProfileExists() debe resolver el nombre real desde
  // teacher_profiles en vez de dejarlo en NULL.
  test("sin displayName pero CON tenantSlug -> resuelve el nombre desde teacher_profiles del mismo tenant", async () => {
    const admin = makeFakeSupabaseAdmin({
      teacher_profiles: [
        { id: "tp-1", user_id: "user-3", tenant_slug: TENANT_SLUG, display_name: "Profe Sin Redeem" },
      ],
    });
    const resultado = await ensureProfileExists(admin, "user-3", { tenantSlug: TENANT_SLUG });
    assert.equal(resultado.created, true);
    const fila = admin._state.tables.profiles.find((p) => p.id === "user-3");
    assert.equal(fila.display_name, "Profe Sin Redeem");
  });

  test("tenantSlug dado pero SIN fila de teacher_profiles en ese tenant -> display_name null, no revienta", async () => {
    const admin = makeFakeSupabaseAdmin({
      teacher_profiles: [
        { id: "tp-1", user_id: "user-4", tenant_slug: "otro-tenant", display_name: "De otro centro" },
      ],
    });
    const resultado = await ensureProfileExists(admin, "user-4", { tenantSlug: TENANT_SLUG });
    assert.equal(resultado.created, true);
    const fila = admin._state.tables.profiles.find((p) => p.id === "user-4");
    assert.equal(fila.display_name, null);
  });

  test("displayName explícito gana sobre teacher_profiles (no llega ni a consultarlo)", async () => {
    const admin = makeFakeSupabaseAdmin({
      teacher_profiles: [
        { id: "tp-1", user_id: "user-5", tenant_slug: TENANT_SLUG, display_name: "Nombre de teacher_profiles" },
      ],
    });
    await ensureProfileExists(admin, "user-5", { displayName: "Nombre de la invitación", tenantSlug: TENANT_SLUG });
    const fila = admin._state.tables.profiles.find((p) => p.id === "user-5");
    assert.equal(fila.display_name, "Nombre de la invitación");
  });
}
