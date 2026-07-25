export async function run({ test, assert }) {
  const { resolverParametrosCreacion } = await import("../../server/lib/academiaSustituciones/reglasCreacion.js");

  const HOY = "2026-07-26";
  const MI_PROFESOR_ID = "profesor-yo";

  test("profesor: sin body de fechas/sustituto -> autodeclarada, hoy-hoy, él mismo de sustituto", () => {
    const res = resolverParametrosCreacion({
      role: "teacher", miProfesorId: MI_PROFESOR_ID, body: { profesor_sustituido_id: "profesor-x" }, hoyISO: HOY,
    });
    assert.deepEqual(res, {
      ok: true, profesorSustitutoId: MI_PROFESOR_ID, fechaInicio: HOY, fechaFin: HOY, origen: "autodeclarada",
    });
  });

  test("profesor: manda fecha_inicio distinta de hoy -> 403 solo_hoy", () => {
    const res = resolverParametrosCreacion({
      role: "teacher", miProfesorId: MI_PROFESOR_ID,
      body: { profesor_sustituido_id: "profesor-x", fecha_inicio: "2026-07-27" }, hoyISO: HOY,
    });
    assert.deepEqual(res, { ok: false, code: "solo_hoy" });
  });

  test("profesor: manda fecha_fin distinta de hoy (rango futuro) -> 403 solo_hoy", () => {
    const res = resolverParametrosCreacion({
      role: "teacher", miProfesorId: MI_PROFESOR_ID,
      body: { profesor_sustituido_id: "profesor-x", fecha_inicio: HOY, fecha_fin: "2026-07-30" }, hoyISO: HOY,
    });
    assert.deepEqual(res, { ok: false, code: "solo_hoy" });
  });

  test("profesor: fecha_inicio=fecha_fin=hoy explícitas -> ok (coincide, no rechazado)", () => {
    const res = resolverParametrosCreacion({
      role: "teacher", miProfesorId: MI_PROFESOR_ID,
      body: { profesor_sustituido_id: "profesor-x", fecha_inicio: HOY, fecha_fin: HOY }, hoyISO: HOY,
    });
    assert.equal(res.ok, true);
  });

  test("profesor: intenta declarar a OTRO profesor como sustituto -> 403 solo_autodeclaracion", () => {
    const res = resolverParametrosCreacion({
      role: "teacher", miProfesorId: MI_PROFESOR_ID,
      body: { profesor_sustituto_id: "profesor-otro", profesor_sustituido_id: "profesor-x" }, hoyISO: HOY,
    });
    assert.deepEqual(res, { ok: false, code: "solo_autodeclaracion" });
  });

  test("profesor: sin perfil de profesor (findProfesorId no encontró nada) -> 403 no_perfil_profesor", () => {
    const res = resolverParametrosCreacion({
      role: "teacher", miProfesorId: null, body: { profesor_sustituido_id: "profesor-x" }, hoyISO: HOY,
    });
    assert.deepEqual(res, { ok: false, code: "no_perfil_profesor" });
  });

  test("admin: cualquier rango de fechas, incluidas futuras -> ok", () => {
    const res = resolverParametrosCreacion({
      role: "admin", miProfesorId: null,
      body: { profesor_sustituto_id: "profesor-a", profesor_sustituido_id: "profesor-b", fecha_inicio: "2026-09-01", fecha_fin: "2026-09-05" },
      hoyISO: HOY,
    });
    assert.deepEqual(res, {
      ok: true, profesorSustitutoId: "profesor-a", fechaInicio: "2026-09-01", fechaFin: "2026-09-05", origen: "admin",
    });
  });

  test("admin: sin fecha_inicio/fecha_fin/profesor_sustituto_id -> 400 invalid_body", () => {
    const res = resolverParametrosCreacion({
      role: "admin", miProfesorId: null, body: { profesor_sustituido_id: "profesor-b" }, hoyISO: HOY,
    });
    assert.deepEqual(res, { ok: false, code: "invalid_body" });
  });
}
