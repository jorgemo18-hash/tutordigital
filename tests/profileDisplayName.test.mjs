import { makeFakeSupabaseAdmin } from "./support/fakeSupabaseAdmin.mjs";

// Único punto donde vive el fallback profiles -> teacher_profiles (antes
// duplicado en academiaSustituciones/consultas.js y, de forma parcial, en
// academiaFichajes/consultas.js) — ver profileDisplayName.js para el
// porqué (profiles.display_name no está garantizado para un profesor).
export async function run({ test, assert }) {
  const {
    fetchNombresDesdeTeacherProfiles, fetchNombreDesdeTeacherProfiles, fetchNombresDePerfilesConFallback,
  } = await import("../server/lib/profileDisplayName.js");

  const TENANT_SLUG = "academia-demo";

  test("fetchNombresDesdeTeacherProfiles: resuelve varios ids del mismo tenant, ignora los sin nombre", async () => {
    const admin = makeFakeSupabaseAdmin({
      teacher_profiles: [
        { id: "tp-1", user_id: "u1", tenant_slug: TENANT_SLUG, display_name: "Ana" },
        { id: "tp-2", user_id: "u2", tenant_slug: TENANT_SLUG, display_name: null },
        { id: "tp-3", user_id: "u3", tenant_slug: "otro-tenant", display_name: "De otro centro" },
      ],
    });
    const nombres = await fetchNombresDesdeTeacherProfiles(admin, TENANT_SLUG, ["u1", "u2", "u3"]);
    assert.equal(nombres.get("u1"), "Ana");
    assert.equal(nombres.has("u2"), false, "sin display_name no debe entrar en el mapa");
    assert.equal(nombres.has("u3"), false, "de otro tenant no debe entrar");
  });

  test("fetchNombresDesdeTeacherProfiles: sin ids -> Map vacío, no consulta", async () => {
    const admin = makeFakeSupabaseAdmin({});
    const nombres = await fetchNombresDesdeTeacherProfiles(admin, TENANT_SLUG, []);
    assert.equal(nombres.size, 0);
  });

  test("fetchNombreDesdeTeacherProfiles: variante de un solo id", async () => {
    const admin = makeFakeSupabaseAdmin({
      teacher_profiles: [{ id: "tp-1", user_id: "u1", tenant_slug: TENANT_SLUG, display_name: "Ana" }],
    });
    assert.equal(await fetchNombreDesdeTeacherProfiles(admin, TENANT_SLUG, "u1"), "Ana");
    assert.equal(await fetchNombreDesdeTeacherProfiles(admin, TENANT_SLUG, "no-existe"), null);
  });

  test("fetchNombresDePerfilesConFallback: profiles con nombre no toca teacher_profiles para esos ids", async () => {
    const admin = makeFakeSupabaseAdmin({
      profiles: [{ id: "u1", display_name: "Ana Admin" }],
    });
    const nombres = await fetchNombresDePerfilesConFallback(admin, TENANT_SLUG, ["u1"]);
    assert.equal(nombres.get("u1"), "Ana Admin");
  });

  test("fetchNombresDePerfilesConFallback: profiles.display_name NULL cae a teacher_profiles del mismo tenant", async () => {
    const admin = makeFakeSupabaseAdmin({
      profiles: [{ id: "u1", display_name: null }],
      teacher_profiles: [{ id: "tp-1", user_id: "u1", tenant_slug: TENANT_SLUG, display_name: "Profe Sin Redeem" }],
    });
    const nombres = await fetchNombresDePerfilesConFallback(admin, TENANT_SLUG, ["u1"]);
    assert.equal(nombres.get("u1"), "Profe Sin Redeem");
  });

  test("fetchNombresDePerfilesConFallback: sin nombre en ningún lado -> el id queda sin entrada útil", async () => {
    const admin = makeFakeSupabaseAdmin({ profiles: [{ id: "u1", display_name: null }] });
    const nombres = await fetchNombresDePerfilesConFallback(admin, TENANT_SLUG, ["u1"]);
    assert.ok(!nombres.get("u1"));
  });

  test("fetchNombresDePerfilesConFallback: id que ni siquiera tiene fila en profiles -> también intenta el fallback", async () => {
    const admin = makeFakeSupabaseAdmin({
      teacher_profiles: [{ id: "tp-1", user_id: "u1", tenant_slug: TENANT_SLUG, display_name: "Profe Sin Redeem" }],
    });
    const nombres = await fetchNombresDePerfilesConFallback(admin, TENANT_SLUG, ["u1"]);
    assert.equal(nombres.get("u1"), "Profe Sin Redeem");
  });
}
