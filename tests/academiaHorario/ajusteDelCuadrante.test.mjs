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
  const { elegirCuerpo, CUERPOS_PT, ALTO_UTIL_MM, ANCHO_UTIL_MM, MARGEN_SEGURIDAD_MM, pxPorMm } =
    await import("../../assets/shared/js/ajusteDelCuadrante.js");

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

  test("px por milímetro se le pregunta al navegador, con respaldo a 96dpi", () => {
    // happy-dom no maqueta, así que devuelve el respaldo: lo que se comprueba
    // es que no revienta y que el respaldo es el correcto.
    const valor = pxPorMm(globalThis.document);
    assert.ok(valor > 0, "una división por cero dejaría el cuadrante sin ajustar");
    assert.ok(Math.abs(valor - 96 / 25.4) < 0.01, `respaldo raro: ${valor}`);
  });
}
