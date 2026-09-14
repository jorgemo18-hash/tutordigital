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
// SE IMPRIME LO QUE HAY EN PANTALLA, y eso resuelve lo de los nombres sin
// decidir nada: la rejilla del aula ya tiene el interruptor "sin nombres" (el
// que deja solo las plazas libres para poder enseñar la pantalla), así que si
// está activado sale sin ellos. Un botón aparte de "imprimir sin nombres"
// sería una segunda forma de decir lo mismo.
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

  test("cubre LAS DOS rejillas, que tienen prefijos de clase distintos", () => {
    // La del aula es `.ac-grid` y la del centro `.ach-grid`: son componentes
    // distintos que dibujan el mismo reparto con código distinto.
    assert.match(printCss, /\.ac-grid/);
    assert.match(printCss, /\.ach-grid/);
    assert.match(printCss, /\.ac-cell/);
    assert.match(printCss, /\.ach-cell/);
  });

  test("REGRESIÓN: la celda conserva el hueco de arriba para el contador", () => {
    // EL DEFECTO, visto en el PDF de prueba: al apretar la celda con un
    // `padding` a secas se comía los 22 px que `.ac-cell.filled` reserva para
    // el "4/6" posicionado en la esquina, y el contador se imprimía encima de
    // la etiqueta de curso del primer alumno ("3º ESO" y "2/6" pisados).
    assert.match(printCss, /\.ac-cell\.filled[^}]*padding: 20px 6px 5px/);
    assert.equal(
      /\.ac-cell\.filled[^}]*padding: 5px 6px/.test(printCss), false,
      "un padding uniforme vuelve a montar el contador sobre el curso"
    );
  });

  test("REGRESIÓN: la pastilla «desde D/M» se ve en papel", () => {
    // Su color es un crema al 55 % pensado para el fondo oscuro del panel: en
    // blanco se imprimía casi invisible, y es justo lo que distingue a un
    // alumno que todavía no viene.
    assert.match(printCss, /\.ac-slot-desde \{[^}]*border: 1px solid/);
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

  test("la rejilla no se parte entre dos folios", () => {
    assert.match(printCss, /\.ac-grid, \.ach-grid \{ break-inside: avoid/);
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
