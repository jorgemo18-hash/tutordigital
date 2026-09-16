import fs from "node:fs";
import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

const RAIZ = new URL("../../", import.meta.url).pathname;

// QUE EL CUADRANTE SE LLEVE EL FOLIO ENTERO.
//
// Jorge, 16/09/2026, viendo el primer PDF: *"que se adapte según lo que ocupa
// para que salga en una hoja entera... si crees que cabe sin simplificar,
// mejor"*.
//
// SE AGRANDA LA LETRA, NO SE ESTIRAN LAS FILAS. Estirar las filas deja celdas
// enormes con el texto minúsculo pegado arriba: parece un error de maquetación.
// Lo que se busca es el cuerpo de letra MÁS GRANDE que todavía cabe.
//
// Y SE MIDE, no se estima: los milímetros de CSS son absolutos, así que una
// tabla dentro de una caja de 277mm de ancho mide en pantalla lo que va a medir
// en papel. La medición de verdad se comprobó en Chromium (el PDF sale a un
// folio con el cuerpo elegido); aquí se prueba la REGLA de elección, que es lo
// que se puede probar sin navegador porque happy-dom no maqueta.
export async function run({ test, assert }) {
  const { elegirCuerpo, CUERPOS_PT, ALTO_UTIL_MM, ANCHO_UTIL_MM, MARGEN_SEGURIDAD_MM, pxPorMm,
          esperarTipografias, esperarHojaDeEstilos, revisarAjusteDelCuadrante } =
    await import("../../assets/shared/js/ajusteDelCuadrante.js");
  const { esSafari, buildNotaOrientacion } =
    await import("../../assets/academia/aula/js/horario/imprimirCuadrante.js");

  const printCss = fs.readFileSync(
    `${RAIZ}assets/shared/styles/components/cuadrante-print.css`, "utf8"
  );

  // ── La regla de elección ─────────────────────────────────────────────

  // Un modelo sencillo y suficiente: el alto crece con el cuerpo de letra.
  const altoQueCrece = (mmPorPt) => (pt) => pt * mmPorPt;

  test("se queda con el cuerpo más grande que cabe", () => {
    // 10mm por punto: 18pt son 180mm (cabe en 190), 20pt son 200 (no cabe).
    assert.equal(elegirCuerpo(altoQueCrece(10), { altoDisponibleMm: 190 }), 18);
  });

  test("con poco sitio baja hasta el que entra, sin saltarse ninguno", () => {
    assert.equal(elegirCuerpo(altoQueCrece(10), { altoDisponibleMm: 100 }), 10);
    assert.equal(elegirCuerpo(altoQueCrece(10), { altoDisponibleMm: 99 }), 9.5);
    assert.equal(elegirCuerpo(altoQueCrece(10), { altoDisponibleMm: 85 }), 8.5);
  });

  test("si no cabe ni el más pequeño, se usa el más pequeño", () => {
    // No se inventa un 6pt ilegible ni se recorta nada: la tabla pasa al folio
    // siguiente, que ahora funciona — es una salida digna, no una pérdida.
    assert.equal(elegirCuerpo(altoQueCrece(100), { altoDisponibleMm: 190 }), Math.min(...CUERPOS_PT));
  });

  test("un cuadrante que cabe de sobra se lleva el tope, no crece sin fin", () => {
    // Sin tope, una tabla de dos filas saldría con letra de cartel y una
    // casilla con siete nombres partiría palabras.
    assert.equal(elegirCuerpo(() => 1, { altoDisponibleMm: 190 }), Math.max(...CUERPOS_PT));
  });

  test("el cuerpo elegido siempre es uno de la lista", () => {
    for (const disponible of [40, 80, 120, 160, 190, 400]) {
      const pt = elegirCuerpo(altoQueCrece(7), { altoDisponibleMm: disponible });
      assert.ok(CUERPOS_PT.includes(pt), `${pt}pt no está en la lista`);
    }
  });

  // ── Las medidas del folio ────────────────────────────────────────────

  test("el alto y el ancho útiles son los del A4 horizontal menos los márgenes", () => {
    // @page pone 10mm de margen: 297-20 de ancho y 210-20 de alto.
    assert.match(printCss, /@page \{ size: A4 landscape; margin: 10mm; \}/);
    assert.equal(ANCHO_UTIL_MM, 297 - 20);
    assert.equal(ALTO_UTIL_MM, 210 - 20);
    assert.ok(MARGEN_SEGURIDAD_MM > 0, "sin margen de seguridad, un redondeo saca un folio de más");
  });

  test("la caja de medir tiene el ancho del folio y no se ve", () => {
    assert.match(printCss, /\.cq-medida \{/);
    assert.match(printCss, /width: 277mm/);
    // `visibility: hidden` y NO `display: none`: lo que no se dibuja no se mide.
    assert.match(printCss, /\.cq-medida \{[^}]*visibility: hidden/);
    assert.equal(/\.cq-medida \{[^}]*display: none/.test(printCss), false);
  });

  // ── El contrato con el CSS ───────────────────────────────────────────

  test("el cuerpo de letra de la tabla es la variable que pone el JS", () => {
    assert.match(printCss, /font-size: var\(--cq-font, 9pt\)/);
  });

  // EL ASPECTO DE LA TABLA TIENE QUE ESTAR FUERA DE @media print: si estuviera
  // dentro, al medir en pantalla esas reglas no existirían y el cuerpo elegido
  // sería el de una tabla sin estilo.
  test("REGRESIÓN: el aspecto de la tabla vive fuera de @media print", () => {
    const iPrint = printCss.indexOf("@media print");
    const iCierre = printCss.indexOf("\n}", iPrint);
    const dentro = printCss.slice(iPrint, iCierre);
    assert.equal(
      dentro.includes(".cq-tabla {"), false,
      "dentro de @media print, la tabla no se puede medir en pantalla"
    );
    assert.match(printCss.slice(iCierre), /\.cq-tabla \{/);
  });

  test("el aire de las celdas crece con la letra", () => {
    // En px, al subir a 16pt los nombres se pegan a la raya.
    assert.match(printCss, /padding: 0\.3em 0\.45em/);
    assert.match(printCss, /width: 8\.2em/, "y la columna de la hora, o parte '15:30–16:30'");
  });

  test("cada hoja (una por profesor) va en su folio", () => {
    assert.match(printCss, /\.cq-hoja \{ break-after: page; \}/);
    assert.match(printCss, /\.cq-hoja:last-child \{ break-after: auto; \}/);
  });

  // ── EL FALLO DEL 16/09: se medía sin las tipografías ─────────────────

  // A Jorge le salían 3 folios con el ajuste ya aplicado. La causa:
  // `await document.fonts.ready` NO SIRVE cuando quien necesita la tipografía
  // está oculto. La tabla vive dentro de `.ac-print-solo { display: none }`, el
  // navegador nunca llega a pedir IBM Plex, y como no hay carga pendiente
  // `fonts.status` ya vale "loaded" y `ready` resuelve al instante con las
  // tipografías sin cargar. Comprobado en Chromium: `ready` resuelto, ninguna
  // Plex cargada. Se medía con la del sistema (más estrecha), salía 15pt, y con
  // IBM Plex esa tabla mide 207mm: dos folios.
  test("REGRESIÓN: las tipografías se piden una a una, no basta con fonts.ready", async () => {
    const pedidas = [];
    const doc = {
      fonts: {
        status: "loaded",
        load: (f) => { pedidas.push(f); return Promise.resolve([]); },
        ready: Promise.resolve(),
      },
    };
    assert.equal(await esperarTipografias(doc), true);
    assert.equal(pedidas.length, 3, "hacen falta las tres caras que usa la tabla");
    assert.ok(pedidas.some((f) => /IBM Plex Sans/.test(f) && /400/.test(f)));
    assert.ok(pedidas.some((f) => /IBM Plex Sans/.test(f) && /600/.test(f)));
    assert.ok(pedidas.some((f) => /IBM Plex Mono/.test(f)), "la columna de la hora va en mono");
  });

  test("sin FontFaceSet no revienta: se mide con lo que haya", async () => {
    assert.equal(await esperarTipografias({}), false);
  });

  // La hoja de impresión se inyecta como <link> al pintar y tarda en cargar.
  // Medir antes daría una caja del ancho de la ventana: menos saltos de línea,
  // tabla más baja y letra demasiado grande.
  test("REGRESIÓN: no se mide hasta que el banco mide de verdad 277mm", async () => {
    const doc = globalThis.document;
    const listo = await esperarHojaDeEstilos(doc, { intentos: 2 });
    assert.equal(listo, false, "happy-dom no maqueta: el banco nunca mide 277mm");
  });

  test("si la hoja de estilos no llega, NO se ajusta nada", async () => {
    // Mejor el 9pt del CSS —que cabe siempre— que un cuerpo elegido a ciegas.
    const doc = globalThis.document;
    const cont = doc.createElement("div");
    const hoja = doc.createElement("section");
    hoja.className = "cq-hoja";
    cont.appendChild(hoja);
    const cuerpos = await revisarAjusteDelCuadrante(cont, { doc });
    assert.deepEqual(cuerpos, []);
    assert.equal(hoja.style.getPropertyValue("--cq-font"), "");
  });

  // Los pasos finos tampoco son cosmética: el alto da saltos porque medio punto
  // puede hacer que una casilla pase de tres líneas a cuatro. Medido con el
  // cuadrante de Lyceo: 14pt son 166mm y 15pt son 207mm.
  test("hay escalones de medio punto donde se decide el folio", () => {
    for (const pt of [13.5, 14, 14.5, 15]) {
      assert.ok(CUERPOS_PT.includes(pt), `falta el escalón de ${pt}pt`);
    }
  });

  // ── El aviso de orientación de Safari ────────────────────────────────

  const UA_SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
  const UA_CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

  test("Safari se distingue de Chrome, que también dice 'Safari' en su UA", () => {
    assert.equal(esSafari(UA_SAFARI), true);
    assert.equal(esSafari(UA_CHROME), false);
    assert.equal(esSafari(""), false);
  });

  test("el aviso de orientación solo sale en Safari", () => {
    // Safari no aplica `@page { size: A4 landscape }` (visto en el diálogo de
    // impresión de Jorge: salía Vertical). En Chrome el aviso sería ruido.
    assert.equal(buildNotaOrientacion({ userAgent: UA_CHROME }), null);
    const nota = buildNotaOrientacion({ userAgent: UA_SAFARI });
    assert.match(nota.textContent, /horizontal/i);
  });

  test("px por milímetro se le pregunta al navegador, con respaldo a 96dpi", () => {
    // happy-dom no maqueta, así que devuelve el respaldo: lo que se comprueba
    // es que no revienta y que el respaldo es el correcto.
    const valor = pxPorMm(globalThis.document);
    assert.ok(valor > 0, "una división por cero dejaría el cuadrante sin ajustar");
    assert.ok(Math.abs(valor - 96 / 25.4) < 0.01, `respaldo raro: ${valor}`);
  });
}
