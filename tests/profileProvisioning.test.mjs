import { makeFakeSupabaseAdmin } from "./support/fakeSupabaseAdmin.mjs";

// Causa raíz del 500 en POST /academia/fichajes/fichar para role='teacher':
// el flujo de invitación de profesor nunca creaba una fila en
// public.profiles, pero academia_fichajes.worker_profile_id/corregido_por
// referencian profiles(id) (ver migración 093) — sin esa fila, cualquier
// INSERT en academia_fichajes revienta con una violación de FK.
export async function run({ test, assert }) {
  const { ensureProfileExists } = await import("../server/lib/profileProvisioning.js");

  test("crea la fila si no existe, con el display_name dado", async () => {
    const admin = makeFakeSupabaseAdmin({});
    const resultado = await ensureProfileExists(admin, "user-1", "Ana Profe");
    assert.equal(resultado.created, true);
    const fila = admin._state.tables.profiles.find((p) => p.id === "user-1");
    assert.ok(fila, "debe crear la fila en profiles");
    assert.equal(fila.display_name, "Ana Profe");
  });

  test("no hace nada si la fila ya existe (no revienta, no la sobrescribe)", async () => {
    const admin = makeFakeSupabaseAdmin({
      profiles: [{ id: "user-1", display_name: "Nombre Original" }],
    });
    const resultado = await ensureProfileExists(admin, "user-1", "Otro Nombre");
    assert.equal(resultado.created, false);
    const fila = admin._state.tables.profiles.find((p) => p.id === "user-1");
    assert.equal(fila.display_name, "Nombre Original", "no debe pisar el display_name ya existente");
    assert.equal(admin._state.tables.profiles.length, 1);
  });

  test("sin display_name -> crea la fila igualmente con display_name null (la columna es nullable)", async () => {
    const admin = makeFakeSupabaseAdmin({});
    await ensureProfileExists(admin, "user-2");
    const fila = admin._state.tables.profiles.find((p) => p.id === "user-2");
    assert.ok(fila);
    assert.equal(fila.display_name, null);
  });
}
