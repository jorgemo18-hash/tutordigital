// LA HOJA SE PREPARA UNA VEZ: el segundo alumno no paga otro análisis y
// recibe los mismos ejercicios y los mismos pasos.
//
// Una base de datos y un almacenamiento de mentira, en memoria, y una guía de
// mentira que cuenta cuántas veces la llaman.
export async function run({ test, assert }) {
  const { analizarConFicha, pasosDelEjercicio } = await import("../../server/lib/orchestrator/analisisConFicha.js");
  const { huellaDeLaTarea, leerFicha } = await import("../../server/lib/orchestrator/fichaDeLaTarea.js");

  function mundo({ archivos = { "t1/hoja.pdf": "PDF-HOJA-1", "t2/hoja.pdf": "PDF-HOJA-1", "t3/otra.pdf": "PDF-OTRA" }, fallaLaTabla = false } = {}) {
    const filas = [];
    const admin = {
      storage: { from: () => ({ download: async (ruta) => (archivos[ruta] == null
        ? { data: null, error: { message: "no existe" } }
        : { data: { arrayBuffer: async () => new TextEncoder().encode(archivos[ruta]).buffer }, error: null }) }) },
      from: () => {
        if (fallaLaTabla) throw new Error("relation tutor_fichas does not exist");
        const filtro = {};
        const q = {
          select: () => q,
          eq: (c, v) => { filtro[c] = v; return q; },
          maybeSingle: async () => ({ data: filas.find((f) => f.tenant_id === filtro.tenant_id && f.huella === filtro.huella) || null, error: null }),
          upsert: async (fila) => { if (!filas.some((f) => f.tenant_id === fila.tenant_id && f.huella === fila.huella)) filas.push({ ...fila }); return { error: null }; },
          update: (cambios) => { q._cambios = cambios; return q; },
          then: (ok) => { const f = filas.find((x) => x.tenant_id === filtro.tenant_id && x.huella === filtro.huella); if (f && q._cambios) Object.assign(f, q._cambios); ok({ error: null }); },
        };
        return q;
      },
    };
    return { admin, filas };
  }

  function guia({ ejercicios = [{ index: 1, title: "Ecuación" }], detectOk = true } = {}) {
    const llamadas = { analizar: 0, pasos: 0 };
    return {
      llamadas,
      analizar: async () => {
        llamadas.analizar += 1;
        const varios = ejercicios.length > 1;
        return { exercises: ejercicios, documentText: "2x + 5 = 9", needsChoice: varios,
          steps: varios ? [] : [{ index: 0, title: `Pasos versión ${llamadas.analizar}`, completed: false }],
          guideOk: varios ? null : true, detectOk, usageEvents: [{ source: "guide_detect" }] };
      },
      generarPasos: async ({ exerciseIndex }) => {
        llamadas.pasos += 1;
        return { ok: true, steps: [{ index: 0, title: `Ej ${exerciseIndex}, versión ${llamadas.pasos}`, completed: false }], model: "m", usage: { input_tokens: 1 } };
      },
    };
  }

  const tarea = (ruta, extra = {}) => ({ title: "Deberes", description: "", teacherNotes: "", attachments: [{ storage_path: ruta, role: "statement" }], ...extra });

  test("REGRESIÓN: dos alumnos con la misma hoja → un solo análisis, los mismos pasos", async () => {
    const { admin } = mundo();
    const g = guia();
    const a = await analizarConFicha({ admin, tenantId: "c1", taskContext: tarea("t1/hoja.pdf") }, g);
    const b = await analizarConFicha({ admin, tenantId: "c1", taskContext: tarea("t1/hoja.pdf") }, g);
    assert.equal(g.llamadas.analizar, 1);
    assert.deepEqual(b.steps, a.steps);
    assert.deepEqual(b.exercises, a.exercises);
    assert.equal(b.deFicha, true);
    assert.deepEqual(b.usageEvents, [], "el segundo no gasta tokens");
  });

  test("la misma hoja subida a otra tarea (otra ruta, mismos bytes) también se reutiliza", async () => {
    const { admin } = mundo();
    const g = guia();
    await analizarConFicha({ admin, tenantId: "c1", taskContext: tarea("t1/hoja.pdf") }, g);
    await analizarConFicha({ admin, tenantId: "c1", taskContext: tarea("t2/hoja.pdf") }, g);
    assert.equal(g.llamadas.analizar, 1);
  });

  test("otra hoja, otras notas del profesor u otro centro → se analiza aparte", async () => {
    const { admin } = mundo();
    const g = guia();
    await analizarConFicha({ admin, tenantId: "c1", taskContext: tarea("t1/hoja.pdf") }, g);
    await analizarConFicha({ admin, tenantId: "c1", taskContext: tarea("t3/otra.pdf") }, g);
    await analizarConFicha({ admin, tenantId: "c1", taskContext: tarea("t1/hoja.pdf", { teacherNotes: "Solo el método de la balanza" }) }, g);
    await analizarConFicha({ admin, tenantId: "c2", taskContext: tarea("t1/hoja.pdf") }, g);
    assert.equal(g.llamadas.analizar, 4);
  });

  test("varios ejercicios: los pasos de cada uno se generan una vez y se reparten", async () => {
    const { admin } = mundo();
    const g = guia({ ejercicios: [{ index: 1, title: "Uno" }, { index: 2, title: "Dos" }] });
    const ctx = tarea("t1/hoja.pdf");
    const r = await analizarConFicha({ admin, tenantId: "c1", taskContext: ctx }, g);
    assert.equal(r.needsChoice, true);
    const huella = await huellaDeLaTarea(admin, ctx);
    const elige = async () => pasosDelEjercicio({ admin, tenantId: "c1", huella, ficha: await leerFicha(admin, { tenantId: "c1", huella }), taskContext: ctx, exerciseIndex: 2, exerciseTitle: "Dos" }, g);
    const primero = await elige();
    const segundo = await elige();
    assert.equal(g.llamadas.pasos, 1);
    assert.deepEqual(segundo.steps, primero.steps);
    assert.equal(segundo.deFicha, true);
    const otroAlumno = await analizarConFicha({ admin, tenantId: "c1", taskContext: ctx }, g);
    assert.equal(otroAlumno.needsChoice, true);
    assert.equal(g.llamadas.analizar, 1);
  });

  test("una detección fallida NO se guarda: el siguiente alumno lo vuelve a intentar", async () => {
    const { admin, filas } = mundo();
    const g = guia({ detectOk: false });
    await analizarConFicha({ admin, tenantId: "c1", taskContext: tarea("t1/hoja.pdf") }, g);
    await analizarConFicha({ admin, tenantId: "c1", taskContext: tarea("t1/hoja.pdf") }, g);
    assert.equal(filas.length, 0);
    assert.equal(g.llamadas.analizar, 2);
  });

  test("si no se puede bajar el archivo o falla la tabla, se analiza como siempre (nunca sin tutor)", async () => {
    const sinArchivo = mundo({ archivos: {} });
    const g1 = guia();
    const r1 = await analizarConFicha({ admin: sinArchivo.admin, tenantId: "c1", taskContext: tarea("t1/hoja.pdf") }, g1);
    assert.equal(g1.llamadas.analizar, 1);
    assert.equal(r1.guideOk, true);
    const sinTabla = mundo({ fallaLaTabla: true });
    const g2 = guia();
    const r2 = await analizarConFicha({ admin: sinTabla.admin, tenantId: "c1", taskContext: tarea("t1/hoja.pdf") }, g2);
    assert.equal(r2.guideOk, true);
    assert.equal(g2.llamadas.analizar, 1);
  });

  test("huella: sin archivos no hay huella; los bytes mandan, no el nombre", async () => {
    const { admin } = mundo();
    assert.equal(await huellaDeLaTarea(admin, { attachments: [] }), null);
    assert.equal(await huellaDeLaTarea(admin, tarea("t1/hoja.pdf")), await huellaDeLaTarea(admin, tarea("t2/hoja.pdf")));
    assert.notEqual(await huellaDeLaTarea(admin, tarea("t1/hoja.pdf")), await huellaDeLaTarea(admin, tarea("t3/otra.pdf")));
  });
}
