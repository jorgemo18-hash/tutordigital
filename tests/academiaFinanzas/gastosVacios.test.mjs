import fs from "node:fs";
import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

const RAIZ = new URL("../../", import.meta.url).pathname;

// LAS TARJETAS DE GASTOS PONÍAN 0,00 € SIN DECIR QUE NO HAY NADA METIDO.
//
// EL PROBLEMA (barrido del 12/09/2026, cerrado el 14/09). Las tres tarjetas de
// la pestaña Gastos —Total, IVA soportado, Ticket medio— salen a `0,00 €`
// cuando el período no tiene ni un gasto, y debajo queda un reparto por
// categoría vacío y una tabla vacía. Tres ceros con pinta de dato y ni una
// palabra que diga que lo que falta no es el cálculo: es la entrada.
//
// ES EL MISMO PATRÓN QUE YA COSTÓ MEDIA HORA: el 12/09 "Ingresos: 0,00 €" llevó
// a buscar un fallo de sincronización que no existía.
//
// JORGE, AL ELEGIR ESTE BLOQUE: *"lo de los gastos es porque aún no he puesto
// nada, eso ya es funcionamiento, no creación de la aplicación"*. Y tiene
// razón en la mitad que importa — meter los gastos es suyo, la aplicación no
// se los va a inventar. Pero el arreglo no es inventarlos: es que la pantalla
// lo diga. Y el aviso no se acaba cuando él los meta: lo verá cualquier
// período sin gastos, y sobre todo lo verá una academia nueva su primer día.
//
// LO QUE LO SACA DE "DETALLE ESTÉTICO" es que tiene consecuencia en un papel
// que se presenta: de estos gastos sale la casilla de deducibles del Modelo
// 130. Comprobado en producción: 6 gastos en toda la base, todos de 2025,
// ninguno de 2026 — hoy ese modelo se calcularía con 0 € deducibles.
export async function run({ test, assert }) {
  const { textoSinGastos, buildAvisoSinGastos, etiquetaPeriodo } = await import(
    "../../assets/academia/admin/js/sections/finanzas/gastos/sinGastos.js"
  );

  const GASTO = { importe: 42, iva_importe: 0, categoria: "Material" };

  // ── Sin ningún gasto ─────────────────────────────────────────────────

  test("sin gastos dice que el cero es un hueco, no una cifra", () => {
    const { tono, texto } = textoSinGastos({ gastos: [], modo: "mes", mes: 9, anio: 2026 });
    assert.equal(tono, "sin_gastos");
    assert.match(texto, /No hay ningún gasto registrado en septiembre de 2026/);
    assert.match(texto, /un hueco, no una cifra/);
  });

  test("y dice qué implica en el Modelo 130, que es lo que cuesta dinero", () => {
    // Sin esta frase el aviso es cosmético. Con ella, explica por qué hay que
    // meterlos antes de presentar el trimestre.
    const { texto } = textoSinGastos({ gastos: [], modo: "mes", mes: 9, anio: 2026 });
    assert.match(texto, /Modelo 130/);
    assert.match(texto, /0 € de gastos deducibles/);
  });

  test("nombra el período del que habla, en mes y en trimestre", () => {
    // Un aviso que no dice de qué período habla, en una pantalla con selector
    // de período, no se puede comprobar.
    assert.equal(etiquetaPeriodo({ modo: "mes", mes: 1, anio: 2027 }), "enero de 2027");
    assert.equal(etiquetaPeriodo({ modo: "trimestre", trimestre: 3, anio: 2026 }), "el 3.º trimestre de 2026");
    assert.match(
      textoSinGastos({ gastos: [], modo: "trimestre", trimestre: 3, anio: 2026 }).texto,
      /3\.º trimestre de 2026/
    );
  });

  // ── Con gastos pero sin IVA desglosado ───────────────────────────────

  test("con gastos y sin ningún IVA desglosado, explica el 0,00 € del IVA", () => {
    // Es la situación real de los 6 gastos que hay en producción: ninguno
    // lleva desglose, así que "IVA soportado 0,00 €" parece un fallo de
    // cálculo y no lo es.
    const { tono, texto } = textoSinGastos({
      gastos: [GASTO, GASTO], resumen: { total: 84, iva_soportado: 0 }, modo: "mes", mes: 9, anio: 2026,
    });
    assert.equal(tono, "sin_iva");
    assert.match(texto, /2 gastos/);
    assert.match(texto, /ninguno con el IVA desglosado/);
    assert.match(texto, /se deduce el importe entero/, "es la regla fiscal que aplica el cálculo");
  });

  test("un solo gasto se dice en singular", () => {
    const { texto } = textoSinGastos({ gastos: [GASTO], resumen: { iva_soportado: 0 }, modo: "mes", mes: 9, anio: 2026 });
    assert.match(texto, /Hay un gasto en/);
  });

  test("con gastos y con IVA desglosado NO se avisa de nada", () => {
    // Una pantalla correcta no lleva aviso. Si avisáramos siempre, dejaría de
    // significar algo (la lección de los campos del diario del 11/09).
    assert.equal(
      textoSinGastos({ gastos: [GASTO], resumen: { total: 42, iva_soportado: 8.82 }, modo: "mes", mes: 9, anio: 2026 }),
      null
    );
  });

  // ── El nodo ──────────────────────────────────────────────────────────

  test("el aviso reutiliza las clases que ya existen, no inventa una nueva", () => {
    // Inventar una clase para esto habría sido otra clase sin regla de CSS:
    // justo la deuda que se cerró esta misma mañana con `.ac-slots`.
    const nodo = buildAvisoSinGastos({ gastos: [], modo: "mes", mes: 9, anio: 2026 });
    assert.equal(nodo.className, "ac-aviso-mes ac-aviso-mes--alerta");
    const css = fs.readFileSync(`${RAIZ}assets/academia/admin/css/_academia-admin-secciones.css`, "utf8");
    assert.match(css, /\.ac-aviso-mes/);
    assert.match(css, /\.ac-aviso-mes--alerta/);
  });

  test("el caso sin IVA va en tono suave, no en alerta", () => {
    const nodo = buildAvisoSinGastos({ gastos: [GASTO], resumen: { iva_soportado: 0 }, modo: "mes", mes: 9, anio: 2026 });
    assert.equal(nodo.className, "ac-aviso-mes");
  });

  test("una pantalla correcta no añade ningún nodo", () => {
    const nodo = buildAvisoSinGastos({ gastos: [GASTO], resumen: { iva_soportado: 8.82 }, modo: "mes", mes: 9, anio: 2026 });
    assert.equal(Boolean(nodo), false);
  });

  test("REGRESIÓN: las tarjetas se siguen enseñando, el aviso va DEBAJO", () => {
    // El cero es el dato correcto del período: no se esconde, se explica. Si
    // el aviso sustituyera a las tarjetas, un mes vacío no se distinguiría de
    // un error de carga.
    const tab = fs.readFileSync(
      `${RAIZ}assets/academia/admin/js/sections/finanzas/gastosTab.js`, "utf8"
    );
    const iStats = tab.indexOf("container.appendChild(buildStats(resumen))");
    const iAviso = tab.indexOf("buildAvisoSinGastos(");
    assert.ok(iStats > 0, "las tarjetas siguen ahí");
    assert.ok(iAviso > iStats, "y el aviso se construye después");
    // Y SE AÑADE AL DOM. La primera versión de este test solo comprobaba que
    // `buildAvisoSinGastos(` apareciera en el archivo: al quitar el
    // `appendChild` a mano, el test seguía verde — el aviso se construía y se
    // tiraba. Un test que no falla al revertir el arreglo no prueba nada.
    assert.match(tab, /if \(aviso\) container\.appendChild\(aviso\);/);
  });
}
