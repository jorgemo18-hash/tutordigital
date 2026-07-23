import { makeFakeSupabaseAdmin } from "./support/fakeSupabaseAdmin.mjs";

// Punto 5 del encargo (bug preexistente ya localizado): teacher_profiles
// no tiene columna tenant_id, solo tenant_slug (ver
// 014_admin_teacher_invites.sql) — findProfesorId() en
// academia.sesiones.routes.js y academia.notas-examen.routes.js filtraba
// por tenant_id, que no existe en la fila, así que nunca encontraba nada.
// Aquí se siembra una fila SOLO con tenant_slug (tal cual es el esquema
// real) y se comprueba que la búsqueda por tenant_slug sí la encuentra —
// si alguien reintrodujera el filtro por tenant_id, este test volvería a
// fallar (la fila no tiene esa columna, .eq("tenant_id", ...) no matchea).
export async function run({ test, assert }) {
  const { findProfesorId: findProfesorIdSesiones } = await import("../server/routes/v1/academia.sesiones.routes.js");
  const { findProfesorId: findProfesorIdNotas } = await import("../server/routes/v1/academia.notas-examen.routes.js");

  const TENANT_SLUG = "academia-demo";
  const USER_ID = "user-1";
  const PROFILE_ID = "profile-1";

  function fakeAdmin() {
    return makeFakeSupabaseAdmin({
      teacher_profiles: [
        { id: PROFILE_ID, tenant_slug: TENANT_SLUG, user_id: USER_ID, email: "profe@demo.com", display_name: "Profe Demo" },
        { id: "otro-profile", tenant_slug: "otro-tenant", user_id: USER_ID, email: "otro@demo.com", display_name: "Otro" },
      ],
    });
  }

  test("academia.sesiones: encuentra el teacher_profiles filtrando por tenant_slug", async () => {
    const admin = fakeAdmin();
    const id = await findProfesorIdSesiones(admin, TENANT_SLUG, USER_ID);
    assert.equal(id, PROFILE_ID);
  });

  test("academia.notas-examen: encuentra el teacher_profiles filtrando por tenant_slug", async () => {
    const admin = fakeAdmin();
    const id = await findProfesorIdNotas(admin, TENANT_SLUG, USER_ID);
    assert.equal(id, PROFILE_ID);
  });

  test("academia.sesiones: no confunde perfiles del mismo usuario en otro tenant", async () => {
    const admin = fakeAdmin();
    const id = await findProfesorIdSesiones(admin, "otro-tenant", USER_ID);
    assert.equal(id, "otro-profile");
  });

  test("academia.notas-examen: sin fila para ese tenant_slug+user_id -> null (no revienta)", async () => {
    const admin = fakeAdmin();
    const id = await findProfesorIdNotas(admin, "tenant-inexistente", USER_ID);
    assert.equal(id, null);
  });
}
