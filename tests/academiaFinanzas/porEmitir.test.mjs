import fs from "node:fs";
import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

const RAIZ = new URL("../../", import.meta.url).pathname;

// "POR EMITIR": lo que se va a cobrar este mes y todavía no tiene recibo.
//
// EL PROBLEMA (Jorge, 12/09/2026): *"las finanzas no se sincronizan con los
// datos de los alumnos, no me aparece nada"*. No era sincronización.
// "Pendientes" se construye desde `academia_recibos`, Lyceo no tiene ni un
// recibo emitido —cero, de ningún mes, comprobado en producción— y las
// cuatro tarjetas decían **"Sin alumnos con este método de pago"**.
//
// Eso es FALSO: había 13 domiciliados, 6 de Bizum, 5 en efectivo y 1 por
// transferencia, cada uno con su tarifa. Lo que no existía era el lote de
// recibos. Una pantalla de dinero que dice "no hay datos" cuando lo que
// falta es una acción tuya no es un hueco vacío: miente, y cuesta media hora
// buscando un fallo que no está.
export async function run({ test, assert }) {
  const { fetchPorEmitir } = await import("../../server/lib/academiaFinanzas/porEmitir.js");
  const { calcularTotalesFamilia } = await import("../../server/lib/academiaRecibos/totalesFamilia.js");
  const { textoPorEmitir, buildAvisoPorEmitir, buildPiePorEmitir, indicePorEmitir } = await import(
    "../../assets/academia/admin/js/sections/finanzas/ingresos/porEmitir.js"
  );

  const TENANT = "t1";

  // Fake con el encadenamiento que usan las consultas reales.
  function fakeAdmin({ familias = [], alumnos = [], tarifas = [], recibos = [], descuentos = [] } = {}) {
    const tabla = (nombre) => {
      const q = {
        _f: {},
        select() { return q; },
        eq(col, val) { q._f[col] = val; return q; },
        in(col, vals) { q._f[col] = vals; return q; },
        is(col, val) { q._f[col] = val; return q; },
        order() { return q; },
        maybeSingle() { return Promise.resolve({ data: null, error: null }); },
        then(resolve) {
          if (nombre === "academia_familias") return resolve({ data: familias, error: null });
          if (nombre === "academia_alumnos") return resolve({ data: alumnos, error: null });
          if (nombre === "academia_tarifas") return resolve({ data: tarifas, error: null });
          if (nombre === "academia_recibos") return resolve({ data: recibos, error: null });
          if (nombre === "academia_alumno_descuentos") return resolve({ data: descuentos, error: null });
          return resolve({ data: [], error: null });
        },
      };
      return q;
    };
    return { from: tabla };
  }

  // Tres familias, tres métodos de pago, un alumno cada una.
  const MUNDO = {
    familias: [
      { id: "f1", nombre: "Familia Uno", email: "u@x.es", metodo_pago: "domiciliado", activa: true },
      { id: "f2", nombre: "Familia Dos", email: "d@x.es", metodo_pago: "bizum", activa: true },
      { id: "f3", nombre: "Familia Tres", email: "t@x.es", metodo_pago: null, activa: true },
    ],
    alumnos: [
      { id: "a1", nombre: "Ana", curso: "1º ESO", familia_id: "f1", fecha_alta: "2026-09-01" },
      { id: "a2", nombre: "Luis", curso: "2º ESO", familia_id: "f2", fecha_alta: "2026-09-01" },
      { id: "a3", nombre: "Marta", curso: "3º ESO", familia_id: "f3", fecha_alta: "2026-09-01" },
    ],
    tarifas: [
      { alumno_id: "a1", precio_bruto: 100, descuento_pct: 0 },
      { alumno_id: "a2", precio_bruto: 80, descuento_pct: 25 },
      { alumno_id: "a3", precio_bruto: 50, descuento_pct: 0 },
    ],
  };

  const PERIODO = { mes: 9, anio: 2026 };

  // ── El backend ────────────────────────────────────────────────────────

  test("sin ningún recibo, TODO está por emitir, agrupado por método", async () => {
    const r = await fetchPorEmitir(fakeAdmin(MUNDO), TENANT, PERIODO);
    assert.equal(r.familias, 3);
    assert.equal(r.alumnos, 3);
    // 100 + (80 - 25%) + 50 = 100 + 60 + 50
    assert.equal(r.importe, 210);
    assert.deepEqual(
      r.grupos.map((g) => [g.metodo_pago, g.alumnos, g.importe]).sort(),
      [["bizum", 1, 60], ["domiciliado", 1, 100], [null, 1, 50]].sort()
    );
  });

  test("REGRESIÓN: el descuento de la tarifa se aplica — no se promete el bruto", async () => {
    // Si la previsión sumara `precio_bruto`, Bizum diría 80 € y el recibo
    // real cobraría 60. Una pantalla que promete más de lo que se emite es
    // peor que no tenerla.
    const r = await fetchPorEmitir(fakeAdmin(MUNDO), TENANT, PERIODO);
    assert.equal(r.grupos.find((g) => g.metodo_pago === "bizum").importe, 60);
  });

  test("una familia que YA tiene recibo este mes no está por emitir", async () => {
    const conRecibo = { ...MUNDO, recibos: [{ id: "r1", familia_id: "f1", estado: "borrador" }] };
    const r = await fetchPorEmitir(fakeAdmin(conRecibo), TENANT, PERIODO);
    assert.equal(r.familias, 2);
    assert.equal(r.importe, 110, "sin los 100 € de la que ya tiene recibo");
    assert.equal(r.grupos.some((g) => g.metodo_pago === "domiciliado"), false);
  });

  test("una familia SIN alumnos activos no cuenta, igual que en el lote", async () => {
    // `generarParaFamiliasSinRecibo` hace `if (!alumnosActivos.length) continue;`
    // — si aquí contara, la previsión anunciaría recibos que nunca se emiten.
    const sinAlumnos = { ...MUNDO, alumnos: MUNDO.alumnos.filter((a) => a.familia_id !== "f3") };
    const r = await fetchPorEmitir(fakeAdmin(sinAlumnos), TENANT, PERIODO);
    assert.equal(r.familias, 2);
    assert.equal(r.grupos.some((g) => g.metodo_pago === null), false);
  });

  test("un alumno sin tarifa entra con 0 €, no desaparece", async () => {
    // "Se me olvidó ponerle precio" tiene que verse. Si se cayera de la
    // previsión, el aviso de sin precio sería el único sitio donde aparece.
    const sinTarifa = { ...MUNDO, tarifas: MUNDO.tarifas.filter((t) => t.alumno_id !== "a1") };
    const r = await fetchPorEmitir(fakeAdmin(sinTarifa), TENANT, PERIODO);
    assert.equal(r.alumnos, 3);
    assert.equal(r.grupos.find((g) => g.metodo_pago === "domiciliado").importe, 0);
  });

  test("todo facturado: cero por emitir y ni una consulta de descuentos", async () => {
    const todos = {
      ...MUNDO,
      recibos: [
        { id: "r1", familia_id: "f1", estado: "pagado" },
        { id: "r2", familia_id: "f2", estado: "enviado" },
        { id: "r3", familia_id: "f3", estado: "borrador" },
      ],
    };
    const r = await fetchPorEmitir(fakeAdmin(todos), TENANT, PERIODO);
    assert.deepEqual(r, { grupos: [], familias: 0, alumnos: 0, importe: 0 });
  });

  // ── Que la previsión y el lote no puedan divergir ─────────────────────

  test("REGRESIÓN: el lote y la previsión usan LA MISMA función de cálculo", async () => {
    // Es el riesgo de esta pantalla: dos cálculos parecidos que se separan
    // con el primer descuento nuevo. Una pantalla que promete 2.415 € y un
    // lote que emite 2.200 € deja de mirarse la segunda vez que no cuadran.
    const generador = fs.readFileSync(`${RAIZ}server/lib/academiaRecibos/generarRecibo.js`, "utf8");
    const prevision = fs.readFileSync(`${RAIZ}server/lib/academiaFinanzas/porEmitir.js`, "utf8");
    for (const [nombre, fuente] of [["el generador", generador], ["la previsión", prevision]]) {
      assert.match(fuente, /calcularTotalesFamilia/, `${nombre} debe usarla`);
    }
    assert.equal(
      /desglosarDescuentosRecurrentes|calcularDescuento\(/.test(generador), false,
      "y el generador NO debe recalcular por su cuenta: se extrajo a totalesFamilia.js"
    );
  });

  test("el cálculo extraído da lo mismo que daba antes: bruto, descuento y neto", () => {
    const totales = calcularTotalesFamilia({
      alumnosActivos: [
        { id: "a1", precio_bruto: 100, descuento_tarifa_pct: 0, fecha_alta: "2026-09-01" },
        { id: "a2", precio_bruto: 80, descuento_tarifa_pct: 25, fecha_alta: "2026-09-01" },
      ],
      mes: 9, anio: 2026,
    });
    assert.equal(totales.totalBruto, 180);
    assert.equal(totales.totalDescuento, 20);
    assert.equal(totales.totalNeto, 160);
  });

  test("los descuentos recurrentes también, y solo si el intervalo aplica", () => {
    const alumno = { id: "a1", precio_bruto: 100, descuento_tarifa_pct: 0, fecha_alta: "2026-09-01" };
    const siempre = calcularTotalesFamilia({
      alumnosActivos: [alumno], mes: 9, anio: 2026,
      descuentosPorAlumno: { a1: [{ concepto: "Beca", porcentaje: 10, acumulable: true, intervalo: "siempre" }] },
    });
    assert.equal(siempre.totalNeto, 90);
  });

  // ── El aviso ──────────────────────────────────────────────────────────

  const POR_EMITIR = { grupos: [], familias: 3, alumnos: 4, importe: 210 };

  test("REGRESIÓN: sin recibos, el aviso dice que faltan por GENERAR, no que no haya alumnos", () => {
    const texto = textoPorEmitir({ porEmitir: POR_EMITIR, hayEmitidos: false, ...PERIODO });
    assert.match(texto, /Todavía no has generado los recibos de septiembre de 2026/);
    assert.match(texto, /4 alumnos de 3 familias, 210\.00 €/, "y cuánto es, que es la pregunta siguiente");
    assert.match(texto, /Envío a familias/, "y dónde se hace");
  });

  test("con recibos ya emitidos, el mensaje es OTRO: hay alumnos sin facturar", () => {
    // No es lo mismo "el mes está sin cerrar" que "se te ha quedado alguien
    // fuera del lote". Lo segundo es dinero que se pierde.
    const texto = textoPorEmitir({ porEmitir: POR_EMITIR, hayEmitidos: true, ...PERIODO });
    assert.match(texto, /se han quedado sin recibo/);
    assert.equal(/Todavía no has generado/.test(texto), false);
  });

  test("en singular se lee en castellano", () => {
    const texto = textoPorEmitir({
      porEmitir: { familias: 1, alumnos: 1, importe: 55 }, hayEmitidos: true, ...PERIODO,
    });
    assert.match(texto, /1 familia se ha quedado sin recibo/);
    assert.match(texto, /1 alumno de 1 familia/);
  });

  test("sin nada por emitir NO hay aviso: el mes está cerrado y punto", () => {
    assert.equal(textoPorEmitir({ porEmitir: { familias: 0 }, hayEmitidos: true, ...PERIODO }), "");
    assert.equal(buildAvisoPorEmitir({ porEmitir: { familias: 0 }, hayEmitidos: true, ...PERIODO }), null);
  });

  test("el aviso de 'falta alguien' se pinta distinto del informativo", () => {
    const normal = buildAvisoPorEmitir({ porEmitir: POR_EMITIR, hayEmitidos: false, ...PERIODO });
    const alerta = buildAvisoPorEmitir({ porEmitir: POR_EMITIR, hayEmitidos: true, ...PERIODO });
    assert.equal(normal.classList.contains("ac-aviso-mes--alerta"), false);
    assert.ok(alerta.classList.contains("ac-aviso-mes--alerta"));
  });

  // ── El pie de cada tarjeta ────────────────────────────────────────────

  test("el pie dice alumnos e importe, con su rótulo", () => {
    const pie = buildPiePorEmitir({ metodo_pago: "domiciliado", familias: 5, alumnos: 13, importe: 1280 });
    assert.equal(pie.querySelector(".ac-pago-poremitir-rotulo").textContent, "Por emitir");
    assert.match(pie.textContent, /13 alumnos · 1280\.00 €/);
  });

  test("sin alumnos por emitir no hay pie", () => {
    assert.equal(buildPiePorEmitir({ metodo_pago: "bizum", alumnos: 0, importe: 0 }), null);
    assert.equal(buildPiePorEmitir(null), null);
  });

  test("el índice encuentra el grupo de cada método, incluido el null", () => {
    const idx = indicePorEmitir({ grupos: [{ metodo_pago: "bizum", alumnos: 2 }, { metodo_pago: null, alumnos: 1 }] });
    assert.equal(idx.get("bizum").alumnos, 2);
    assert.equal(idx.get(null).alumnos, 1);
    assert.equal(idx.get("efectivo"), undefined);
  });

  // ── Que llegue a la pantalla ──────────────────────────────────────────

  test("REGRESIÓN: la tarjeta vacía ya NO dice 'sin alumnos' si hay por emitir", () => {
    // El mensaje exacto que hizo pensar que las finanzas no se sincronizaban.
    const vista = fs.readFileSync(
      `${RAIZ}assets/academia/admin/js/sections/finanzas/ingresos/vistaPendientes.js`, "utf8"
    );
    assert.match(vista, /if \(piePorEmitir\) \{\s*\n\s*panel\.appendChild\(piePorEmitir\);/);
    assert.match(vista, /buildAvisoPorEmitir/, "y el aviso se pinta arriba");
    assert.match(
      vista, /hayEmitidos: grupos\.some\(\(g\) => g\.alumnos\?\.length\)/,
      "distinguiendo mes sin cerrar de familia olvidada"
    );
  });

  test("REGRESIÓN: el cliente lee `por_emitir` de la respuesta", () => {
    // Si el cliente se quedara con `data.grupos` como antes, el backend
    // calcularía la previsión y nadie la vería.
    const api = fs.readFileSync(`${RAIZ}assets/academia/admin/js/apiFinanzas.js`, "utf8");
    const fn = api.slice(api.indexOf("export async function fetchPendientesIngresos"));
    assert.match(fn.slice(0, 600), /porEmitir: data\.por_emitir/);
  });

  test("REGRESIÓN: la ruta devuelve las dos cosas separadas", () => {
    // Mezclar "cobrado" y "se va a cobrar" en una sola cifra es el error que
    // no se puede cometer en una pantalla de dinero.
    const ruta = fs.readFileSync(`${RAIZ}server/routes/v1/academia-finanzas/ingresos.routes.js`, "utf8");
    assert.match(ruta, /por_emitir: \{ grupos: porEmitirGrupos/);
    assert.match(ruta, /fetchPorEmitir/);
  });
}
