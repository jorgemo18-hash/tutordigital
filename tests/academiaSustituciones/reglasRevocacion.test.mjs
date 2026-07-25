export async function run({ test, assert }) {
  const { puedeRevocar } = await import("../../server/lib/academiaSustituciones/reglasRevocacion.js");

  const MI_PROFESOR_ID = "profesor-yo";
  const OTRO_PROFESOR_ID = "profesor-otro";

  test("admin -> siempre puede, sea cual sea el origen o el sustituto", () => {
    const res = puedeRevocar({
      role: "admin", profesorId: null,
      sustitucion: { profesor_sustituto_id: OTRO_PROFESOR_ID, origen: "admin" },
    });
    assert.deepEqual(res, { ok: true });
  });

  test("profesor: su propia sustitución autodeclarada -> ok", () => {
    const res = puedeRevocar({
      role: "teacher", profesorId: MI_PROFESOR_ID,
      sustitucion: { profesor_sustituto_id: MI_PROFESOR_ID, origen: "autodeclarada" },
    });
    assert.deepEqual(res, { ok: true });
  });

  test("profesor: su propia sustitución pero de origen='admin' -> 403 solo_autodeclaradas", () => {
    const res = puedeRevocar({
      role: "teacher", profesorId: MI_PROFESOR_ID,
      sustitucion: { profesor_sustituto_id: MI_PROFESOR_ID, origen: "admin" },
    });
    assert.deepEqual(res, { ok: false, code: "solo_autodeclaradas" });
  });

  test("profesor: sustitución de OTRO profesor, aunque sea autodeclarada -> 403 no_es_tu_sustitucion", () => {
    const res = puedeRevocar({
      role: "teacher", profesorId: MI_PROFESOR_ID,
      sustitucion: { profesor_sustituto_id: OTRO_PROFESOR_ID, origen: "autodeclarada" },
    });
    assert.deepEqual(res, { ok: false, code: "no_es_tu_sustitucion" });
  });

  test("profesor: sustitución donde es el SUSTITUIDO (no el sustituto) -> 403 no_es_tu_sustitucion", () => {
    // profesor_sustituto_id sigue siendo otro — ser el cubierto no da derecho a revocar
    const res = puedeRevocar({
      role: "teacher", profesorId: MI_PROFESOR_ID,
      sustitucion: { profesor_sustituto_id: OTRO_PROFESOR_ID, profesor_sustituido_id: MI_PROFESOR_ID, origen: "autodeclarada" },
    });
    assert.deepEqual(res, { ok: false, code: "no_es_tu_sustitucion" });
  });
}
