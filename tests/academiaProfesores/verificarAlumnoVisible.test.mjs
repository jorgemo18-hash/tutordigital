import { makeFakeSupabaseAdmin } from "../support/fakeSupabaseAdmin.mjs";

// verificarAlumnoVisible() es la guarda usada por los tres endpoints de
// escritura sobre un alumno concreto (POST /academia/sesiones, POST
// /academia/diario/ausencia-email, /academia/notas-examen) — deriva de
// resolverAlumnoIdsVisibles, así que cubre tanto asignación directa como
// sustitución activa sin repetir la regla.
export async function run({ test, assert }) {
  const { verificarAlumnoVisible } = await import("../../server/lib/academiaProfesores/verificarAlumnoVisible.js");

  const TENANT_ID = "tenant-1";
  const TENANT_SLUG = "academia-demo";
  const USER_ID = "user-profe-1";
  const PROFESOR_ID = "profesor-1";

  test("admin -> siempre ok, cualquier alumno", async () => {
    const admin = makeFakeSupabaseAdmin({});
    const res = await verificarAlumnoVisible(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "admin",
      findProfesorIdFn: async () => { throw new Error("no debería llamarse"); },
      alumnoId: "cualquier-alumno",
    });
    assert.deepEqual(res, { ok: true });
  });

  test("profesor con el alumno asignado -> ok", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_profesor_alumnos: [{ tenant_id: TENANT_ID, profesor_id: PROFESOR_ID, alumno_id: "alumno-a" }],
    });
    const res = await verificarAlumnoVisible(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher",
      findProfesorIdFn: async () => PROFESOR_ID, alumnoId: "alumno-a",
    });
    assert.deepEqual(res, { ok: true });
  });

  test("profesor SIN el alumno asignado ni sustitución -> rechazado (alumno_no_visible)", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_profesor_alumnos: [{ tenant_id: TENANT_ID, profesor_id: PROFESOR_ID, alumno_id: "alumno-a" }],
    });
    const res = await verificarAlumnoVisible(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher",
      findProfesorIdFn: async () => PROFESOR_ID, alumnoId: "alumno-de-otro-profesor",
    });
    assert.deepEqual(res, { ok: false, code: "alumno_no_visible" });
  });

  test("profesor sin ninguna asignación -> rechazado para CUALQUIER alumno (nunca 'sin filtro')", async () => {
    const admin = makeFakeSupabaseAdmin({});
    const res = await verificarAlumnoVisible(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher",
      findProfesorIdFn: async () => PROFESOR_ID, alumnoId: "cualquier-alumno",
    });
    assert.deepEqual(res, { ok: false, code: "alumno_no_visible" });
  });

  test("profesor sustituto: el alumno del profesor sustituido SÍ es visible hoy", async () => {
    const admin = makeFakeSupabaseAdmin({
      academia_profesor_alumnos: [{ tenant_id: TENANT_ID, profesor_id: "profesor-sustituido", alumno_id: "alumno-del-sustituido" }],
      academia_sustituciones: [
        { tenant_id: TENANT_ID, profesor_sustituto_id: PROFESOR_ID, profesor_sustituido_id: "profesor-sustituido", fecha_inicio: "2026-07-26", fecha_fin: "2026-07-26", revocada_at: null },
      ],
    });
    const res = await verificarAlumnoVisible(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher",
      findProfesorIdFn: async () => PROFESOR_ID, alumnoId: "alumno-del-sustituido", hoyISO: "2026-07-26",
    });
    assert.deepEqual(res, { ok: true });
  });

  test("error al resolver visibilidad se propaga, nunca se confunde con 'no visible'", async () => {
    const admin = {
      from(table) {
        if (table === "academia_profesor_alumnos") {
          return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: null, error: { message: "boom" } }) }) }) };
        }
        return makeFakeSupabaseAdmin({}).from(table);
      },
    };
    const res = await verificarAlumnoVisible(admin, {
      tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher",
      findProfesorIdFn: async () => PROFESOR_ID, alumnoId: "alumno-a",
    });
    assert.equal(res.ok, false);
    assert.equal(res.code, "visibilidad_fetch_failed");
    assert.ok(res.error);
  });
  // ── Afinado por día: el conflicto, y solo el conflicto ────────────────
  //
  // Desde el paso 3, un profesor puede ver a un alumno solo porque le
  // imparte UNA franja. Escribir el parte de otro día suyo sería pisar a
  // quien lo da — solo hay UNA sesión por alumno y día. Pero se bloquea
  // ÚNICAMENTE cuando ese día es de otro: exigir franja propia rompería las
  // recuperaciones y las clases sueltas, que no tienen ninguna.

  function seedDosProfesores() {
    return makeFakeSupabaseAdmin({
      academia_horario: [
        { id: "h-martes", tenant_id: TENANT_ID, alumno_id: "marta", profesor_id: "profesor-maria",
          dia_semana: 2, fecha_inicio: "2026-01-01", fecha_fin: null },
        { id: "h-jueves", tenant_id: TENANT_ID, alumno_id: "marta", profesor_id: PROFESOR_ID,
          dia_semana: 4, fecha_inicio: "2026-01-01", fecha_fin: null },
      ],
    });
  }

  const comun = {
    tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, userId: USER_ID, role: "teacher",
    findProfesorIdFn: async () => PROFESOR_ID, alumnoId: "marta",
  };

  test("REGRESIÓN: el jueves es mío -> puedo escribir su parte", async () => {
    const res = await verificarAlumnoVisible(seedDosProfesores(), { ...comun, fecha: "2026-09-10" });
    assert.deepEqual(res, { ok: true });
  });

  test("REGRESIÓN: el martes es de María -> no puedo escribirlo", async () => {
    const res = await verificarAlumnoVisible(seedDosProfesores(), { ...comun, fecha: "2026-09-08" });
    assert.equal(res.ok, false);
    assert.equal(res.code, "dia_de_otro_profesor");
  });

  test("un día SIN franja de nadie (recuperación, clase suelta) NO se bloquea", async () => {
    // El sábado no hay clase de nadie: si esto bloqueara, no se podría
    // apuntar una recuperación ni avisar de una ausencia de un día movido.
    const res = await verificarAlumnoVisible(seedDosProfesores(), { ...comun, fecha: "2026-09-12" });
    assert.deepEqual(res, { ok: true });
  });

  test("sin fecha (notas de examen) se queda en el nivel de alumno de siempre", async () => {
    const res = await verificarAlumnoVisible(seedDosProfesores(), comun);
    assert.deepEqual(res, { ok: true });
  });

  test("CON UN SOLO PROFESOR no se bloquea nada, ningún día", async () => {
    // Es el caso de Lyceo: todas las franjas son suyas, no hay "otro"
    // posible. La comprobación no puede estorbar donde no hay conflicto.
    const admin = makeFakeSupabaseAdmin({
      academia_horario: [
        { id: "h1", tenant_id: TENANT_ID, alumno_id: "marta", profesor_id: PROFESOR_ID,
          dia_semana: 2, fecha_inicio: "2026-01-01", fecha_fin: null },
      ],
    });
    for (const fecha of ["2026-09-07", "2026-09-08", "2026-09-12"]) {
      assert.deepEqual(await verificarAlumnoVisible(admin, { ...comun, fecha }), { ok: true }, fecha);
    }
  });

  test("una franja SIN profesor asignado tampoco bloquea a nadie", async () => {
    // Academia que nunca rellenó el campo: exactamente como antes de la 109.
    const admin = makeFakeSupabaseAdmin({
      academia_horario: [
        { id: "h1", tenant_id: TENANT_ID, alumno_id: "marta", profesor_id: null,
          dia_semana: 2, fecha_inicio: "2026-01-01", fecha_fin: null },
      ],
      academia_profesor_alumnos: [{ tenant_id: TENANT_ID, profesor_id: PROFESOR_ID, alumno_id: "marta" }],
    });
    assert.deepEqual(await verificarAlumnoVisible(admin, { ...comun, fecha: "2026-09-08" }), { ok: true });
  });

  test("un admin no se ve afectado por nada de esto", async () => {
    const res = await verificarAlumnoVisible(seedDosProfesores(), {
      ...comun, role: "admin", fecha: "2026-09-08",
      findProfesorIdFn: async () => { throw new Error("no debería llamarse"); },
    });
    assert.deepEqual(res, { ok: true });
  });
}
