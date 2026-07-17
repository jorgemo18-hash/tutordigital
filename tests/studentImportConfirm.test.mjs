import { makeFakeSupabaseAdmin } from "./support/fakeSupabaseAdmin.mjs";

export async function run({ test, assert }) {
  const { confirmStudentImport } = await import("../server/lib/studentImportConfirm.js");

  test("confirmStudentImport: crea una invitación y manda un email por cada fila seleccionada", async () => {
    const admin = makeFakeSupabaseAdmin({ student_invites: [], students: [] });
    const sentTo = [];
    const sendEmail = async ({ to }) => { sentTo.push(to); };

    const result = await confirmStudentImport({
      admin, tenantId: "t1", tenantSlug: "demo", tenantName: "Demo",
      groupId: "g1", groupName: "1ºA", createdBy: "u1",
      rows: [{ email: "a@a.com", name: "Ana" }, { email: "b@a.com", name: "Beatriz" }],
      sendEmail,
    });

    assert.equal(result.invited, 2);
    assert.equal(result.skipped, 0);
    assert.equal(result.total_submitted, 2);
    assert.deepEqual(sentTo.sort(), ["a@a.com", "b@a.com"]);
    assert.equal(admin._state.tables.student_invites.length, 2);
    assert.equal(admin._state.tables.student_invites[0].first_name, "Ana");
    assert.equal(typeof admin._state.tables.student_invites[0].code_hash, "string");
  });

  test("confirmStudentImport: fila con email inválido se cuenta como skipped, no aborta el resto", async () => {
    const admin = makeFakeSupabaseAdmin({ student_invites: [], students: [] });
    const sentTo = [];
    const result = await confirmStudentImport({
      admin, tenantId: "t1", tenantSlug: "demo", tenantName: "Demo",
      groupId: "g1", groupName: "1ºA", createdBy: "u1",
      rows: [{ email: "no-es-email", name: "X" }, { email: "valido@a.com", name: "Y" }],
      sendEmail: async ({ to }) => { sentTo.push(to); },
    });
    assert.equal(result.invited, 1);
    assert.equal(result.skipped, 1);
    assert.deepEqual(sentTo, ["valido@a.com"]);
  });

  test("confirmStudentImport: si sendEmail falla, la invitación queda creada igualmente (email_sent:false, no cuenta como skipped)", async () => {
    const admin = makeFakeSupabaseAdmin({ student_invites: [], students: [] });
    const result = await confirmStudentImport({
      admin, tenantId: "t1", tenantSlug: "demo", tenantName: "Demo",
      groupId: "g1", groupName: "1ºA", createdBy: "u1",
      rows: [{ email: "a@a.com", name: "Ana" }],
      sendEmail: async () => { throw new Error("resend caído"); },
    });
    assert.equal(result.invited, 1, "el envío de email es no bloqueante — la invitación en sí se creó");
    assert.equal(admin._state.tables.student_invites.length, 1);
  });

  test("confirmStudentImport: sin filas -> invited=0, skipped=0, no revienta", async () => {
    const admin = makeFakeSupabaseAdmin({ student_invites: [], students: [] });
    const result = await confirmStudentImport({
      admin, tenantId: "t1", tenantSlug: "demo", tenantName: "Demo",
      groupId: "g1", groupName: "1ºA", createdBy: "u1",
      rows: [],
      sendEmail: async () => {},
    });
    assert.deepEqual(result, { invited: 0, skipped: 0, total_submitted: 0 });
  });

  test("confirmStudentImport: normaliza el email (mayúsculas/espacios) antes de guardarlo", async () => {
    const admin = makeFakeSupabaseAdmin({ student_invites: [], students: [] });
    await confirmStudentImport({
      admin, tenantId: "t1", tenantSlug: "demo", tenantName: "Demo",
      groupId: "g1", groupName: "1ºA", createdBy: "u1",
      rows: [{ email: "  ANA@A.com  ", name: "Ana" }],
      sendEmail: async () => {},
    });
    assert.equal(admin._state.tables.student_invites[0].email, "ana@a.com");
  });
}
