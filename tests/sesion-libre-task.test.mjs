import assert from "node:assert/strict";
import { makeFakeSupabaseAdmin } from "./support/fakeSupabaseAdmin.mjs";
import { ensureSesionLibreTask } from "../server/lib/sesionLibreTask.js";

export async function run({ test }) {
  test("crea una tarea de sistema tipo sesion_libre, sin grupo, propia del alumno", async () => {
    const admin = makeFakeSupabaseAdmin({ tasks: [] });
    const now = new Date("2026-07-08T12:00:00Z");

    const task = await ensureSesionLibreTask(admin, { tenantId: "t1", studentId: "student-a", now });

    assert.equal(task.type, "sesion_libre");
    assert.match(task.title, /^Sesión libre — 8 jul 2026$/);

    const stored = admin._state.tables.tasks.find((t) => t.id === task.id);
    assert.equal(stored.tenant_id, "t1");
    assert.equal(stored.student_id, "student-a");
    assert.equal(stored.group_id, null);
    assert.equal(stored.teacher_id, null);
  });

  test("get-or-create: la segunda llamada el mismo día reutiliza la misma tarea", async () => {
    const admin = makeFakeSupabaseAdmin({ tasks: [] });
    const now = new Date("2026-07-08T09:00:00Z");
    const later = new Date("2026-07-08T21:00:00Z");

    const first = await ensureSesionLibreTask(admin, { tenantId: "t1", studentId: "student-a", now });
    const second = await ensureSesionLibreTask(admin, { tenantId: "t1", studentId: "student-a", now: later });

    assert.equal(second.id, first.id);
    assert.equal(admin._state.tables.tasks.length, 1);
  });

  test("un nuevo día crea una tarea de sesión libre nueva (no reutiliza la de ayer)", async () => {
    const admin = makeFakeSupabaseAdmin({ tasks: [] });
    const yesterday = new Date("2026-07-07T09:00:00Z");
    const today = new Date("2026-07-08T09:00:00Z");

    const first = await ensureSesionLibreTask(admin, { tenantId: "t1", studentId: "student-a", now: yesterday });
    const second = await ensureSesionLibreTask(admin, { tenantId: "t1", studentId: "student-a", now: today });

    assert.notEqual(second.id, first.id);
    assert.equal(admin._state.tables.tasks.length, 2);
  });

  test("dos alumnos distintos el mismo día obtienen tareas distintas", async () => {
    const admin = makeFakeSupabaseAdmin({ tasks: [] });
    const now = new Date("2026-07-08T09:00:00Z");

    const taskA = await ensureSesionLibreTask(admin, { tenantId: "t1", studentId: "student-a", now });
    const taskB = await ensureSesionLibreTask(admin, { tenantId: "t1", studentId: "student-b", now });

    assert.notEqual(taskA.id, taskB.id);
  });
}
