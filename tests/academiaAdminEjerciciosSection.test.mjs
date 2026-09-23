import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

// LA SECCIÓN "EJERCICIOS" DEL PANEL (sections/ejerciciosSection.js). El
// iframe con la hoja no se prueba aquí (happy-dom no carga páginas): se
// sustituye por un visor falso que apunta lo que le piden pintar.
export async function run({ test, assert }) {
  const { createEjerciciosSection } = await import("../assets/academia/admin/js/sections/ejerciciosSection.js");
  const { SECTIONS } = await import("../assets/academia/admin/js/sidebar.js");
  const { buildIcon } = await import("../assets/academia/admin/js/icons.js");

  const CATALOGO = {
    materia: "Matemáticas", curso: "1.º ESO", tema: "Números enteros",
    objetivos: [{ numero: 1, titulo: "Uno" }, { numero: 2, titulo: "Dos" }],
    intensidades: ["repaso", "normal", "refuerzo"],
  };
  const tick = () => new Promise((r) => setTimeout(r, 0));

  function montar({ generarFn } = {}) {
    const pintadas = [];
    const pedidas = [];
    const visor = { el: document.createElement("div"), pintar: (h) => pintadas.push(h), imprimir: () => true };
    const seccion = createEjerciciosSection({
      fetchCatalogoFn: async () => CATALOGO,
      generarFn: generarFn || (async (e) => { pedidas.push(e); return { hoja: { objetivo: `o${e.objetivo}-${e.intensidad}` } }; }),
      createVisorFn: () => visor,
      centro: "Lyceo",
    });
    const shell = document.createElement("div");
    return { seccion, shell, pintadas, pedidas };
  }

  test("al entrar genera la hoja del objetivo 1 en normal y la pinta con el nombre del centro", async () => {
    const { seccion, shell, pintadas, pedidas } = montar();
    await seccion.render(shell);
    assert.deepEqual(pedidas, [{ objetivo: 1, intensidad: "normal" }]);
    assert.equal(pintadas[0].centro, "Lyceo");
    assert.equal(shell.querySelectorAll("option").length, 2);
    assert.equal(shell.querySelector(".ac-tab.active").dataset.intensidad, "normal");
  });

  test("cambiar la intensidad o el objetivo genera al momento", async () => {
    const { seccion, shell, pedidas } = montar();
    await seccion.render(shell);
    shell.querySelector('[data-intensidad="refuerzo"]').click();
    await tick();
    const select = shell.querySelector("select");
    select.value = "2";
    select.dispatchEvent(new window.Event("change"));
    await tick();
    assert.deepEqual(pedidas.slice(1), [
      { objetivo: 1, intensidad: "refuerzo" },
      { objetivo: 2, intensidad: "refuerzo" },
    ]);
  });

  test("MIENTRAS GENERA NO SE PUEDE PEDIR OTRA: los controles se bloquean y vuelven", async () => {
    // Así una hoja vieja que llega tarde no puede tapar la que se acaba de
    // pedir, ni se imprime una hoja a medio cambiar.
    let soltar;
    const { seccion, shell, pintadas } = montar({
      generarFn: () => new Promise((r) => { soltar = () => r({ hoja: { objetivo: "x" } }); }),
    });
    const render = seccion.render(shell);
    await tick();
    const controles = [...shell.querySelectorAll("select, button")];
    assert.ok(controles.length >= 5);
    assert.ok(controles.every((c) => c.disabled), "algún control sigue activo mientras genera");
    shell.querySelector('[data-intensidad="repaso"]').click();
    soltar();
    await render;
    assert.equal(pintadas.length, 1);
    assert.ok(controles.every((c) => !c.disabled));
  });

  test("si falla, lo dice y no pinta nada", async () => {
    const { seccion, shell, pintadas } = montar({ generarFn: async () => { throw new Error("se cayó"); } });
    await seccion.render(shell);
    assert.equal(pintadas.length, 0);
    assert.ok(shell.textContent.includes("se cayó"));
  });

  test("'Ejercicios' está en el menú, con un icono que existe", () => {
    const s = SECTIONS.find((x) => x.id === "ejercicios");
    assert.ok(s);
    assert.ok(buildIcon(s.icon, { size: 14 }).querySelectorAll("path").length > 0);
  });
}
