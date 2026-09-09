// Quién ve a quién en el lado INSTITUTO.
//
// EL FALLO QUE CIERRA. Hasta el 09/09/2026 el aislamiento del instituto era
// por CENTRO: once rutas comprobaban que el dato fuera del tenant y nada
// más, así que un profesor leía la sesión de tutoría, las notas y las
// calificaciones de cualquier alumno del centro pasando su id. En academia
// esto llevaba meses resuelto; en instituto no existía el equivalente.
//
// LOS DOS CASOS QUE HAY QUE DEFENDER SIEMPRE, porque son la diferencia entre
// una regla de seguridad y un adorno:
//   1. Un profesor SIN grupos devuelve lista VACÍA, nunca null. `null`
//      significa "sin filtro" para quien llama, así que un profesor recién
//      creado vería el centro entero. Es el antipatrón exacto que ya causó
//      el fallo de GET /api/v1/tasks.
//   2. Un ERROR de base de datos se propaga como error, no como "sin
//      filtro". El helper viejo del instituto (getTeacherAssignedGroupIds)
//      devolvía null también al fallar: un hipo de Supabase abría el centro.
export async function run({ test, assert }) {
  const { resolverGrupoIdsVisibles, resolverAlumnoIdsVisibles, verificarAlumnoVisible, verificarGrupoVisible } =
    await import("../../server/lib/instituto/alumnosVisibles.js");

  const TENANT = "t1";
  const SLUG = "instituto-x";
  const USER = "u-profe";

  // Fake mínimo: solo las tres tablas que toca el helper, con el
  // encadenamiento que usa (select/eq/in/maybeSingle).
  function fakeAdmin({ perfil = { id: "tp1" }, grupos = [], alumnos = [], fallo = null } = {}) {
    const tabla = (nombre) => {
      const q = {
        _filtros: {},
        select() { return q; },
        eq(col, val) { q._filtros[col] = val; return q; },
        in(col, vals) { q._filtros[col] = vals; return q; },
        maybeSingle() {
          if (fallo === nombre) return Promise.resolve({ data: null, error: { message: "boom" } });
          return Promise.resolve({ data: nombre === "teacher_profiles" ? perfil : null, error: null });
        },
        then(resolve) {
          if (fallo === nombre) return resolve({ data: null, error: { message: "boom" } });
          if (nombre === "teacher_groups") return resolve({ data: grupos, error: null });
          if (nombre === "students") {
            const permitidos = q._filtros.group_id || [];
            return resolve({ data: alumnos.filter((a) => permitidos.includes(a.group_id)), error: null });
          }
          return resolve({ data: [], error: null });
        },
      };
      return q;
    };
    return { from: tabla };
  }

  const GRUPOS = [{ group_id: "g1" }, { group_id: "g2" }];
  const ALUMNOS = [
    { id: "a1", group_id: "g1" }, { id: "a2", group_id: "g1" },
    { id: "a3", group_id: "g2" }, { id: "a9", group_id: "g9" }, // g9 NO es suyo
  ];
  const base = { tenantId: TENANT, tenantSlug: SLUG, userId: USER, email: "profe@x.es" };

  test("admin: sin filtro (null), ve todo el centro", async () => {
    const r = await resolverAlumnoIdsVisibles(fakeAdmin({}), { ...base, role: "admin" });
    assert.equal(r.alumnoIds, null);
    assert.equal(r.grupoIds, null);
  });

  test("profesor: solo los alumnos de SUS grupos", async () => {
    const r = await resolverAlumnoIdsVisibles(
      fakeAdmin({ grupos: GRUPOS, alumnos: ALUMNOS }), { ...base, role: "teacher" }
    );
    assert.deepEqual(r.alumnoIds.sort(), ["a1", "a2", "a3"]);
    assert.equal(r.alumnoIds.includes("a9"), false, "a9 es de un grupo que no imparte");
  });

  test("REGRESIÓN: profesor SIN grupos -> lista vacía, JAMÁS null", async () => {
    const r = await resolverAlumnoIdsVisibles(fakeAdmin({ grupos: [] }), { ...base, role: "teacher" });
    assert.deepEqual(r.alumnoIds, []);
    assert.notEqual(r.alumnoIds, null, "null se lee como 'sin filtro' y abriría el centro entero");
  });

  test("REGRESIÓN: profesor SIN ficha de profesor -> lista vacía, JAMÁS null", async () => {
    const r = await resolverAlumnoIdsVisibles(fakeAdmin({ perfil: null }), { ...base, role: "teacher" });
    assert.deepEqual(r.alumnoIds, []);
    assert.notEqual(r.alumnoIds, null);
  });

  test("REGRESIÓN: si falla la consulta de grupos, se devuelve ERROR — no 'sin filtro'", async () => {
    // El helper viejo del instituto devolvía null al fallar, y quien lo
    // llamaba lo entendía como "no restringir". Un error transitorio de la
    // base de datos abría el centro entero.
    const r = await resolverAlumnoIdsVisibles(fakeAdmin({ fallo: "teacher_groups" }), { ...base, role: "teacher" });
    assert.ok(r.error, "tiene que haber error");
    assert.equal(r.alumnoIds, undefined, "y NO una lista, ni null");
  });

  test("REGRESIÓN: si falla la consulta de alumnos, también es error", async () => {
    const r = await resolverAlumnoIdsVisibles(
      fakeAdmin({ grupos: GRUPOS, fallo: "students" }), { ...base, role: "teacher" }
    );
    assert.ok(r.error);
    assert.equal(r.alumnoIds, undefined);
  });

  test("los grupos no se duplican aunque el profesor los imparta por dos asignaturas", async () => {
    const r = await resolverGrupoIdsVisibles(
      fakeAdmin({ grupos: [{ group_id: "g1" }, { group_id: "g1" }, { group_id: "g2" }] }),
      { ...base, role: "teacher" }
    );
    assert.deepEqual(r.grupoIds.sort(), ["g1", "g2"]);
  });

  test("verificarAlumnoVisible: admin siempre; profesor solo los suyos", async () => {
    const admin = fakeAdmin({ grupos: GRUPOS, alumnos: ALUMNOS });
    assert.equal((await verificarAlumnoVisible(admin, { ...base, role: "admin", alumnoId: "a9" })).ok, true);
    assert.equal((await verificarAlumnoVisible(admin, { ...base, role: "teacher", alumnoId: "a1" })).ok, true);

    const fuera = await verificarAlumnoVisible(admin, { ...base, role: "teacher", alumnoId: "a9" });
    assert.equal(fuera.ok, false);
    assert.equal(fuera.code, "alumno_no_visible");
  });

  test("REGRESIÓN: sin alumnoId no se cuela nadie", async () => {
    // Un id que no llega (undefined) no puede tratarse como "no hay nada que
    // comprobar": es justo el caso en el que hay que decir que no.
    const admin = fakeAdmin({ grupos: GRUPOS, alumnos: ALUMNOS });
    for (const alumnoId of [undefined, null, ""]) {
      const r = await verificarAlumnoVisible(admin, { ...base, role: "teacher", alumnoId });
      assert.equal(r.ok, false, `alumnoId=${JSON.stringify(alumnoId)} no debería pasar`);
    }
  });

  test("verificarGrupoVisible: el profesor solo entra en sus grupos", async () => {
    const admin = fakeAdmin({ grupos: GRUPOS });
    assert.equal((await verificarGrupoVisible(admin, { ...base, role: "teacher", grupoId: "g1" })).ok, true);
    const fuera = await verificarGrupoVisible(admin, { ...base, role: "teacher", grupoId: "g9" });
    assert.equal(fuera.ok, false);
    assert.equal(fuera.code, "grupo_no_visible");
    assert.equal((await verificarGrupoVisible(admin, { ...base, role: "admin", grupoId: "g9" })).ok, true);
  });

  test("un error al verificar NO se convierte en permiso", async () => {
    const roto = fakeAdmin({ fallo: "teacher_groups" });
    const r = await verificarAlumnoVisible(roto, { ...base, role: "teacher", alumnoId: "a1" });
    assert.equal(r.ok, false);
    assert.equal(r.code, "visibilidad_fetch_failed");
  });
}
