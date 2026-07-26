import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

// resolveTenantAdminInfo (GET /superadmin/tenants/:slug/admin) — mismo
// fallback compartido (profileDisplayName.js) que fetchTrabajadoresDelTenant/
// fetchNombreTrabajador: antes leía profiles.display_name directo y lo
// dejaba en null si esa fila no tenía nombre, sin caer a teacher_profiles.
export async function run({ test, assert }) {
  const { resolveTenantAdminInfo } = await import("../../server/routes/v1/superadmin.tenant.admin.routes.js");

  const TENANT_SLUG = "academia-demo";
  const USER_ID = "admin-1";

  function withAuthEmail(admin, email) {
    admin.auth = { admin: { getUserById: async () => ({ data: { user: email ? { email } : null } }) } };
    return admin;
  }

  test("resolveTenantAdminInfo: profiles.display_name presente -> se usa tal cual", async () => {
    const admin = withAuthEmail(
      makeFakeSupabaseAdmin({ profiles: [{ id: USER_ID, display_name: "Ana Admin", phone: "600111222" }] }),
      "ana@centro.test"
    );
    const info = await resolveTenantAdminInfo(admin, TENANT_SLUG, USER_ID);
    assert.equal(info.display_name, "Ana Admin");
    assert.equal(info.email, "ana@centro.test");
    assert.equal(info.phone, "600111222");
  });

  test("admin sin display_name en profiles cae a teacher_profiles del mismo tenant", async () => {
    const admin = withAuthEmail(
      makeFakeSupabaseAdmin({
        profiles: [{ id: USER_ID, display_name: null, phone: null }],
        teacher_profiles: [{ id: "tp-1", user_id: USER_ID, tenant_slug: TENANT_SLUG, display_name: "Profe Sin Redeem" }],
      }),
      "profe@centro.test"
    );
    const info = await resolveTenantAdminInfo(admin, TENANT_SLUG, USER_ID);
    assert.equal(info.display_name, "Profe Sin Redeem");
  });

  test("sin nombre en profiles NI en teacher_profiles -> 'Sin nombre', nunca null ni vacío", async () => {
    const admin = withAuthEmail(
      makeFakeSupabaseAdmin({ profiles: [{ id: USER_ID, display_name: null, phone: null }] }),
      "recepcion@centro.test"
    );
    const info = await resolveTenantAdminInfo(admin, TENANT_SLUG, USER_ID);
    assert.equal(info.display_name, "Sin nombre");
  });

  test("ni siquiera hay fila en profiles -> también intenta teacher_profiles antes de 'Sin nombre'", async () => {
    const admin = withAuthEmail(makeFakeSupabaseAdmin({ profiles: [] }), "sin-fila@centro.test");
    const info = await resolveTenantAdminInfo(admin, TENANT_SLUG, USER_ID);
    assert.equal(info.display_name, "Sin nombre");
  });
}
