export async function run({ test, assert }) {
  const { computeRowActions } = await import("../assets/admin/modules/alumnos/unifiedStudentActions.js");

  test("invitado (pending) -> reenviar/revocar/eliminar disponibles, copiar enlace solo si hay url en memoria", () => {
    const row = { state: "invitado", invite_id: "inv-1", student_id: null, meta: { invite_status: "pending" } };
    assert.deepEqual(computeRowActions(row, { hasCopyLink: false }), {
      approve: false, reject: false, archive: false, restore: false,
      resend: true, copyLink: false, revoke: true, delete: true,
    });
    assert.equal(computeRowActions(row, { hasCopyLink: true }).copyLink, true);
  });

  test("invitado (expired) -> no se puede reenviar ni copiar enlace (el backend devuelve 409), pero sí revocar/eliminar", () => {
    const row = { state: "invitado", invite_id: "inv-1", student_id: null, meta: { invite_status: "expired" } };
    const actions = computeRowActions(row, { hasCopyLink: true });
    assert.equal(actions.resend, false);
    assert.equal(actions.copyLink, false);
    assert.equal(actions.revoke, true);
    assert.equal(actions.delete, true);
  });

  test("pendiente_aprobacion -> solo aprobar/rechazar", () => {
    const row = { state: "pendiente_aprobacion", invite_id: null, student_id: "stu-1" };
    const actions = computeRowActions(row);
    assert.equal(actions.approve, true);
    assert.equal(actions.reject, true);
    assert.equal(actions.archive, false);
    assert.equal(actions.restore, false);
    assert.equal(actions.resend, false);
    assert.equal(actions.revoke, false);
    assert.equal(actions.delete, false, "sin invite_id no hay acción de borrado RGPD disponible");
  });

  test("activo con student_id -> archivar disponible; eliminar depende de si se resolvió invite_id", () => {
    const conInvite = computeRowActions({ state: "activo", student_id: "stu-1", invite_id: "inv-1" });
    assert.equal(conInvite.archive, true);
    assert.equal(conInvite.delete, true);

    const sinInvite = computeRowActions({ state: "activo", student_id: "stu-1", invite_id: null });
    assert.equal(sinInvite.archive, true);
    assert.equal(sinInvite.delete, false, "anomalía sin invite_id resuelto: no se puede borrar por RGPD desde aquí");
  });

  test("activo huérfano (student_id null, viene de una invitación used sin fila students) -> no se puede archivar, sí eliminar", () => {
    const row = { state: "activo", student_id: null, invite_id: "inv-1", meta: { orphan_used_invite: true } };
    const actions = computeRowActions(row);
    assert.equal(actions.archive, false, "sin student_id no hay a quién archivar");
    assert.equal(actions.delete, true);
  });

  test("archivado -> solo restaurar (requiere student_id)", () => {
    const actions = computeRowActions({ state: "archivado", student_id: "stu-1", invite_id: "inv-1" });
    assert.equal(actions.restore, true);
    assert.equal(actions.archive, false);
    assert.equal(actions.approve, false);
  });

  test("rechazado -> solo eliminar (si hay invite_id), nada de aprobar/rechazar/archivar de nuevo", () => {
    const conInvite = computeRowActions({ state: "rechazado", student_id: "stu-1", invite_id: "inv-1" });
    assert.equal(conInvite.delete, true);
    assert.equal(conInvite.approve, false);
    assert.equal(conInvite.reject, false);
    assert.equal(conInvite.archive, false);
    assert.equal(conInvite.restore, false);

    const sinInvite = computeRowActions({ state: "rechazado", student_id: "stu-1", invite_id: null });
    assert.equal(sinInvite.delete, false);
  });

  test("fila vacía/indefinida no revienta -> todo false", () => {
    const actions = computeRowActions(undefined);
    assert.equal(Object.values(actions).every((v) => v === false), true);
  });
}
