import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// EL AVISO "SIN RECIBO" SE PULSA Y ENSEÑA QUIÉNES.
//
// Jorge, 24/09/2026: *"sale un aviso de que tantos se han quedado sin
// recibo, ese aviso que sea clicable y que se abra un drawer lateral con las
// familias que están sin recibo"*. El aviso decía cuántas y cuánto, pero no
// quiénes, que es lo que hace falta para arreglarlo.
//
// Datos inventados: ninguna familia real.
export async function run({ test, assert }) {
  const { fetchPorEmitir } = await import("../../server/lib/academiaFinanzas/porEmitir.js");
  const { buildAvisoPorEmitir } = await import(
    "../../assets/academia/admin/js/sections/finanzas/ingresos/porEmitir.js"
  );
  const { abrirDrawerSinRecibo } = await import(
    "../../assets/academia/admin/js/sections/finanzas/ingresos/drawerSinRecibo.js"
  );
  const { renderVistaPendientes } = await import(
    "../../assets/academia/admin/js/sections/finanzas/ingresos/vistaPendientes.js"
  );
  const { metodoPagoLabel } = await import("../../assets/academia/admin/js/drawer/familia/familiaFields.js");

  function fakeAdmin(datos) {
    const tablas = {
      academia_familias: datos.familias || [], academia_alumnos: datos.alumnos || [],
      academia_tarifas: datos.tarifas || [], academia_recibos: datos.recibos || [],
      academia_alumno_descuentos: [],
    };
    const tabla = (nombre) => {
      const q = {
        select() { return q; }, eq() { return q; }, in() { return q; }, is() { return q; }, order() { return q; },
        maybeSingle() { return Promise.resolve({ data: null, error: null }); },
        then(resolve) { return resolve({ data: tablas[nombre] || [], error: null }); },
      };
      return q;
    };
    return { from: tabla };
  }

  const MUNDO = {
    familias: [
      { id: "f1", nombre: "Pardo Ruiz", email: "p@x.es", metodo_pago: "domiciliado", activa: true },
      { id: "f2", nombre: "Abad Soler", email: "a@x.es", metodo_pago: null, activa: true },
      { id: "f3", nombre: "Ferrer Gil", email: "f@x.es", metodo_pago: "bizum", activa: true },
    ],
    alumnos: [
      { id: "a1", nombre: "Nora", curso: "1º ESO", familia_id: "f1", fecha_alta: "2026-09-01" },
      { id: "a2", nombre: "Hugo", curso: "3º ESO", familia_id: "f1", fecha_alta: "2026-09-01" },
      { id: "a3", nombre: "Leo", curso: "2º ESO", familia_id: "f2", fecha_alta: "2026-09-20" },
      { id: "a4", nombre: "Vera", curso: "4º ESO", familia_id: "f3", fecha_alta: "2026-09-01" },
    ],
    tarifas: [
      { alumno_id: "a1", precio_bruto: 100, descuento_pct: 0 },
      { alumno_id: "a2", precio_bruto: 80, descuento_pct: 25 },
      { alumno_id: "a3", precio_bruto: 50, descuento_pct: 0 },
      { alumno_id: "a4", precio_bruto: 70, descuento_pct: 0 },
    ],
    // f3 ya tiene su recibo de septiembre: no está "sin recibo".
    recibos: [{ id: "r1", familia_id: "f3", estado: "enviado" }],
  };
  const PERIODO = { mes: 9, anio: 2026 };

  test("el backend dice QUIÉNES, no solo cuántas: nombre, pago, alumnos e importe", async () => {
    const r = await fetchPorEmitir(fakeAdmin(MUNDO), "t1", PERIODO);
    assert.equal(r.familias, 2);
    const porId = Object.fromEntries(r.detalle.map((d) => [d.familia_id, d]));
    assert.deepEqual(Object.keys(porId).sort(), ["f1", "f2"], "la que ya tiene recibo no sale");
    assert.deepEqual(porId.f1, {
      familia_id: "f1", nombre: "Pardo Ruiz", metodo_pago: "domiciliado", alumnos: ["Hugo", "Nora"], importe: 160,
    });
    assert.equal(porId.f2.metodo_pago, null);
    // La lista suma lo mismo que el total del aviso: no es otro cálculo.
    assert.equal(r.detalle.reduce((s, d) => s + d.importe, 0), r.importe);
  });

  const DETALLE = [
    { familia_id: "f1", nombre: "Pardo Ruiz", metodo_pago: "domiciliado", alumnos: ["Hugo", "Nora"], importe: 160 },
    { familia_id: "f2", nombre: "Abad Soler", metodo_pago: null, alumnos: ["Leo"], importe: 50 },
  ];
  const POR_EMITIR = { grupos: [], familias: 2, alumnos: 3, importe: 210, detalle: DETALLE };

  test("REGRESIÓN: el aviso es un botón y al pulsarlo entrega la lista", () => {
    let recibido = null;
    const aviso = buildAvisoPorEmitir({ porEmitir: POR_EMITIR, hayEmitidos: true, ...PERIODO, onAbrir: (d) => { recibido = d; } });
    assert.equal(aviso.tagName, "BUTTON");
    assert.ok(aviso.classList.contains("ac-aviso-mes--alerta"), "sigue pintado como alerta");
    assert.match(aviso.textContent, /2 familias se han quedado sin recibo/);
    assert.match(aviso.textContent, /Ver las familias/);
    aviso.click();
    assert.equal(recibido, DETALLE);
  });

  test("sin lista (o sin quien la abra) sigue siendo un párrafo: nada de botones que no abren nada", () => {
    const sinLista = buildAvisoPorEmitir({ porEmitir: { ...POR_EMITIR, detalle: [] }, hayEmitidos: true, ...PERIODO, onAbrir: () => {} });
    const sinHandler = buildAvisoPorEmitir({ porEmitir: POR_EMITIR, hayEmitidos: true, ...PERIODO });
    assert.equal(sinLista.tagName, "P");
    assert.equal(sinHandler.tagName, "P");
  });

  test("el drawer lista las familias por nombre, con pago, alumnos, importe y total", () => {
    const root = document.createElement("div");
    const { el, cerrar } = abrirDrawerSinRecibo({ detalle: DETALLE, periodo: "septiembre de 2026", root });
    assert.equal(el.querySelector(".ac-drawer-title").textContent, "Sin recibo de septiembre de 2026");
    const filas = [...el.querySelectorAll(".ac-sinrecibo-fila")];
    assert.deepEqual(filas.map((f) => f.querySelector(".ac-sinrecibo-nombre").textContent), ["Abad Soler", "Pardo Ruiz"]);
    assert.equal(filas[0].querySelector(".ac-sinrecibo-metodo").textContent, "Sin forma de pago");
    assert.equal(filas[1].querySelector(".ac-sinrecibo-metodo").textContent, metodoPagoLabel("domiciliado"));
    assert.equal(filas[1].querySelector(".ac-sinrecibo-alumnos").textContent, "Hugo, Nora");
    assert.match(filas[1].querySelector(".ac-sinrecibo-importe").textContent, /160,00/);
    assert.match(el.querySelector(".ac-sinrecibo-resumen").textContent, /2 familias · 210,00/);
    cerrar();
    assert.equal(root.children.length, 0, "al cerrarse desaparece: no se queda la lista de otro mes");
  });

  test("se cierra con Escape y pinchando fuera", () => {
    const root = document.createElement("div");
    abrirDrawerSinRecibo({ detalle: DETALLE, periodo: "septiembre de 2026", root });
    document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" }));
    assert.equal(root.children.length, 0);
    const { el } = abrirDrawerSinRecibo({ detalle: DETALLE, periodo: "septiembre de 2026", root });
    el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert.equal(root.children.length, 0);
  });

  test("REGRESIÓN: en la pantalla de Pendientes, pulsar el aviso abre el drawer", async () => {
    const cont = document.createElement("div");
    const grupos = [{ metodo_pago: "bizum", alumnos: [{ recibo_id: "r1", alumno_nombre: "Vera", cuota: 70, estado: "enviado" }] }];
    renderVistaPendientes(cont, { fetchPendientes: async () => ({ grupos, porEmitir: POR_EMITIR }) });
    await new Promise((r) => setTimeout(r, 0));
    const aviso = cont.querySelector("button.ac-aviso-mes");
    assert.ok(aviso, "el aviso es pulsable");
    aviso.click();
    const drawer = document.body.querySelector(".ac-drawer-sinrecibo");
    assert.ok(drawer, "se abre el drawer");
    assert.equal(drawer.querySelectorAll(".ac-sinrecibo-fila").length, 2);
    drawer.querySelector(".ac-drawer-close").click();
    assert.equal(document.body.querySelector(".ac-drawer-sinrecibo"), null);
  });
}
