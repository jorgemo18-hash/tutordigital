// LAS LLAMADAS DE RECURSOS (js/recursos/apiRecursos.js): el prefijo de
// Recursos, y una sesión caducada lleva al login.
export async function run({ test, assert }) {
  const { crearApiDeRecursos, crearCallJson, BASE_HOJAS } = await import("../../../assets/teacher/js/recursos/apiRecursos.js");

  test("el generador se pide a /api/v1/recursos/hojas (profesor y admin), no a la ruta de la academia", async () => {
    const vistas = [];
    const api = crearApiDeRecursos({
      apiFetchFn: async (ruta, op) => { vistas.push([ruta, op]); return { status: 200, ok: true, json: async () => ({ data: { ok: 1 } }) }; },
    });
    assert.deepEqual(await api.catalogo(), { ok: 1 });
    await api.generar({ temaId: "t", objetivo: 1, intensidad: "normal" });
    assert.equal(BASE_HOJAS, "/api/v1/recursos/hojas");
    assert.equal(vistas[0][0], "/api/v1/recursos/hojas/catalogo");
    assert.equal(vistas[1][0], "/api/v1/recursos/hojas/generar");
    assert.deepEqual(JSON.parse(vistas[1][1].body), { temaId: "t", objetivo: 1, intensidad: "normal" });
  });

  test("401: se cierra la sesión y se va al login; otro error se lanza con su mensaje", async () => {
    let cerrada = false;
    const win = { location: { href: "" } };
    const callJson = crearCallJson({
      apiFetchFn: async () => ({ status: 401, ok: false, json: async () => ({}) }),
      clearSessionFn: () => { cerrada = true; },
      win,
    });
    await assert.rejects(callJson("/x"));
    assert.equal(cerrada, true);
    assert.equal(win.location.href, "/login");
    const otro = crearCallJson({ apiFetchFn: async () => ({ status: 403, ok: false, json: async () => ({ error: { message: "No" } }) }) });
    await assert.rejects(otro("/x"), /No/);
  });
}
