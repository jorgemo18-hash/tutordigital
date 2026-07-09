import assert from "node:assert/strict";
import { makeFakeSupabaseAdmin } from "./support/fakeSupabaseAdmin.mjs";
import { taskBelongsToStudent } from "../server/lib/taskOwnership.js";

// /api/v1/attachments y /api/v1/session/start solo comprobaban que la
// tarea existiera en el tenant, no que perteneciera al alumno — un alumno
// podía adjuntar/arrancar sesión en la tarea de otro pasando su UUID.
// taskBelongsToStudent() es la comprobación que ambos endpoints usan ahora.
export async function run({ test }) {
  function seed() {
    return {
      tasks: [
        { id: "task-group", tenant_id: "t1", group_id: "group-x", student_id: null },
        { id: "task-other-group", tenant_id: "t1", group_id: "group-y", student_id: null },
        { id: "task-libre-a", tenant_id: "t1", group_id: null, student_id: "student-a" },
        { id: "task-libre-b", tenant_id: "t1", group_id: null, student_id: "student-b" },
      ],
    };
  }

  test("alumno de un grupo puede adjuntar a la tarea de su grupo", async () => {
    const admin = makeFakeSupabaseAdmin(seed());
    const owned = await taskBelongsToStudent(admin, {
      tenantId: "t1", taskId: "task-group",
      student: { id: "student-x", group_id: "group-x" },
    });
    assert.equal(owned, true);
  });

  test("alumno NO puede adjuntar a la tarea de OTRO grupo", async () => {
    const admin = makeFakeSupabaseAdmin(seed());
    const owned = await taskBelongsToStudent(admin, {
      tenantId: "t1", taskId: "task-other-group",
      student: { id: "student-x", group_id: "group-x" },
    });
    assert.equal(owned, false);
  });

  test("alumno puede adjuntar a su propia sesión libre (student_id)", async () => {
    const admin = makeFakeSupabaseAdmin(seed());
    const owned = await taskBelongsToStudent(admin, {
      tenantId: "t1", taskId: "task-libre-a",
      student: { id: "student-a", group_id: null },
    });
    assert.equal(owned, true);
  });

  test("alumno NO puede adjuntar a la sesión libre de OTRO alumno", async () => {
    const admin = makeFakeSupabaseAdmin(seed());
    const owned = await taskBelongsToStudent(admin, {
      tenantId: "t1", taskId: "task-libre-b",
      student: { id: "student-a", group_id: null },
    });
    assert.equal(owned, false);
  });

  test("tarea inexistente -> false", async () => {
    const admin = makeFakeSupabaseAdmin(seed());
    const owned = await taskBelongsToStudent(admin, {
      tenantId: "t1", taskId: "does-not-exist",
      student: { id: "student-a", group_id: null },
    });
    assert.equal(owned, false);
  });

  test("sin student -> false (nunca autoriza sin identidad)", async () => {
    const admin = makeFakeSupabaseAdmin(seed());
    const owned = await taskBelongsToStudent(admin, {
      tenantId: "t1", taskId: "task-libre-a", student: null,
    });
    assert.equal(owned, false);
  });
}
