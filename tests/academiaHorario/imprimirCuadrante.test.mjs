import fs from "node:fs";
import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

const RAIZ = new URL("../../", import.meta.url).pathname;

// IMPRIMIR EL CUADRANTE EN UN FOLIO HORIZONTAL.
//
// Pedido por Jorge el 14/09/2026: *"el calendario de dar clases podría tener un
// botón de imprimir para que quepa en un folio en horizontal"*. Eligió las dos
// rejillas y con nombres y contador.
//
// YA NO SE IMPRIME LA REJILLA DE PANTALLA, y esto es una corrección del
// 16/09: las dos rejillas son cajas con scroll (`.ac-grid` con overflow-y,
// `.ach-rejilla-wrap` con overflow-x) y una caja con scroll no se puede
// imprimir — lo que queda fuera no sale recortado, sale ausente, y tampoco
// pasa a un segundo folio. Jorge: *"en horizontal se corta y si le bajo la
// escala no aparece lo cortado, tampoco aparece en dos hojas... es como si
// desapareciera"*. Se imprime una tabla aparte (cuadranteImprimible.js, con
// sus propios tests) y la rejilla se oculta entera.
//
// El interruptor "sin nombres" se sigue respetando en el papel: para eso se
// imprime un cuadrante sin nombres, para dárselo a alguien.
//
// NO ES UN PDF DEL SERVIDOR, a diferencia de la hoja para familias: aquélla
// tiene que caer en cuatro cuartillas exactas y se la lleva una familia. Esto
// es `window.print()` con hoja de impresión, el patrón que ya usan los modelos
// fiscales en este mismo panel.
//
// VERIFICADO MIRANDO EL PAPEL, no razonando el CSS: se generó el PDF real con
// Chromium en A4 horizontal sobre la rejilla de verdad y sus hojas de estilo de
// producción. La primera versión tenía tres defectos que solo se veían ahí, y
// los tres están fijados abajo con un test.
export async function run({ test, assert }) {
  const { buildBotonImprimir, buildCabeceraDeImpresion, ensureEstilosDeImpresion, textoFechaImpresion } =
    await import("../../assets/academia/aula/js/horario/imprimirCuadrante.js");

  const printCss = fs.readFileSync(
    `${RAIZ}assets/shared/styles/components/cuadrante-print.css`, "utf8"
  );
  const gridCss = fs.readFileSync(
    `${RAIZ}assets/shared/styles/components/diario-horario.css`, "utf8"
  );

  // ── El botón ─────────────────────────────────────────────────────────

  test("el botón imprime", () => {
    let veces = 0;
    const btn = buildBotonImprimir({ imprimirFn: () => { veces += 1; } });
    btn.click();
    assert.equal(veces, 1);
  });

  test("REGRESIÓN: un doble clic no encola dos diálogos de impresión", () => {
    // El segundo aparece cuando ya has cerrado el primero, y parece que la
    // aplicación se ha colgado. Mismo cuidado que en los botones fiscales.
    let veces = 0;
    const btn = buildBotonImprimir({
      imprimirFn: () => { veces += 1; btn.click(); },   // reentrada, como el doble clic
    });
    btn.click();
    assert.equal(veces, 1);
  });

  test("sin window.print disponible no revienta", () => {
    const btn = buildBotonImprimir({ ventana: {} });
    btn.click();
    assert.ok(true);
  });

  // ── La cabecera de papel ─────────────────────────────────────────────

  test("la cabecera dice qué es, de quién y cuándo se imprimió", () => {
    // Un cuadrante colgado en una pared sin fecha no se sabe si está vigente,
    // y sin el nombre del centro no se sabe de quién es en cuanto hay dos.
    const nodo = buildCabeceraDeImpresion({
      titulo: "Horario semanal · mis clases", centro: "Lyceo academia", fecha: new Date(2026, 8, 14),
    });
    assert.match(nodo.textContent, /Horario semanal · mis clases/);
    assert.match(nodo.textContent, /Lyceo academia/);
    assert.match(nodo.textContent, /Impreso el 14 de septiembre de 2026/);
  });

  test("la fecha va en español, sin depender de Intl", () => {
    assert.equal(textoFechaImpresion(new Date(2027, 0, 7)), "Impreso el 7 de enero de 2027");
  });

  test("sin nombre de centro no cuelga una línea vacía", () => {
    // El panel del profesor no le pasa el centro.
    const nodo = buildCabeceraDeImpresion({ titulo: "Horario semanal" });
    assert.equal(nodo.querySelector(".ac-print-cuadrante-centro"), null);
  });

  test("la cabecera no se ve en pantalla, solo en papel", () => {
    const nodo = buildCabeceraDeImpresion({ titulo: "X" });
    assert.ok(nodo.classList.contains("ac-print-solo"));
    assert.match(printCss, /\.ac-print-solo \{ display: none; \}/);
    assert.match(printCss, /\.ac-print-solo \{ display: block !important; \}/);
  });

  // ── La hoja de impresión ─────────────────────────────────────────────

  test("el folio es A4 horizontal", () => {
    assert.match(printCss, /@page \{ size: A4 landscape;/);
  });

  // ESTE ES EL ARREGLO DEL 16/09, y por eso es el test que no se puede
  // perder: mientras las rejillas se sigan imprimiendo, vuelve el recorte.
  test("REGRESIÓN: las rejillas de pantalla NO se imprimen — tienen scroll", () => {
    // `.ac-grid { overflow-y: auto }` y `.ach-rejilla-wrap { overflow-x: auto }`.
    // Una caja con scroll se imprime cortada por donde corta en pantalla y no
    // pasa a un segundo folio, así que lo que se manda al papel es la tabla.
    assert.match(gridCss, /\.ac-grid \{[^}]*overflow-y: auto/, "si esto cambia, revisa el arreglo");
    const oculta = printCss.match(/([^{}]*)\{\s*display: none !important;\s*\}/g) || [];
    const texto = oculta.join(" ");
    for (const clase of [".ac-grid", ".ach-grid", ".ach-rejilla-wrap"]) {
      assert.ok(texto.includes(clase), `${clase} tiene que ocultarse al imprimir`);
    }
  });

  test("la hoja de papel se imprime en su lugar", () => {
    assert.match(printCss, /\.cq-tabla \{/);
    assert.match(printCss, /\.cq-hoja \{/);
  });

  test("los fondos y colores llegan al papel", () => {
    // Sin esto el navegador los quita "para ahorrar tinta" y las etiquetas de
    // curso se imprimen en blanco.
    assert.match(printCss, /print-color-adjust: exact/);
  });

  test("no se imprime el cromo del panel", () => {
    for (const clase of [".ac-sidebar", ".ac-photo", ".ac-veil", ".ac-btn"]) {
      assert.ok(printCss.includes(clase), `${clase} debería ocultarse al imprimir`);
    }
  });

  // UN SELECTOR QUE NO ACIERTA NO FALLA: no hace nada. La versión del 14/09
  // ocultaba `.ac-sinhorario`, `.ach-sinhorario` y `.ach-selector-profesor`,
  // que no existen en ninguna pantalla (las de verdad son `.ach-pendientes` y
  // `.ach-filtro`), así que esas cosas se imprimían mientras el CSS parecía
  // decir lo contrario. Solo se ve mirando el papel — o con este test.
  test("REGRESIÓN: las clases que se ocultan existen de verdad en las pantallas", () => {
    const fuentes = [];
    const recorrer = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const ruta = `${dir}/${e.name}`;
        if (e.isDirectory()) { if (e.name !== "vendor") recorrer(ruta); continue; }
        if (/\.(js|html)$/.test(e.name)) fuentes.push(fs.readFileSync(ruta, "utf8"));
      }
    };
    recorrer(`${RAIZ}assets`);
    const todo = fuentes.join("\n");

    // Sin comentarios: este mismo archivo NOMBRA las clases fantasma viejas
    // como ejemplo, y el escáner las recogía como si fueran selectores.
    const cssLimpio = printCss.replace(/\/\*[\s\S]*?\*\//g, "");
    const bloques = cssLimpio.match(/([^{}]*)\{\s*display: none !important;\s*\}/g) || [];
    const clases = new Set();
    for (const bloque of bloques) {
      for (const m of bloque.matchAll(/\.([a-z][a-z0-9-]+)/g)) clases.add(m[1]);
    }
    assert.ok(clases.size >= 10, `esperaba una lista de clases, encontré ${clases.size}`);

    // `ac-print-solo` la pinta este propio módulo y se vuelve visible en papel,
    // así que no se busca en las pantallas.
    clases.delete("ac-print-solo");
    const fantasmas = [...clases].filter((c) => !todo.includes(c));
    assert.deepEqual(fantasmas, [], `clases que no existen en ninguna pantalla: ${fantasmas.join(", ")}`);
  });

  test("REGRESIÓN: no sale un folio en blanco detrás", () => {
    // `00-tokens.css` pone `html, body { height: 100% }` — en papel eso es
    // "exactamente un folio", y el margen de la hoja se salía al siguiente.
    // Visto en el PDF de prueba: dos páginas, la segunda vacía.
    assert.match(printCss, /html, body \{[^}]*height: auto !important/);
    assert.match(printCss, /\.cq-hoja:last-child \{ margin-bottom: 0; \}/);
  });

  test("la tabla SÍ se parte entre folios, y repite la cabecera", () => {
    // Lo contrario de lo que se hacía con la rejilla: una tabla que no se
    // puede partir es una tabla que se pierde cuando no cabe. Lo que no se
    // parte es la FILA, para que una hora no salga a caballo entre dos hojas.
    assert.match(printCss, /\.cq-tabla thead \{ display: table-header-group; \}/);
    assert.match(printCss, /\.cq-tabla tr \{[^}]*break-inside: avoid/);
  });

  test("las columnas se reparten el ancho en vez de desbordarse", () => {
    // table-layout: fixed — sin esto, un nombre largo se lleva el ancho de las
    // demás columnas y el viernes queda en dos centímetros.
    assert.match(printCss, /table-layout: fixed/);
  });

  // ── El cableado en las dos pantallas ─────────────────────────────────

  const sinComentarios = (f) =>
    f.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("/*") && !l.trim().startsWith("*")).join("\n");

  test("REGRESIÓN: la cabecera de papel va ANTES de la cabecera de pantalla", () => {
    // EL SEGUNDO DEFECTO del PDF de prueba: detrás de `.ac-body-head`, la
    // leyenda de etapas se imprimía por encima del título de la hoja.
    const horario = sinComentarios(fs.readFileSync(
      `${RAIZ}assets/academia/aula/js/horario/horario.js`, "utf8"
    ));
    const iCabecera = horario.indexOf("buildCabeceraDeImpresion(");
    const iHead = horario.indexOf("container.appendChild(buildBodyHead())");
    assert.ok(iCabecera > 0 && iHead > 0);
    assert.ok(iCabecera < iHead, "la cabecera de impresión se añade primero");
  });

  test("el botón está en las DOS rejillas", () => {
    for (const archivo of [
      "assets/academia/aula/js/horario/horario.js",
      "assets/academia/admin/js/sections/horarioSection.js",
    ]) {
      const fuente = sinComentarios(fs.readFileSync(`${RAIZ}${archivo}`, "utf8"));
      assert.match(fuente, /buildBotonImprimir\(\)/, `${archivo}: falta el botón`);
      assert.match(fuente, /ensureEstilosDeImpresion\(\)/, `${archivo}: faltan los estilos`);
    }
  });

  test("los estilos se cargan al pintar, no al pulsar", () => {
    // Así un Ctrl+P del navegador, sin pasar por el botón, también sale bien.
    const horario = sinComentarios(fs.readFileSync(
      `${RAIZ}assets/academia/aula/js/horario/horario.js`, "utf8"
    ));
    const iEstilos = horario.indexOf("ensureEstilosDeImpresion()");
    const iGrid = horario.indexOf("container.appendChild(gridSlot)");
    assert.ok(iEstilos > 0 && iEstilos < iGrid);
  });

  test("cargar los estilos dos veces no duplica la etiqueta", () => {
    // El cuadrante se repinta al cambiar de semana y al pulsar "sin nombres".
    // Se usa el documento global y no un `new Window()` propio: una segunda
    // ventana de happy-dom dentro de la suite no se comporta igual que suelta
    // (misma clase de trampa que la de `select.options` con pdf-parse).
    document.getElementById("ac-cuadrante-print-styles")?.remove();
    ensureEstilosDeImpresion(document);
    ensureEstilosDeImpresion(document);
    assert.equal(document.querySelectorAll("link[id='ac-cuadrante-print-styles']").length, 1);
  });

  test("las clases nuevas tienen regla de CSS", () => {
    // La norma de esta misma mañana: una clase sin regla es deuda (`.ac-slots`).
    assert.match(gridCss, /\.ac-cuadrante-acciones \{/);
    assert.match(gridCss, /\.ac-btn-imprimir \{/);
    assert.match(gridCss, /\.ac-claro \.ac-btn-imprimir/, "y en los dos temas");
  });
}
