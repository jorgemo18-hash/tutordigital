import assert from "node:assert/strict";
import { makeFakeSupabaseAdmin } from "./support/fakeSupabaseAdmin.mjs";
import { fetchTasksList } from "../server/lib/tasksHelpers.js";

// Test de seguridad: dos alumnos de academia sin grupo (group_id null) en
// el mismo tenant, cada uno con su propia sesión libre. Antes del fix,
// GET /api/v1/tasks para un alumno sin grupo devolvía TODAS las tareas del
// tenant sin filtrar (finalGroupId falsy → sin .eq("group_id", ...)) — un
// alumno de academia veía las fotos de deberes de cualquier otro alumno de
// academia del mismo centro. fetchTasksList() es la función que arregla
// esto (server/lib/tasksHelpers.js).
export async function run({ test }) {
  function seedTenant() {
    return {
      tasks: [
        {
          id: "task-a", tenant_id: "tenant-1", type: "sesion_libre",
          group_id: null, student_id: "student-a", title: "Sesión libre — alumno A",
          teacher_id: null, due_date: null, created_at: "2026-07-08T09:00:00Z",
        },
        {
          id: "task-b", tenant_id: "tenant-1", type: "sesion_libre",
          group_id: null, student_id: "student-b", title: "Sesión libre — alumno B",
          teacher_id: null, due_date: null, created_at: "2026-07-08T10:00:00Z",
        },
        // Tarea normal de grupo, para confirmar que el aislamiento por
        // student_id no interfiere con el flujo de instituto (group_id).
        {
          id: "task-group", tenant_id: "tenant-1", type: "homework",
          group_id: "group-x", student_id: null, title: "Deberes de mates",
          teacher_id: "teacher-1", due_date: "2026-07-10", created_at: "2026-07-01T09:00:00Z",
        },
      ],
    };
  }

  test("aislamiento: alumno A sin grupo solo ve su propia sesión libre", async () => {
    const admin = makeFakeSupabaseAdmin(seedTenant());
    const { data, error } = await fetchTasksList(admin, {
      tenantId: "tenant-1", finalGroupId: null, targetStudentId: "student-a",
      history: true, offset: 0, limit: 500,
    });
    assert.equal(error, null);
    assert.equal(data.length, 1);
    assert.equal(data[0].id, "task-a");
  });

  test("aislamiento: alumno B sin grupo solo ve su propia sesión libre (nunca la de A)", async () => {
    const admin = makeFakeSupabaseAdmin(seedTenant());
    const { data, error } = await fetchTasksList(admin, {
      tenantId: "tenant-1", finalGroupId: null, targetStudentId: "student-b",
      history: true, offset: 0, limit: 500,
    });
    assert.equal(error, null);
    assert.equal(data.length, 1);
    assert.equal(data[0].id, "task-b");
    assert.equal(data.some((t) => t.id === "task-a"), false);
  });

  test("un alumno con grupo sigue filtrando por group_id, sin cambios", async () => {
    const admin = makeFakeSupabaseAdmin(seedTenant());
    const { data } = await fetchTasksList(admin, {
      tenantId: "tenant-1", finalGroupId: "group-x", targetStudentId: "some-student",
      history: true, offset: 0, limit: 500,
    });
    assert.equal(data.length, 1);
    assert.equal(data[0].id, "task-group");
  });

  test("admin/teacher sin studentId ni groupId sigue viendo todo el tenant (comportamiento intencional, sin cambios)", async () => {
    const admin = makeFakeSupabaseAdmin(seedTenant());
    const { data } = await fetchTasksList(admin, {
      tenantId: "tenant-1", finalGroupId: null, targetStudentId: null,
      history: true, offset: 0, limit: 500,
    });
    assert.equal(data.length, 3);
  });
}
