// LA HOJA EN PDF, HECHA SIEMPRE CON EL MISMO MOTOR.
//
// Por qué existe (23/9): imprimir la página desde el navegador de cada uno
// no es fiable. Safari deja menos alto útil que Chrome (sus márgenes más los
// de la impresora), y una hoja de 3 folios le salía en 5 páginas. No hay
// forma de saber desde la página cuánto papel va a dejar cada navegador con
// cada impresora. Así que la hoja se imprime AQUÍ, en un Chromium sin
// pantalla, y el profesor imprime el PDF: un PDF es igual en cualquier
// ordenador. Es la misma medida que usan las herramientas de calibración,
// que ya comprobaron que Chromium imprime exactamente los folios calculados.
//
// Se abre la MISMA página que ve el profesor en el panel
// (assets/shared/hoja/hoja-imprimible.html) y se le da el mismo contenido:
// lo que se ve en la vista previa es lo que sale en el PDF.
//
// `navegador` se inyecta (ver lanzaNavegador.js): en Vercel es el Chromium
// empaquetado para funciones; en local y en los tests, el que haya.
export const TIEMPO_MAXIMO_MS = 20000;

export async function imprimeHojaEnPdf({ navegador, urlPagina, hoja }) {
  const pagina = await navegador.newPage();
  try {
    await pagina.goto(urlPagina, { waitUntil: "networkidle0", timeout: TIEMPO_MAXIMO_MS });
    await pagina.waitForFunction(() => window.hojaLista === true, { timeout: TIEMPO_MAXIMO_MS });
    // `pintarHojaImprimible` se cumple cuando la hoja ya está partida en
    // folios, que es después de que lleguen las letras (hay que medir con
    // ellas).
    await pagina.evaluate((contenido) => window.pintarHojaImprimible(contenido), hoja);
    await pagina.evaluate(() => document.fonts.ready);
    const folios = await pagina.evaluate(() => document.querySelectorAll(".hj-folio").length);
    // `preferCSSPageSize`: el tamaño y los márgenes los manda el `@page` de
    // hoja.css, no unos márgenes por defecto del motor (que era justo el
    // fallo por el que las herramientas usan --print-to-pdf y no page.pdf).
    const pdf = await pagina.pdf({ preferCSSPageSize: true, printBackground: true });
    return { pdf: Buffer.from(pdf), folios };
  } finally {
    await pagina.close().catch(() => {});
  }
}
