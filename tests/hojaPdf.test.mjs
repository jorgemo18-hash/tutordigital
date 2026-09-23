// LA HOJA EN PDF (server/lib/hojaPdf/ y api/hoja-pdf.js).
// Aquí no se lanza Chromium: el navegador y la red son falsos. El PDF de
// verdad se comprueba con tests/manual/imprimePdfDelPanel.mjs.
export async function run({ test, assert }) {
  const { autorizaAdmin } = await import("../server/lib/hojaPdf/autorizaAdmin.js");
  const { imprimeHojaEnPdf } = await import("../server/lib/hojaPdf/imprimeHojaEnPdf.js");
  const { default: handler } = await import("../api/hoja-pdf.js");

  test("autoriza DELEGANDO en la API: mismas cabeceras, y solo con 200 es admin", async () => {
    const vistas = [];
    const fetchFn = async (url, opts) => { vistas.push([url, opts.headers]); return { ok: true, status: 200 }; };
    const r = await autorizaAdmin({ cabeceras: { authorization: "Bearer t", "x-ttd-tenant": "lyceo" }, apiBase: "https://api", fetchFn });
    assert.deepEqual(r, { ok: true });
    assert.equal(vistas[0][0], "https://api/api/v1/academia/hojas-ejercicios/catalogo");
    assert.deepEqual(vistas[0][1], { Authorization: "Bearer t", "x-ttd-tenant": "lyceo" });
  });

  test("sin sesión o sin centro, ni se pregunta; un no de la API es un no", async () => {
    let llamadas = 0;
    const fetchFn = async () => { llamadas += 1; return { ok: false, status: 403 }; };
    assert.deepEqual(await autorizaAdmin({ cabeceras: {}, apiBase: "x", fetchFn }), { ok: false, status: 401 });
    assert.equal(llamadas, 0);
    assert.deepEqual(await autorizaAdmin({ cabeceras: { authorization: "B", "x-ttd-tenant": "c" }, apiBase: "x", fetchFn }), { ok: false, status: 403 });
    const caida = await autorizaAdmin({ cabeceras: { authorization: "B", "x-ttd-tenant": "c" }, apiBase: "x", fetchFn: async () => { throw new Error("red"); } });
    assert.deepEqual(caida, { ok: false, status: 503 });
  });

  test("imprime la página de la hoja con el @page del CSS y cierra la pestaña", async () => {
    const pasos = [];
    const pagina = {
      goto: async (url) => pasos.push(["goto", url]),
      waitForFunction: async () => pasos.push(["espera"]),
      evaluate: async (fn, arg) => { pasos.push(["evalua", arg ? "con-hoja" : "sin"]); return 2; },
      pdf: async (opts) => { pasos.push(["pdf", opts]); return new Uint8Array([37, 80, 68, 70]); },
      close: async () => pasos.push(["cierra"]),
    };
    const { pdf, folios } = await imprimeHojaEnPdf({ navegador: { newPage: async () => pagina }, urlPagina: "u", hoja: { actividades: [] } });
    assert.equal(pdf.toString(), "%PDF");
    assert.equal(folios, 2);
    assert.deepEqual(pasos.find((p) => p[0] === "pdf")[1], { preferCSSPageSize: true, printBackground: true });
    assert.equal(pasos.at(-1)[0], "cierra");
  });

  function respuesta() {
    const r = { estado: 0, cuerpo: null };
    r.status = (s) => { r.estado = s; return r; };
    r.json = (c) => { r.cuerpo = c; return r; };
    r.send = (c) => { r.cuerpo = c; return r; };
    r.setHeader = () => {};
    return r;
  }

  test("la función: solo POST, solo admin, y con una hoja de verdad y no enorme", async () => {
    const fetchOriginal = globalThis.fetch;
    try {
      let r = respuesta();
      await handler({ method: "GET", headers: {} }, r);
      assert.equal(r.estado, 405);
      r = respuesta();
      await handler({ method: "POST", headers: {}, body: {} }, r);
      assert.equal(r.estado, 401);
      globalThis.fetch = async () => ({ ok: true, status: 200 });
      const cab = { authorization: "B", "x-ttd-tenant": "c" };
      r = respuesta();
      await handler({ method: "POST", headers: cab, body: {} }, r);
      assert.equal(r.estado, 400);
      r = respuesta();
      await handler({ method: "POST", headers: cab, body: { hoja: { actividades: [{ enunciado: "x".repeat(400000) }] } } }, r);
      assert.equal(r.estado, 413);
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  });
}
