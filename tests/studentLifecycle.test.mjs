export async function run({ test, assert }) {
  const { deriveUnifiedStudentList, STUDENT_STATES } = await import("../server/lib/studentLifecycle.js");

  function invite(over = {}) {
    return {
      id: "inv-1", email: "a@a.com", status: "pending", group_id: "g1",
      first_name: "Ana", last_name: "Alumna", display_name: null,
      created_at: "2026-01-01T00:00:00Z", expires_at: "2026-02-01T00:00:00Z",
      ...over,
    };
  }
  function student(over = {}) {
    return {
      id: "stu-1", email: "a@a.com", user_id: "u1", group_id: "g1",
      display_name: null, first_name: "Ana", last_name: "Alumna",
      approval_status: "approved", created_at: "2026-01-01T00:00:00Z",
      approved_at: null, rejected_at: null, rejected_reason: null,
      ...over,
    };
  }
  const groups = new Map([["g1", "1º ESO A"]]);

  test("deriveUnifiedStudentList: sin datos -> lista vacía", () => {
    assert.deepEqual(deriveUnifiedStudentList({}), []);
    assert.deepEqual(deriveUnifiedStudentList({ invites: [], students: [], groupNamesById: groups }), []);
  });

  test("invitación pending sin fila students -> estado invitado, con invite_id, sin student_id", () => {
    const rows = deriveUnifiedStudentList({ invites: [invite()], students: [], groupNamesById: groups });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].state, STUDENT_STATES.INVITADO);
    assert.equal(rows[0].invite_id, "inv-1");
    assert.equal(rows[0].student_id, null);
    assert.equal(rows[0].group_name, "1º ESO A");
  });

  test("invitación expired sin fila students -> también estado invitado (se puede reenviar)", () => {
    const rows = deriveUnifiedStudentList({ invites: [invite({ status: "expired" })], students: [] });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].state, STUDENT_STATES.INVITADO);
    assert.equal(rows[0].meta.invite_status, "expired");
  });

  test("invitación revoked -> excluida de la lista (registro muerto, no accionable)", () => {
    const rows = deriveUnifiedStudentList({ invites: [invite({ status: "revoked" })], students: [] });
    assert.deepEqual(rows, []);
  });

  test("invitación used con su fila students correspondiente -> una sola fila 'activo', no dos", () => {
    const rows = deriveUnifiedStudentList({
      invites: [invite({ status: "used" })],
      students: [student({ approval_status: "approved" })],
      groupNamesById: groups,
    });
    assert.equal(rows.length, 1, "no debe duplicarse: la invitación used se pliega en la fila students");
    assert.equal(rows[0].state, STUDENT_STATES.ACTIVO);
    assert.equal(rows[0].student_id, "stu-1");
    assert.equal(rows[0].invite_id, "inv-1", "el invite_id se resuelve por email para poder borrar (RGPD)");
  });

  test("students.approval_status='pending' -> pendiente_aprobacion", () => {
    const rows = deriveUnifiedStudentList({ students: [student({ approval_status: "pending" })] });
    assert.equal(rows[0].state, STUDENT_STATES.PENDIENTE_APROBACION);
  });

  test("students.approval_status='rejected' -> rechazado, conserva el motivo", () => {
    const rows = deriveUnifiedStudentList({
      students: [student({ approval_status: "rejected", rejected_at: "2026-02-01T00:00:00Z", rejected_reason: "No pertenece al centro" })],
    });
    assert.equal(rows[0].state, STUDENT_STATES.RECHAZADO);
    assert.equal(rows[0].meta.rejected_reason, "No pertenece al centro");
  });

  test("students.approval_status='archived' -> archivado", () => {
    const rows = deriveUnifiedStudentList({ students: [student({ approval_status: "archived" })] });
    assert.equal(rows[0].state, STUDENT_STATES.ARCHIVADO);
  });

  test("approval_status con valor desconocido/corrupto -> nunca se oculta, se trata como pendiente", () => {
    const rows = deriveUnifiedStudentList({ students: [student({ approval_status: "algo-raro" })] });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].state, STUDENT_STATES.PENDIENTE_APROBACION);
  });

  test("colisión: fila students archivada + invitación pending nueva para el mismo email -> gana students (archivado), la invitación no genera fila aparte", () => {
    const rows = deriveUnifiedStudentList({
      invites: [invite({ id: "inv-2", status: "pending" })],
      students: [student({ approval_status: "archived" })],
    });
    assert.equal(rows.length, 1, "la invitación pending no debe crear una segunda fila 'invitado'");
    assert.equal(rows[0].state, STUDENT_STATES.ARCHIVADO);
  });

  test("colisión: fila students pending + invitación revoked para el mismo email -> gana students (pendiente_aprobacion), revocar no puede des-registrar a alguien con cuenta", () => {
    const rows = deriveUnifiedStudentList({
      invites: [invite({ status: "revoked" })],
      students: [student({ approval_status: "pending" })],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].state, STUDENT_STATES.PENDIENTE_APROBACION);
  });

  test("colisión: fila students activa + invitación expired para el mismo email -> gana students (activo)", () => {
    const rows = deriveUnifiedStudentList({
      invites: [invite({ status: "expired" })],
      students: [student({ approval_status: "approved" })],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].state, STUDENT_STATES.ACTIVO);
  });

  test("invitación used SIN fila students (anomalía) -> no desaparece: se muestra como activo sin student_id", () => {
    const rows = deriveUnifiedStudentList({ invites: [invite({ status: "used" })], students: [] });
    assert.equal(rows.length, 1, "una anomalía de datos no debe ocultar a la persona");
    assert.equal(rows[0].state, STUDENT_STATES.ACTIVO);
    assert.equal(rows[0].student_id, null, "sin student_id no hay Archivar/Aprobar disponibles para esta fila");
    assert.equal(rows[0].invite_id, "inv-1");
    assert.equal(rows[0].meta.orphan_used_invite, true);
  });

  test("varias invitaciones used para el mismo email -> se usa la más reciente para resolver invite_id", () => {
    const rows = deriveUnifiedStudentList({
      invites: [
        invite({ id: "inv-old", status: "used", created_at: "2025-01-01T00:00:00Z" }),
        invite({ id: "inv-new", status: "used", created_at: "2026-05-01T00:00:00Z" }),
      ],
      students: [student({ approval_status: "approved" })],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].invite_id, "inv-new");
  });

  test("fila students con group_id null -> sin grupo, no revienta", () => {
    const rows = deriveUnifiedStudentList({ students: [student({ group_id: null })], groupNamesById: groups });
    assert.equal(rows[0].group_id, null);
    assert.equal(rows[0].group_name, null);
  });

  test("fila students sin email resuelto (user_id sin correo) -> se muestra igual, sin cruce con invitaciones", () => {
    // Sin email no hay forma de cruzar esta fila `students` con la
    // invitación "used" que probablemente la originó — quedan como dos
    // entidades separadas (la fila students, y la invitación huérfana del
    // paso 3). Es una consecuencia aceptada de no poder resolver el email
    // (fallo puntual de la búsqueda por user_id en el backend), no algo que
    // la función deba adivinar.
    const rows = deriveUnifiedStudentList({
      invites: [invite({ status: "used" })],
      students: [student({ email: null })],
    });
    assert.equal(rows.length, 2);
    const studentRow = rows.find((r) => r.student_id === "stu-1");
    assert.equal(studentRow.email, null);
    assert.equal(studentRow.invite_id, null, "sin email no se puede cruzar con la invitación para resolver el id de borrado");
    const orphanRow = rows.find((r) => r.meta.orphan_used_invite);
    assert.equal(orphanRow.email, "a@a.com");
  });

  test("comparación de email para el cruce es case/espacio-insensible", () => {
    const rows = deriveUnifiedStudentList({
      invites: [invite({ status: "used", email: "  A@A.com " })],
      students: [student({ email: "a@a.com" })],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].invite_id, "inv-1");
  });

  test("nombre: usa display_name si existe, si no compone first+last name", () => {
    const rows = deriveUnifiedStudentList({
      students: [student({ display_name: "Nombre Compuesto", first_name: "X", last_name: "Y" })],
    });
    assert.equal(rows[0].name, "Nombre Compuesto");

    const rows2 = deriveUnifiedStudentList({ students: [student({ display_name: null })] });
    assert.equal(rows2[0].name, "Ana Alumna");
  });

  test("lista mixta: ordena por created_at descendente entre invitados y registrados", () => {
    const rows = deriveUnifiedStudentList({
      invites: [invite({ id: "inv-mid", email: "b@b.com", status: "pending", created_at: "2026-03-01T00:00:00Z" })],
      students: [
        student({ id: "stu-old", email: "old@a.com", created_at: "2026-01-01T00:00:00Z" }),
        student({ id: "stu-new", email: "new@a.com", created_at: "2026-06-01T00:00:00Z" }),
      ],
    });
    assert.deepEqual(rows.map((r) => r.key), ["student:stu-new", "invite:inv-mid", "student:stu-old"]);
  });

  test("varios alumnos y estados distintos a la vez -> cada uno conserva su propio estado (no se mezclan entre sí)", () => {
    const rows = deriveUnifiedStudentList({
      invites: [
        invite({ id: "inv-pend", email: "pendiente-invite@a.com", status: "pending" }),
        invite({ id: "inv-rev", email: "revocado@a.com", status: "revoked" }),
      ],
      students: [
        student({ id: "s1", email: "aprobado@a.com", approval_status: "approved" }),
        student({ id: "s2", email: "pendiente@a.com", approval_status: "pending" }),
        student({ id: "s3", email: "archivado@a.com", approval_status: "archived" }),
        student({ id: "s4", email: "rechazado@a.com", approval_status: "rejected" }),
      ],
    });
    const byEmail = Object.fromEntries(rows.map((r) => [r.email, r.state]));
    assert.equal(byEmail["pendiente-invite@a.com"], STUDENT_STATES.INVITADO);
    assert.equal(byEmail["revocado@a.com"], undefined, "revocado no debe aparecer");
    assert.equal(byEmail["aprobado@a.com"], STUDENT_STATES.ACTIVO);
    assert.equal(byEmail["pendiente@a.com"], STUDENT_STATES.PENDIENTE_APROBACION);
    assert.equal(byEmail["archivado@a.com"], STUDENT_STATES.ARCHIVADO);
    assert.equal(byEmail["rechazado@a.com"], STUDENT_STATES.RECHAZADO);
    assert.equal(rows.length, 5);
  });
}
