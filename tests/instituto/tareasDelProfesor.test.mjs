// TAREAS: un profesor solo toca las de sus grupos (server/lib/tareas/).
//
// Antes, /api/v1/tasks comprobaba solo el centro: un profesor listaba las
// tareas de cualquier grupo pasando su id, creaba tareas en grupos ajenos y
// borraba las de otros. Aquí se prueba la regla; rutasFiltranPorProfesor
// comprueba que las cuatro rutas la llaman.
export async function run({ test, assert }) {
  const { puedeVerGrupo, grupoDeLaTarea, autorizaTareaDelProfesor } = await import("../../server/lib/tareas/accesoDelProfesor.js");

  // Fake: teacher_profiles → perfil, teacher_groups → sus grupos, tasks y
  // students por id.
  function fakeAdmin({ grupos = ["g1"], tareas = [], alumnos = [], fallo = null } = {}) {
    return {
      from(nombre) {
        const f = {};
        const q = {
          select() { return q; },
          eq(c, v) { f[c] = v; return q; },
          in(c, v) { f[c] = v; return q; },
          maybeSingle() {
            if (fallo === nombre) return Promise.resolve({ data: null, error: { message: "boom" } });
            if (nombre === "teacher_profiles") return Promise.resolve({ data: { id: "tp1" }, error: null });
            if (nombre === "tasks") return Promise.resolve({ data: tareas.find((t) => t.id === f.id && t.tenant_id === f.tenant_id) || null, error: null });
            if (nombre === "students") return Promise.resolve({ data: alumnos.find((a) => a.id === f.id) || null, error: null });
            return Promise.resolve({ data: null, error: null });
          },
          then(resolve) {
            if (fallo === nombre) return resolve({ data: null, error: { message: "boom" } });
            if (nombre === "teacher_groups") return resolve({ data: grupos.map((g) => ({ group_id: g })), error: null });
            return resolve({ data: [], error: null });
          },
        };
        return q;
      },
    };
  }
  const profe = { membership: { role: "teacher" }, tenant: { id: "t1", slug: "ies" }, user: { id: "u1", email: "p@x.es" } };
  const TAREAS = [
    { id: "mia", tenant_id: "t1", group_id: "g1", student_id: null },
    { id: "ajena", tenant_id: "t1", group_id: "g9", student_id: null },
    { id: "libre", tenant_id: "t1", group_id: null, student_id: "a1" },
  ];
  const ALUMNOS = [{ id: "a1", group_id: "g1" }];

  test("puedeVerGrupo: admin (null) todo; profesor solo los suyos; sin grupo, nada", () => {
    assert.equal(puedeVerGrupo(null, "g9"), true);
    assert.equal(puedeVerGrupo(["g1"], "g1"), true);
    assert.equal(puedeVerGrupo(["g1"], "g9"), false);
    assert.equal(puedeVerGrupo(["g1"], null), false, "un profesor sin grupo pedido no ve 'todo el centro'");
    assert.equal(puedeVerGrupo([], "g1"), false);
  });

  test("el grupo de una tarea personal (sesión libre) es el de su alumno", async () => {
    const r = await grupoDeLaTarea(fakeAdmin({ tareas: TAREAS, alumnos: ALUMNOS }), { tenantId: "t1", taskId: "libre" });
    assert.equal(r.grupoId, "g1");
  });

  test("PROFESOR: su tarea sí; la de otro grupo es 404 (no confirma que exista); la inexistente, 404", async () => {
    const admin = fakeAdmin({ tareas: TAREAS, alumnos: ALUMNOS });
    assert.deepEqual(await autorizaTareaDelProfesor(admin, profe, "mia"), { ok: true });
    assert.equal((await autorizaTareaDelProfesor(admin, profe, "ajena")).status, 404);
    assert.equal((await autorizaTareaDelProfesor(admin, profe, "no-existe")).status, 404);
    assert.deepEqual(await autorizaTareaDelProfesor(admin, profe, "libre"), { ok: true });
  });

  test("un fallo al consultar los grupos es un 500, nunca 'pasa'", async () => {
    const r = await autorizaTareaDelProfesor(fakeAdmin({ tareas: TAREAS, fallo: "teacher_groups" }), profe, "ajena");
    assert.equal(r.status, 500);
  });

  test("admin y alumno no pasan por aquí (el alumno tiene su propia regla en la ruta)", async () => {
    const admin = fakeAdmin({ tareas: TAREAS });
    assert.deepEqual(await autorizaTareaDelProfesor(admin, { ...profe, membership: { role: "admin" } }, "ajena"), { ok: true });
  });
}
