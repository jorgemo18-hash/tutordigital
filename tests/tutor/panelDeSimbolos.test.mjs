import fs from "node:fs";
import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

const RAIZ = new URL("../../", import.meta.url).pathname;

// LA BARRA DE SÍMBOLOS MATEMÁTICOS.
//
// PARA QUÉ (Jorge, 14/09/2026): *"nació con el sentido de que si querías
// escribir un ejercicio, pudieras poner 'x al cuadrado' bien y no x^2, que
// mucha gente ni lo sabe"*. Y su propuesta: *"en ordenador lo implementaría en
// la pantalla de la izquierda igual que se usa calculadora, y ahí se abren los
// símbolos matemáticos y cuando los pulsas se escriben en derecha"*.
//
// VA ENCIMA DEL CUADRO DE ESCRIBIR, NO EN LA COLUMNA IZQUIERDA, y es un
// desacuerdo razonado con esa propuesta: la calculadora y la pizarra son tareas
// que se hacen aparte (entras, haces la cuenta, sales con un resultado), y la
// columna izquierda es su sitio. Los símbolos son una EXTENSIÓN DEL TECLADO:
// escriben en el cuadro de la derecha, así que tenerlos a la izquierda obliga a
// cruzar la pantalla con el ratón y con la mirada por cada símbolo.
//
// Y ADEMÁS RESUELVE EL MÓVIL SIN HACER DOS COSAS: una barra encima del cuadro
// es exactamente la forma que cabe en un móvil (una fila encima del teclado).
// El panel en la columna izquierda habría necesitado una segunda
// implementación, porque esa columna se colapsa.
//
// LO QUE YA ESTABA HECHO Y APAGADO: la vista previa (`ui/preview.js`) solo se
// encendía `if (padOpen)`, mirando un `#pad` con clase `show` que **no existía
// en ningún HTML**. Alguien planeó esta barra y se quedó a medias; el
// traductor `asciiToLatex` también estaba escrito.
export async function run({ test, assert }) {
  const { GRUPOS_SIMBOLOS, todosLosSimbolos, textoDe, paraInsertar, MARCA_CURSOR } =
    await import("../../assets/student/features/matematicas/simbolos.js");
  const { pintarBarraSimbolos, crearBarraSimbolos } =
    await import("../../assets/student/features/matematicas/panelSimbolos.js");

  // ── El catálogo ──────────────────────────────────────────────────────

  test("hay símbolos de lo que un alumno escribe de verdad", () => {
    const etiquetas = todosLosSimbolos().map((s) => s.etiqueta);
    for (const imprescindible of ["x²", "√", "a/b", "×", "÷", "π", "≤"]) {
      assert.ok(etiquetas.includes(imprescindible), `falta ${imprescindible}`);
    }
    assert.ok(todosLosSimbolos().length >= 25);
  });

  test("cada símbolo dice para qué es, no solo qué pinta", () => {
    // Un botón que solo dice "√" no se entiende sin verlo, y un lector de
    // pantalla leería "raíz" o nada. El `titulo` es el rótulo accesible.
    for (const s of todosLosSimbolos()) {
      assert.ok(s.etiqueta && s.inserta, `símbolo incompleto: ${JSON.stringify(s)}`);
      assert.ok(s.titulo && s.titulo.length >= 2, `${s.etiqueta} sin descripción`);
    }
  });

  test("REGRESIÓN: la marca del cursor NO es la barra vertical", () => {
    // EL FALLO, visto dibujando los 28 símbolos en Chromium: con `|` como
    // marca, la plantilla del valor absoluto (`\left|‸ \right|`) se quedaba en
    // `\left \right` al limpiar las marcas y KaTeX la rechazaba. La barra
    // vertical ES un símbolo matemático: no puede ser además el marcador.
    assert.equal(MARCA_CURSOR, "\u2038");
    assert.notEqual(MARCA_CURSOR, "|");
    const absoluto = todosLosSimbolos().find((s) => s.etiqueta === "|x|");
    assert.ok(absoluto.inserta.includes("\\left|"), "las barras del valor absoluto se conservan");
    assert.ok(textoDe(absoluto.inserta).includes("\\left|"));
    assert.ok(textoDe(absoluto.inserta).includes("\\right|"));
  });

  // ── Dónde queda el cursor ────────────────────────────────────────────

  test("el cursor queda donde hay que seguir escribiendo", () => {
    // `√(‸)` deja el cursor DENTRO del paréntesis: si quedara al final, el
    // alumno tendría que mover el cursor a mano por cada raíz y la
    // herramienta estorbaría más de lo que ayuda.
    assert.deepEqual(paraInsertar("√(\u2038)"), { texto: "√()", desplazamiento: -1 });
    assert.deepEqual(paraInsertar("\\sum_{\u2038}"), { texto: "\\sum_{}", desplazamiento: -1 });
  });

  test("un símbolo sin marca deja el cursor al final", () => {
    assert.deepEqual(paraInsertar("^2"), { texto: "^2", desplazamiento: 0 });
    assert.deepEqual(paraInsertar("×"), { texto: "×", desplazamiento: 0 });
  });

  test("todas las plantillas del catálogo traducen a algo escribible", () => {
    for (const s of todosLosSimbolos()) {
      const { texto, desplazamiento } = paraInsertar(s.inserta);
      assert.ok(texto.length > 0, `${s.etiqueta} no escribe nada`);
      assert.equal(texto.includes(MARCA_CURSOR), false, `${s.etiqueta} deja la marca dentro`);
      assert.ok(desplazamiento <= 0 && -desplazamiento <= texto.length, `${s.etiqueta}: desplazamiento imposible`);
    }
  });

  // ── La barra ─────────────────────────────────────────────────────────

  test("pinta un botón por símbolo, agrupados", () => {
    const cont = document.createElement("div");
    pintarBarraSimbolos(cont, { onSimbolo: () => {} });
    assert.equal(cont.querySelectorAll(".sim-btn").length, todosLosSimbolos().length);
    assert.equal(cont.querySelectorAll(".sim-grupo").length, GRUPOS_SIMBOLOS.length);
  });

  test("los grupos se anuncian a un lector de pantalla", () => {
    // En móvil los rótulos se esconden por CSS, pero el grupo sigue siendo un
    // grupo: sin esto son veintiocho botones sueltos sin ninguna estructura.
    const cont = document.createElement("div");
    pintarBarraSimbolos(cont, { onSimbolo: () => {} });
    for (const g of cont.querySelectorAll(".sim-grupo")) {
      assert.equal(g.getAttribute("role"), "group");
      assert.ok(g.getAttribute("aria-label"));
    }
  });

  test("REGRESIÓN: se actúa en mousedown, no en click", () => {
    // Al pulsar un botón, el navegador quita el foco del textarea ANTES del
    // click, y con el foco se pierde la posición del cursor: el símbolo
    // acabaría siempre al final del texto, no donde estaba escribiendo.
    const cont = document.createElement("div");
    const recibidos = [];
    pintarBarraSimbolos(cont, { onSimbolo: (texto, desp) => recibidos.push([texto, desp]) });
    const btn = cont.querySelector(".sim-btn");

    btn.dispatchEvent(new window.Event("mousedown", { bubbles: true, cancelable: true }));
    assert.equal(recibidos.length, 1, "mousedown escribe");

    btn.dispatchEvent(new window.Event("click", { bubbles: true }));
    assert.equal(recibidos.length, 1, "y el click que viene detrás no lo escribe dos veces");
  });

  test("entrega el texto ya traducido, no la plantilla con la marca", () => {
    const cont = document.createElement("div");
    let recibido = null;
    pintarBarraSimbolos(cont, { onSimbolo: (texto, desp) => { recibido = [texto, desp]; } });
    const raiz = [...cont.querySelectorAll(".sim-btn")].find((b) => b.textContent === "√");
    raiz.dispatchEvent(new window.Event("mousedown", { bubbles: true, cancelable: true }));
    assert.deepEqual(recibido, ["√()", -1]);
  });

  test("abrir y cerrar, con el estado a la vista", () => {
    const cont = document.createElement("div");
    const boton = document.createElement("button");
    const barra = crearBarraSimbolos({ contenedor: cont, boton, onSimbolo: () => {} });

    assert.equal(barra.estaAbierta(), false, "empieza cerrada: no roba sitio hasta que se pide");
    assert.equal(cont.hidden, true);
    assert.equal(boton.getAttribute("aria-pressed"), "false");

    barra.alternar();
    assert.equal(barra.estaAbierta(), true);
    assert.equal(cont.hidden, false);
    assert.equal(boton.getAttribute("aria-pressed"), "true");

    barra.alternar();
    assert.equal(barra.estaAbierta(), false);
  });

  test("el botón de la burbuja la abre", () => {
    const cont = document.createElement("div");
    const boton = document.createElement("button");
    const barra = crearBarraSimbolos({ contenedor: cont, boton, onSimbolo: () => {} });
    boton.click();
    assert.equal(barra.estaAbierta(), true);
  });

  // ── La vista previa, que llevaba apagada ─────────────────────────────

  test("REGRESIÓN: la vista previa ya no busca un #pad que no existe", () => {
    const preview = fs.readFileSync(`${RAIZ}assets/student/ui/preview.js`, "utf8");
    const codigo = preview.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    assert.equal(
      /getElementById\("pad"\)/.test(codigo), false,
      "ese elemento nunca existió: el estado se recibe, no se busca"
    );
    assert.match(codigo, /estaAbiertoElPanel/);
  });

  test("REGRESIÓN: el panel del alumno cablea la barra con insertAtCursor", () => {
    // Y no con una función de inserción propia: la primera versión traía una
    // copia de `insertAtCursor`, que ya existía y además devuelve el foco,
    // dispara `input` y refresca la vista previa.
    const student = fs.readFileSync(`${RAIZ}assets/student/student.js`, "utf8");
    assert.match(student, /crearBarraSimbolos\(\{/);
    assert.match(student, /onSimbolo: \(texto, desplazamiento\) => insertAtCursor\(texto, desplazamiento\)/);
    assert.match(student, /estaAbiertoElPanel: \(\) => Boolean\(barraSimbolos && barraSimbolos\.estaAbierta\(\)\)/);
  });

  test("el HTML tiene la barra y su botón, y la barra empieza oculta", () => {
    const html = fs.readFileSync(`${RAIZ}assets/student/index.html`, "utf8");
    assert.match(html, /id="simbolosBar"[^>]*hidden/);
    assert.match(html, /id="btnSimbolos"/);
    // La hoja se importa en el manifiesto de estilos, no en el HTML: `index.html`
    // solo carga `student-new.css`, que es quien hace los @import.
    const manifiesto = fs.readFileSync(`${RAIZ}assets/student/styles/student-new.css`, "utf8");
    assert.match(manifiesto, /10-simbolos\.css/, "la hoja tiene que estar importada");
  });

  test("REGRESIÓN: la barra no lleva scroll vertical con el contenido escondido", () => {
    // La primera versión tenía `max-height: 34vh` y en una ventana normal
    // escondía dos de los cinco grupos detrás de una barra de scroll casi
    // invisible. Es el fallo del 12/09 en la tarjeta de métodos de pago, otra
    // vez: un scroll dentro de un panel esconde justo lo que hay que ver.
    const css = fs.readFileSync(
      `${RAIZ}assets/student/styles/student-new/10-simbolos.css`, "utf8"
    );
    const regla = css.slice(css.indexOf(".simbolos-bar {"));
    assert.equal(/max-height/.test(regla.slice(0, regla.indexOf("}"))), false);
    assert.equal(/overflow-y: auto/.test(regla.slice(0, regla.indexOf("}"))), false);
  });

  test("en móvil es UNA fila que se desplaza, no cinco", () => {
    // Cinco filas encima de un teclado abierto se comen media pantalla justo
    // cuando el alumno está escribiendo.
    const css = fs.readFileSync(
      `${RAIZ}assets/student/styles/student-new/10-simbolos.css`, "utf8"
    );
    const movil = css.slice(css.indexOf("@media (max-width: 768px)"));
    assert.match(movil, /flex-direction: row/);
    assert.match(movil, /overflow-x: auto/);
    assert.match(movil, /\.sim-grupo-rotulo \{ display: none; \}/);
  });
}
