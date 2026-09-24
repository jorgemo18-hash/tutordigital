import fs from "node:fs";
import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

const RAIZ = new URL("../../", import.meta.url).pathname;

// "REGENERAR" YA NO BORRA LO ENVIADO NI LO PAGADO SIN PREGUNTAR QUÉ.
//
// Jorge, 24/09/2026: con el aviso de Finanzas "N familias sin recibo"
// delante, le dio a Regenerar para que salieran. Regenerar borró los 28
// recibos del mes y los rehízo: se perdieron las marcas de pago y de envío.
// Había un "¿Continuar con todos?", y no sirvió. Pidió: *"que cuando des te
// diga todos o solo los que no están creados o no tocar los que ya estén
// enviados"*. Datos inventados.
export async function run({ test, assert }) {
  const { planDeRegenerar, previoParaHeredar, MODO_POR_DEFECTO } = await import(
    "../../server/lib/academiaRecibos/modosDeRegenerar.js"
  );
  const { generarReciboParaFamilia } = await import("../../server/lib/academiaRecibos/generarRecibo.js");
  const { opcionesRegenerarRecibos } = await import(
    "../../assets/academia/admin/js/sections/envioFamilias/acciones/opcionesAccion.js"
  );
  const { regenerarLote, mensajeConfirmacionRecibosTodos } = await import(
    "../../assets/academia/admin/js/sections/envioFamilias/acciones/accionesLote.js"
  );
  const { buildCabecera } = await import("../../assets/academia/admin/js/sections/envioFamilias/cabecera.js");
  const { resumenDeRecibos } = await import(
    "../../assets/academia/admin/js/sections/envioFamilias/acciones/resumenDeRecibos.js"
  );

  const PREVIOS = [
    { id: "r1", familia_id: "f1", estado: "borrador" },
    { id: "r2", familia_id: "f2", estado: "enviado" },
    { id: "r3", familia_id: "f3", estado: "pagado", fecha_pago: "2026-09-10", numero_recibo: "2026-003", descuento_puntual_pct: 50 },
  ];

  // ── El servidor ───────────────────────────────────────────────────────

  test("REGRESIÓN: 'crear los que faltan' no borra NINGÚN recibo", () => {
    const plan = planDeRegenerar(PREVIOS, "faltan");
    assert.deepEqual(plan.aBorrar, []);
    assert.equal(plan.requiereConfirmacion, false);
  });

  test("REGRESIÓN: 'borradores' solo rehace los borradores; enviados y pagados intactos", () => {
    assert.deepEqual(planDeRegenerar(PREVIOS, "borradores").aBorrar.map((r) => r.id), ["r1"]);
  });

  test("REGRESIÓN: sin modo (un cliente antiguo) NO se borra lo enviado", () => {
    assert.equal(MODO_POR_DEFECTO, "borradores");
    assert.deepEqual(planDeRegenerar(PREVIOS).aBorrar.map((r) => r.id), ["r1"]);
    // ...aunque mande confirmar:true, que es lo que mandaba el botón viejo.
    assert.deepEqual(planDeRegenerar(PREVIOS, undefined, { confirmar: true }).aBorrar.map((r) => r.id), ["r1"]);
  });

  test("'todos' exige confirmar y dice cuántos enviados y cuántos pagados", () => {
    const sin = planDeRegenerar(PREVIOS, "todos");
    assert.equal(sin.requiereConfirmacion, true);
    assert.deepEqual(sin.aBorrar, []);
    assert.deepEqual([sin.afectados, sin.enviados, sin.pagados], [2, 1, 1]);
    assert.equal(planDeRegenerar(PREVIOS, "todos", { confirmar: true }).aBorrar.length, 3);
  });

  test("REGRESIÓN: un recibo pagado que se rehace NACE PAGADO, con su fecha, número y descuento", async () => {
    const heredado = previoParaHeredar(PREVIOS[2]);
    assert.deepEqual(heredado, {
      numero_recibo: "2026-003", descuento_puntual_pct: 50, descuento_puntual_nota: undefined,
      fecha_pago: "2026-09-10", pagado: true,
    });
    assert.equal(previoParaHeredar(PREVIOS[1]).pagado, false, "un enviado vuelve a borrador: la familia tiene otra versión");

    const insertados = [];
    const admin = {
      from: () => ({
        insert(fila) {
          insertados.push(fila);
          const q = { select: () => q, single: async () => ({ data: { id: "nuevo" }, error: null }), then: (r) => r({ error: null }) };
          return q;
        },
      }),
    };
    await generarReciboParaFamilia(admin, {
      tenantId: "t", familiaId: "f3", mes: 9, anio: 2026, concepto: "Septiembre",
      alumnosActivos: [{ id: "a", nombre: "Leo", curso: "1º ESO", precio_bruto: 100 }],
      numeroReciboPrevio: heredado.numero_recibo, descuentoPuntualPct: 50,
      pagadoPrevio: heredado.pagado, fechaPagoPrevia: heredado.fecha_pago,
    });
    assert.equal(insertados[0].estado, "pagado");
    assert.equal(insertados[0].fecha_pago, "2026-09-10");
  });

  test("REGRESIÓN: la ruta decide con el plan, no borrando todo lo que encuentra", () => {
    const ruta = fs.readFileSync(`${RAIZ}server/routes/v1/academia-recibos/generar.routes.js`, "utf8");
    const bloque = ruta.slice(ruta.indexOf('app.post("/regenerar"'), ruta.indexOf('app.post("/:id/regenerar"'));
    assert.match(bloque, /planDeRegenerar\(/);
    assert.match(bloque, /for \(const recibo of plan\.aBorrar\)/);
    assert.equal(/for \(const recibo of previos\)/.test(bloque), false);
  });

  // ── La pantalla ───────────────────────────────────────────────────────

  test("la primera opción (la de por defecto) es la que no toca nada, y cada una dice qué pasa", () => {
    const ops = opcionesRegenerarRecibos({ sinRecibo: 5, borradores: 2, enviados: 20, pagados: 8 });
    assert.deepEqual(ops.map((o) => o.modo), ["faltan", "borradores", "todos"]);
    assert.match(ops[0].detalle, /5 familias sin recibo\. No toca ninguno/);
    assert.match(ops[1].detalle, /Los 28 enviados o pagados no se tocan/);
    assert.ok(ops[2].peligro);
    assert.match(ops[2].detalle, /20 enviados vuelven a «Sin enviar».*8 pagados siguen marcados como pagados/);
    assert.match(opcionesRegenerarRecibos({ sinRecibo: 1 })[1].detalle, /No hay borradores que rehacer/);
  });

  test("el resumen cuenta cada estado", () => {
    const r = resumenDeRecibos([{ recibo: null }, { recibo: { estado: "borrador" } }, { recibo: { estado: "enviado" } }, { recibo: { estado: "pagado" } }, { recibo: { estado: "pagado" } }]);
    assert.deepEqual(r, { sinRecibo: 1, borradores: 1, enviados: 1, pagados: 2 });
  });

  function fakes() {
    const llamadas = { regenerar: [], generar: [], informes: [] };
    return {
      llamadas,
      regenerarRecibosFn: async (a) => { llamadas.regenerar.push(a); return { fallidos: 0 }; },
      generarRecibosFn: async (a) => { llamadas.generar.push(a); return { fallidos: 0 }; },
      regenerarInformesFn: async (a) => { llamadas.informes.push(a); return { fallidos: 0 }; },
    };
  }

  test("REGRESIÓN: 'crear los que faltan' solo llama a GENERAR, nunca a regenerar", async () => {
    const f = fakes();
    await regenerarLote("solo_recibo", { mes: 9, anio: 2026, hayRecibosEnPeriodo: true, modo: "faltan", ...f });
    assert.equal(f.llamadas.generar.length, 1);
    assert.equal(f.llamadas.regenerar.length, 0);
  });

  test("el modo elegido viaja al servidor", async () => {
    const f = fakes();
    await regenerarLote("solo_recibo", { mes: 9, anio: 2026, hayRecibosEnPeriodo: true, modo: "borradores", ...f });
    assert.equal(f.llamadas.regenerar[0].modo, "borradores");
  });

  test("el aviso de 'todos' separa enviados y pagados y ofrece la salida segura", () => {
    const m = mensajeConfirmacionRecibosTodos({ afectados: 28, enviados: 20, pagados: 8 });
    assert.match(m, /20 enviado\(s\) volverán a «Sin enviar»/);
    assert.match(m, /8 pagado\(s\) se rehacen pero siguen marcados como pagados/);
    assert.match(m, /Crear solo los que faltan/);
  });

  test("REGRESIÓN: el botón Regenerar pregunta QUÉ recibos antes de hacer nada", async () => {
    const titulos = [];
    let recibido = null;
    const cab = buildCabecera({
      mes: 9, anio: 2026, mesesEnviados: [], anioActualSistema: 2026, hayPendientes: false,
      resumenRecibos: { sinRecibo: 5, borradores: 0, enviados: 20, pagados: 8 },
      onCambiarPeriodo: () => {}, onEnviar: async () => ({}),
      onRegenerar: async (tipo, modo) => { recibido = { tipo, modo }; return {}; },
      elegirAccionFn: async ({ titulo, opciones }) => { titulos.push(titulo); return opciones[0]; },
    });
    const boton = [...cab.querySelectorAll("button")].find((b) => b.textContent.includes("Regenerar"));
    boton.click();
    await new Promise((r) => setTimeout(r, 0));
    assert.deepEqual(titulos, ["¿Qué quieres regenerar?", "¿Qué recibos?"]);
    assert.deepEqual(recibido, { tipo: "completo", modo: "faltan" }, "con Enter a todo, no se toca nada");
  });
}
