import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

// El alcance de "Dar clase": el admin ve SUS alumnos, no los del centro.
//
// Gestionando, el admin tiene que ver todo. Dando clase, no: en una
// academia con cinco profesores, ver los alumnos de los otros cuatro
// convierte el diario en algo inservible. En una academia de una sola
// persona ambos conjuntos coinciden, que es lo que despista.
//
// La identidad docente NO vive en el rol (tenant_memberships solo admite un
// rol por cuenta) sino en teacher_profiles, que no comprueba rol ninguno:
// por eso un admin puede tener ficha de profesor y alumnos asignados.
export async function run({ test, assert }) {
  const { resolverAlumnoIdsVisibles } = await import(
    "../../server/lib/academiaProfesores/resolverAlumnosVisibles.js"
  );
  const { asegurarFichaProfesorDeAdmin } = await import(
    "../../server/lib/academiaProfesores/fichaAdmin.js"
  );

  const TENANT_ID = "t1";
  const SLUG = "lyceo";
  const HOY = "2026-09-15";

  function adminConAsignaciones(alumnoIds) {
    return makeFakeSupabaseAdmin({
      academia_profesor_alumnos: alumnoIds.map((alumnoId, i) => ({
        id: `pa${i}`, tenant_id: TENANT_ID, profesor_id: "prof-admin", alumno_id: alumnoId,
      })),
      academia_sustituciones: [],
    });
  }
  const base = { tenantId: TENANT_ID, tenantSlug: SLUG, userId: "u-admin", hoyISO: HOY };
  const findProfesorIdFn = async () => "prof-admin";
  const sinFicha = async () => null;

  test("admin sin pedir ámbito: sigue viendo todo el centro (sin filtro)", async () => {
    const r = await resolverAlumnoIdsVisibles(adminConAsignaciones(["a1"]), {
      ...base, role: "admin", findProfesorIdFn,
    });
    assert.equal(r.alumnoIds, null, "gestionando no se filtra nada");
  });

  test("admin con ámbito de profesor: solo sus alumnos asignados", async () => {
    const r = await resolverAlumnoIdsVisibles(adminConAsignaciones(["a1", "a2"]), {
      ...base, role: "admin", findProfesorIdFn, ambitoProfesor: true,
    });
    assert.deepEqual([...r.alumnoIds].sort(), ["a1", "a2"]);
  });

  test("admin con ámbito de profesor y sin ficha de profesor: lista vacía, NO todo el centro", async () => {
    const r = await resolverAlumnoIdsVisibles(adminConAsignaciones(["a1", "a2"]), {
      ...base, role: "admin", findProfesorIdFn: sinFicha, ambitoProfesor: true,
    });
    assert.deepEqual(r.alumnoIds, [], "vacío y con aviso, nunca 'todos por si acaso'");
  });

  test("admin con ficha pero cero asignaciones: vacío", async () => {
    const r = await resolverAlumnoIdsVisibles(adminConAsignaciones([]), {
      ...base, role: "admin", findProfesorIdFn, ambitoProfesor: true,
    });
    assert.deepEqual(r.alumnoIds, []);
  });

  test("REGRESIÓN: el parámetro NUNCA puede ampliar lo que ve un profesor", async () => {
    // Es la regla innegociable del módulo: un profesor sin asignaciones
    // devuelve [], jamás null ("sin filtro"). Pasar ambitoProfesor no puede
    // cambiar eso ni en true ni en false.
    for (const ambitoProfesor of [true, false]) {
      const r = await resolverAlumnoIdsVisibles(adminConAsignaciones([]), {
        ...base, role: "teacher", findProfesorIdFn, ambitoProfesor,
      });
      assert.deepEqual(r.alumnoIds, [], `ambitoProfesor=${ambitoProfesor}`);
      assert.notEqual(r.alumnoIds, null);
    }
  });

  test("REGRESIÓN: un profesor con ámbito pedido sigue viendo solo lo suyo", async () => {
    const r = await resolverAlumnoIdsVisibles(adminConAsignaciones(["a1"]), {
      ...base, role: "teacher", findProfesorIdFn, ambitoProfesor: true,
    });
    assert.deepEqual(r.alumnoIds, ["a1"]);
  });

  // ── Ficha de profesor del admin ──────────────────────────────────────

  test("crea la ficha con el email del admin y la deja enlazada a su cuenta", async () => {
    const db = makeFakeSupabaseAdmin({ teacher_profiles: [] });
    const r = await asegurarFichaProfesorDeAdmin(db, {
      tenantId: TENANT_ID, tenantSlug: SLUG, userId: "u-admin",
      email: "  INFO@Lyceo.com ", displayName: "Jorge",
    });
    assert.equal(r.ok, true);
    assert.equal(r.creada, true);
    const [ficha] = db._state.tables.teacher_profiles;
    assert.equal(ficha.email, "info@lyceo.com", "normalizado: la unicidad es (centro, email)");
    assert.equal(ficha.user_id, "u-admin", "sin esto findProfesorId no la encontraría");
    assert.equal(ficha.display_name, "Jorge");
    assert.equal(ficha.is_active, true);
  });

  test("sin nombre no revienta: cae al email (display_name es NOT NULL)", async () => {
    const db = makeFakeSupabaseAdmin({ teacher_profiles: [] });
    await asegurarFichaProfesorDeAdmin(db, {
      tenantId: TENANT_ID, tenantSlug: SLUG, userId: "u-admin", email: "info@lyceo.com",
    });
    assert.equal(db._state.tables.teacher_profiles[0].display_name, "info@lyceo.com");
  });

  test("es idempotente: encender el interruptor dos veces no duplica la ficha", async () => {
    const db = makeFakeSupabaseAdmin({ teacher_profiles: [] });
    const args = { tenantId: TENANT_ID, tenantSlug: SLUG, userId: "u-admin", email: "info@lyceo.com", displayName: "Jorge" };
    const primera = await asegurarFichaProfesorDeAdmin(db, args);
    const segunda = await asegurarFichaProfesorDeAdmin(db, args);
    assert.equal(db._state.tables.teacher_profiles.length, 1);
    assert.equal(segunda.creada, false);
    assert.equal(segunda.profesorId, primera.profesorId, "la misma ficha, no otra");
  });

  test("una ficha creada por email antes de tener cuenta se enlaza, no se duplica", async () => {
    const db = makeFakeSupabaseAdmin({
      teacher_profiles: [{ id: "tp1", tenant_slug: SLUG, email: "info@lyceo.com", user_id: null, display_name: "Jorge", is_active: true }],
    });
    const r = await asegurarFichaProfesorDeAdmin(db, {
      tenantId: TENANT_ID, tenantSlug: SLUG, userId: "u-admin", email: "info@lyceo.com", displayName: "Otro",
    });
    assert.equal(r.ok, true);
    assert.equal(r.enlazada, true);
    assert.equal(db._state.tables.teacher_profiles.length, 1);
    assert.equal(db._state.tables.teacher_profiles[0].user_id, "u-admin");
    assert.equal(db._state.tables.teacher_profiles[0].display_name, "Jorge", "no se pisa lo que ya había");
  });

  test("REGRESIÓN: no reactiva una ficha dada de baja a propósito", async () => {
    // Dar de baja a alguien es una decisión del admin; encender un
    // interruptor de configuración no puede deshacerla por la puerta de atrás.
    const db = makeFakeSupabaseAdmin({
      teacher_profiles: [{ id: "tp1", tenant_slug: SLUG, email: "info@lyceo.com", user_id: "u-admin", display_name: "Jorge", is_active: false }],
    });
    await asegurarFichaProfesorDeAdmin(db, {
      tenantId: TENANT_ID, tenantSlug: SLUG, userId: "u-admin", email: "info@lyceo.com",
    });
    assert.equal(db._state.tables.teacher_profiles[0].is_active, false);
  });

  test("sin email no se inventa una ficha", async () => {
    const db = makeFakeSupabaseAdmin({ teacher_profiles: [] });
    const r = await asegurarFichaProfesorDeAdmin(db, { tenantId: TENANT_ID, tenantSlug: SLUG, userId: "u-admin", email: "" });
    assert.deepEqual(r, { ok: false, code: "sin_email" });
    assert.equal(db._state.tables.teacher_profiles.length, 0);
  });
}
