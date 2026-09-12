import fs from "node:fs";
import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

const RAIZ = new URL("../../", import.meta.url).pathname;

// "INGRESOS" ERA LO COBRADO, Y LA PANTALLA NO LO DECÍA.
//
// EL PROBLEMA (barrido del 12/09/2026). Resumen y Fiscal sacan la cifra de
// los recibos en estado "pagado" —criterio de caja, provisional hasta que
// conteste el gestor (A4 del roadmap)— y la etiqueta ponía "Ingresos" a
// secas. En producción ese día: **0,00 € cobrados y 2.388,00 € emitidos**.
// O sea, la pantalla decía "Ingresos: 0,00 €" en septiembre.
//
// Y NO ES SOLO UN RÓTULO: de esa misma cifra sale la casilla [01] del Modelo
// 130, que es un papel que se presenta. La casilla es editable, pero para
// decidir qué poner hay que saber que el número propuesto es lo cobrado y
// cuánto hay emitido sin cobrar.
//
// EL CRITERIO ESTABA ESCRITO TRES VECES. El gráfico de Resumen, el resumen
// fiscal y las casillas del trimestre llevaban cada uno su
// `.eq("estado","pagado")` a mano: el criterio fiscal del negocio, repetido
// y sin nombre, en tres archivos. El día que el gestor conteste, el que se
// quedara atrás daría un número distinto del de al lado.
export async function run({ test, assert }) {
  const { fetchIngresosDelPeriodo, soloCobrados, CRITERIO_INGRESOS, ESTADO_COBRADO } = await import(
    "../../server/lib/academiaFinanzas/ingresosDelPeriodo.js"
  );

  // Los recibos de Lyceo del 12/09: emitidos y ninguno cobrado.
  const RECIBOS = [
    { mes: 9, total_neto: 1280, estado: "borrador" },
    { mes: 9, total_neto: 540, estado: "borrador" },
    { mes: 9, total_neto: 465, estado: "enviado" },
    { mes: 9, total_neto: 103, estado: "enviado" },
  ];

  function fakeAdmin(recibos = RECIBOS, fallo = false) {
    const q = {
      _f: {},
      select() { return q; },
      eq(col, val) { q._f[col] = val; return q; },
      in(col, vals) { q._f[col] = vals; return q; },
      then(resolve) {
        if (fallo) return resolve({ data: null, error: { message: "boom" } });
        const meses = q._f.mes;
        return resolve({
          data: meses ? recibos.filter((r) => meses.includes(r.mes)) : recibos,
          error: null,
        });
      },
    };
    return { from: () => q };
  }

  // ── El criterio, con nombre y en un solo sitio ────────────────────────

  test("el criterio tiene nombre y es el de caja", () => {
    assert.equal(CRITERIO_INGRESOS, "caja");
    assert.equal(ESTADO_COBRADO, "pagado");
  });

  test("REGRESIÓN: nadie escribe el filtro a mano, se pide al helper", () => {
    // Es lo que hace que el día del devengo se cambie UNA línea y no tres.
    for (const archivo of [
      "server/lib/academiaFinanzas/resumenConsultas.js",
      "server/lib/academiaFinanzas/fiscalConsultas.js",
    ]) {
      const fuente = fs.readFileSync(`${RAIZ}${archivo}`, "utf8");
      assert.equal(
        /academia_recibos[\s\S]{0,200}?estado["'],\s*["']pagado/.test(fuente), false,
        `${archivo} no debe filtrar por estado a mano`
      );
      assert.match(fuente, /fetchIngresosDelPeriodo/, `${archivo} debe usar el helper`);
    }
  });

  test("soloCobrados aplica el filtro sobre una consulta ya acotada", () => {
    const visto = {};
    soloCobrados({ eq: (col, val) => { visto[col] = val; return "q"; } });
    assert.deepEqual(visto, { estado: "pagado" });
  });

  // ── Las dos cifras ───────────────────────────────────────────────────

  test("devuelve cobrado Y facturado del mismo conjunto de recibos", async () => {
    const r = await fetchIngresosDelPeriodo(fakeAdmin(), "t1", { anio: 2026 });
    assert.equal(r.cobrado, 0, "ninguno pagado");
    assert.equal(r.facturado, 2388, "los cuatro emitidos");
    assert.equal(r.pendiente_de_cobro, 2388);
    assert.equal(r.recibos_emitidos, 4);
    assert.equal(r.recibos_cobrados, 0);
  });

  test("con algo cobrado, las dos cifras se separan bien", async () => {
    const r = await fetchIngresosDelPeriodo(
      fakeAdmin([...RECIBOS, { mes: 9, total_neto: 130, estado: "pagado" }]), "t1", { anio: 2026 }
    );
    assert.equal(r.cobrado, 130);
    assert.equal(r.facturado, 2518);
    assert.equal(r.pendiente_de_cobro, 2388);
  });

  test("el pendiente se da hecho, no se recalcula en cada pantalla", async () => {
    // Dos pantallas restando por su cuenta acaban difiriendo un céntimo por
    // el redondeo, y entonces no se cree ninguna de las dos.
    const r = await fetchIngresosDelPeriodo(
      fakeAdmin([{ mes: 1, total_neto: 33.33, estado: "pagado" }, { mes: 1, total_neto: 66.67, estado: "enviado" }]),
      "t1", { anio: 2026 }
    );
    assert.equal(r.cobrado + r.pendiente_de_cobro, r.facturado);
  });

  test("acota por meses cuando se le piden (trimestre)", async () => {
    const r = await fetchIngresosDelPeriodo(
      fakeAdmin([{ mes: 3, total_neto: 100, estado: "pagado" }, { mes: 9, total_neto: 200, estado: "pagado" }]),
      "t1", { anio: 2026, meses: [7, 8, 9] }
    );
    assert.equal(r.cobrado, 200, "solo el del trimestre pedido");
  });

  test("el reparto por mes solo cuenta lo COBRADO", async () => {
    const r = await fetchIngresosDelPeriodo(
      fakeAdmin([{ mes: 2, total_neto: 50, estado: "pagado" }, { mes: 2, total_neto: 70, estado: "enviado" }]),
      "t1", { anio: 2026 }
    );
    assert.equal(r.cobrado_por_mes[1], 50, "el gráfico pinta caja, igual que la tabla");
  });

  test("REGRESIÓN: un error de consulta se propaga, no se devuelve 0 €", async () => {
    // Un 0 € silencioso en una pantalla fiscal es peor que un error.
    const r = await fetchIngresosDelPeriodo(fakeAdmin(RECIBOS, true), "t1", { anio: 2026 });
    assert.ok(r.error);
    assert.equal(r.cobrado, undefined);
  });

  // ── Que se vea, y donde importa ──────────────────────────────────────

  test("REGRESIÓN: la tabla dice «Ingresos cobrados», no «Ingresos»", () => {
    const tab = fs.readFileSync(
      `${RAIZ}assets/academia/admin/js/sections/finanzas/resumenTab.js`, "utf8"
    );
    assert.match(tab, /"Ingresos cobrados"/);
    assert.equal(/\["Ingresos",/.test(tab), false, "el rótulo pelado era el problema");
    assert.match(tab, /Emitido en el período/, "y dice cuánto hay emitido");
    assert.match(tab, /Sin ningún gasto registrado/, "y avisa si no hay gastos metidos");
  });

  test("la nota va como NOTA de la fila, no como una fila más", () => {
    // Una fila de más en una tabla fiscal se lee como un sumando.
    const tab = fs.readFileSync(
      `${RAIZ}assets/academia/admin/js/sections/finanzas/resumenTab.js`, "utf8"
    );
    assert.match(tab, /small\.className = "ac-table-nota"/);
    assert.match(tab, /tdLabel\.appendChild\(small\)/);
  });

  test("REGRESIÓN: la tabla fiscal ya no se pinta con innerHTML", () => {
    // Con notas dentro, interpolar HTML en la tabla del IRPF es pedirlo.
    //
    // SE MIRA EL CÓDIGO, NO EL TEXTO: la primera versión de este test buscaba
    // "innerHTML" en el fragmento y se disparó con el COMENTARIO que explica
    // por qué ya no se usa. Es la tercera vez esta semana que un test lee
    // prosa y comprueba prosa (ver adjuntosAutorizacion y el 403): se quitan
    // los comentarios antes de mirar, y se busca la asignación, no la
    // palabra.
    const tab = fs.readFileSync(
      `${RAIZ}assets/academia/admin/js/sections/finanzas/resumenTab.js`, "utf8"
    );
    const fn = tab
      .slice(tab.indexOf("function buildFiscalTable"), tab.indexOf("// Pestaña Resumen"))
      .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    assert.equal(/\.innerHTML\s*=/.test(fn), false);
  });

  test("REGRESIÓN: el Modelo 130 explica qué propone la casilla [01]", () => {
    // La casilla se presenta a Hacienda y es editable: el criterio del
    // número propuesto tiene que estar a la vista antes de firmarlo.
    const m130 = fs.readFileSync(
      `${RAIZ}assets/academia/admin/js/sections/finanzas/fiscal/modelo130.js`, "utf8"
    );
    assert.match(m130, /\[01\] propone lo COBRADO/);
    assert.match(m130, /sin cobrar todavía/);
    assert.match(m130, /criterio es devengo/, "y que puede cambiarlo");
    assert.match(m130, /ningún gasto registrado en este trimestre/);
  });

  test("el backend manda las tres cifras que la pantalla necesita", () => {
    for (const [archivo, clave] of [
      ["server/lib/academiaFinanzas/resumenConsultas.js", "fiscal"],
      ["server/lib/academiaFinanzas/fiscalConsultas.js", "calculado"],
    ]) {
      const fuente = fs.readFileSync(`${RAIZ}${archivo}`, "utf8");
      assert.match(fuente, /facturado: ingresosPeriodo\.facturado/, `${clave}: falta facturado`);
      assert.match(fuente, /pendiente_de_cobro: ingresosPeriodo\.pendiente_de_cobro/, `${clave}: falta pendiente`);
      assert.match(fuente, /gastos_registrados: \(gastos \|\| \[\]\)\.length/, `${clave}: falta el conteo de gastos`);
    }
  });
}
