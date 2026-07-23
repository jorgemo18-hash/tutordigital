// mapTeachers debe seguir mostrando una invitación pendiente aunque el
// docente todavía no haya canjeado el enlace (sin teacher_profiles
// todavía) — descubierto al construir el listado de "Profesores" de
// academia: sin esto, "invitación pendiente" solo se veía en la misma
// sesión en que se creaba (eco optimista del frontend) y desaparecía en
// cuanto se recargaba GET /admin/teachers.
export async function run({ test, assert }) {
  const { mapTeachers } = await import("../server/lib/adminTeacherHelpers.js");

  test("invitación pendiente sin profile todavía -> aparece como entrada propia con id:null", () => {
    const profiles = [];
    const invites = [
      { id: "inv1", email: "nuevo@demo.com", display_name: "Nuevo Profe", status: "pending", created_at: "2026-07-01T00:00:00Z", used_at: null, expires_at: "2026-07-08T00:00:00Z" },
    ];
    const result = mapTeachers(profiles, [], [], invites, []);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, null);
    assert.equal(result[0].email, "nuevo@demo.com");
    assert.equal(result[0].display_name, "Nuevo Profe");
    assert.equal(result[0].is_active, false);
    assert.equal(result[0].invite.status, "pending");
    assert.equal(result[0].invite.id, "inv1");
  });

  test("una vez existe teacher_profiles para ese email, no se duplica la entrada", () => {
    const profiles = [{ id: "p1", email: "ya-activo@demo.com", display_name: "Ya Activo", is_active: true, user_id: "u1" }];
    const invites = [
      { id: "inv2", email: "ya-activo@demo.com", display_name: "Ya Activo", status: "used", created_at: "2026-07-01T00:00:00Z", used_at: "2026-07-02T00:00:00Z", expires_at: "2026-07-08T00:00:00Z" },
    ];
    const result = mapTeachers(profiles, [], [], invites, []);
    assert.equal(result.length, 1, "no debe crear una segunda fila para el mismo email ya con profile");
    assert.equal(result[0].id, "p1");
    assert.equal(result[0].invite.status, "used");
  });

  test("invitaciones revocadas o expiradas sin profile no se muestran como fila propia", () => {
    const invites = [
      { id: "inv3", email: "revocado@demo.com", display_name: "Revocado", status: "revoked", created_at: "2026-07-01T00:00:00Z", used_at: null, expires_at: null },
      { id: "inv4", email: "expirado@demo.com", display_name: "Expirado", status: "expired", created_at: "2026-06-01T00:00:00Z", used_at: null, expires_at: "2026-06-08T00:00:00Z" },
    ];
    const result = mapTeachers([], [], [], invites, []);
    assert.equal(result.length, 0);
  });

  test("sin profiles ni invites -> lista vacía, no revienta", () => {
    assert.deepEqual(mapTeachers([], [], [], [], []), []);
  });
}
