import fs from "node:fs";
import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

const RAIZ = new URL("../../", import.meta.url).pathname;

// AL CAMBIAR DE TEMA, EL PANEL SE QUEDABA SIN FONDO.
//
// EL FALLO (bug pequeño y antiguo, en la lista de deuda técnica desde el
// 07/09; arreglado el 14/09/2026). El contenedor del panel se monta con tres
// clases —`ac-app bg-frame ac-oscuro`— y el botón de tema hacía:
//
//   app.className = `ac-app ${temaClase(next)}`;
//
// La lista completa, escrita otra vez a mano, sin `bg-frame`. Y `bg-frame` es
// el color de fondo (bg-layers.css): al cambiar de tema el panel se quedaba
// transparente hasta recargar.
//
// LO QUE APARECIÓ AL MIRARLO: estaba en LOS DOS paneles. El documento del
// proyecto solo tenía apuntado el de admin, pero `academiaProfesor.js` llevaba
// la misma línea copiada —y su propia copia de `temaClase`—, así que el panel
// del profesor perdía el fondo igual. Un fallo apuntado como "de una pantalla"
// era de dos.
//
// LA REGLA: un `className` que se reconstruye a mano en un sitio distinto del
// que lo montó obliga a acordarse de todas las demás clases. Se cambia SOLO la
// clase que cambia, con `classList`, y el nombre de la clase de tema vive en
// un único archivo.
export async function run({ test, assert }) {
  const { aplicarTema, temaClase, CLASE_TEMA_CLARO, CLASE_TEMA_OSCURO } = await import(
    "../../assets/academia/js/tema.js"
  );

  // Los dos paneles, con la clase del contenedor que monta cada uno.
  const PANELES = [
    ["assets/academia/admin/js/academiaAdmin.js", "ac-app"],
    ["assets/academia/profesor/js/academiaProfesor.js", "ac-frame"],
  ];

  // Se mira el CÓDIGO, no la prosa: los comentarios explican justo lo que ya
  // no se hace, y un test que busca la palabra se dispara con la explicación
  // (pasó tres veces la semana del 11/09).
  const sinComentarios = (fuente) =>
    fuente.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

  // ── El helper ────────────────────────────────────────────────────────

  test("cambiar de tema no se lleva ninguna otra clase por delante", () => {
    const el = document.createElement("div");
    el.className = "ac-app bg-frame ac-oscuro";
    aplicarTema(el, "light");
    assert.ok(el.classList.contains("bg-frame"), "bg-frame es EL fondo: no puede caerse");
    assert.ok(el.classList.contains("ac-app"));
    assert.ok(el.classList.contains(CLASE_TEMA_CLARO));
    assert.equal(el.classList.contains(CLASE_TEMA_OSCURO), false, "y el tema viejo se va");
  });

  test("ida y vuelta veinte veces y el fondo sigue ahí", () => {
    // El fallo original solo se veía al PULSAR el botón, no al cargar.
    const el = document.createElement("div");
    el.className = "ac-frame bg-frame";
    for (let i = 0; i < 20; i++) aplicarTema(el, i % 2 ? "light" : "dark");
    assert.ok(el.classList.contains("bg-frame"));
    assert.ok(el.classList.contains("ac-frame"));
    assert.equal(el.className.split(/\s+/).filter((c) => c.startsWith("ac-o") || c.startsWith("ac-c")).length, 1,
      "nunca las dos clases de tema a la vez");
  });

  test("aplicarTema sobre un elemento que no existe no revienta", () => {
    // El panel lo monta código asíncrono: si algo llega tarde, que no tire
    // la pantalla entera por un fondo.
    aplicarTema(null, "dark");
    aplicarTema(undefined, "light");
    assert.ok(true);
  });

  test("cualquier cosa que no sea 'light' es el tema oscuro", () => {
    // `getTheme()` puede devolver null la primera vez que se entra.
    assert.equal(temaClase("light"), CLASE_TEMA_CLARO);
    assert.equal(temaClase("dark"), CLASE_TEMA_OSCURO);
    assert.equal(temaClase(null), CLASE_TEMA_OSCURO);
    assert.equal(temaClase(undefined), CLASE_TEMA_OSCURO);
  });

  // ── Los dos paneles ──────────────────────────────────────────────────

  for (const [archivo, claseRaiz] of PANELES) {
    const fuente = sinComentarios(fs.readFileSync(`${RAIZ}${archivo}`, "utf8"));

    test(`REGRESIÓN: ${claseRaiz} no se reconstruye al cambiar de tema`, () => {
      // Esta es la línea del fallo. Si vuelve, vuelve el fondo perdido.
      assert.equal(
        new RegExp("className\\s*=\\s*`" + claseRaiz + " \\$\\{").test(fuente), false,
        `${archivo}: la clase del tema no se pega reescribiendo className`
      );
      assert.match(fuente, /aplicarTema\(/, `${archivo} debe usar el helper`);
    });

    test(`${archivo.split("/").pop()} no lleva su propia copia de temaClase`, () => {
      // Había una copia en cada panel: dos sitios donde cambiar el nombre de
      // la clase, y ninguno de los dos sabía del otro.
      assert.equal(
        /function temaClase/.test(fuente), false,
        "el nombre de la clase de tema vive en academia/js/tema.js"
      );
      assert.match(fuente, /from "\.\.\/\.\.\/js\/tema\.js"/);
    });

    test(`${claseRaiz} se monta CON bg-frame`, () => {
      assert.match(
        fuente, new RegExp("className\\s*=\\s*\"" + claseRaiz + " bg-frame\""),
        `${archivo}: el fondo se pone al montar y no se toca después`
      );
    });
  }
}
