import { Window } from "happy-dom";

const window = new Window();
globalThis.window = window;
globalThis.document = window.document;

// LA SECCIÓN "EJERCICIOS" DEL PANEL (sections/ejerciciosSection.js). El
// iframe con la hoja no se prueba aquí (happy-dom no carga páginas): se
// sustituye por un visor falso que apunta lo que le piden pintar y deja
// "pulsar" un ejercicio.
export async function run({ test, assert }) {
  const { createEjerciciosSection } = await import("../assets/academia/admin/js/sections/ejerciciosSection.js");
  const { SECTIONS } = await import("../assets/academia/admin/js/sidebar.js");
  const { buildIcon } = await import("../assets/academia/admin/js/icons.js");

  const BAT = (clave) => ({ clave, nombre: `N-${clave}`, dificultad: 1 });
  const TEMA = (id, curso, materia, nombre) => ({
    id, curso, materia, nombre,
    objetivos: [
      { numero: 1, titulo: "Uno", maxActividades: 8, baterias: [BAT("a"), BAT("b"), BAT("c")] },
      { numero: 2, titulo: "Dos", maxActividades: 3, baterias: [BAT("d")] },
    ],
  });
  const CATALOGO = {
    temas: [
      TEMA("t1", "1.º ESO", "Matemáticas", "Enteros"),
      TEMA("t2", "1.º ESO", "Matemáticas", "Fracciones"),
      TEMA("t3", "2.º ESO", "Matemáticas", "Potencias"),
    ],
    intensidades: ["repaso", "normal", "refuerzo"],
  };
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const cambia = (el, valor) => { el.value = valor; el.dispatchEvent(new window.Event("change")); };

  function montar({ generarFn, generarActividadFn, interpretarFn } = {}) {
    const pintadas = [];
    const pedidas = [];
    const sueltas = [];
    const pdfs = [];
    let pulsar = null;
    const visor = {
      el: document.createElement("div"),
      pintar: (h) => pintadas.push(h),
      imprimir: () => true,
      elegir: () => {},
    };
    const seccion = createEjerciciosSection({
      fetchCatalogoFn: async () => CATALOGO,
      generarFn: generarFn || (async (e) => {
        pedidas.push(e);
        return {
          hoja: { actividades: [{ enunciado: "A" }, { enunciado: "B" }, { enunciado: "C" }] },
          huecos: [{ orden: 1, clave: "a", objetivo: 1 }, { orden: 2, clave: "b", objetivo: 1 }, { orden: 3, clave: "c", objetivo: 1 }],
        };
      }),
      generarActividadFn: generarActividadFn || (async (p) => {
        sueltas.push(p);
        return { actividad: { enunciado: `nuevo-${p.clave}` }, hueco: { clave: p.clave, objetivo: 1 } };
      }),
      interpretarFn: interpretarFn || (async () => ({ accion: "pregunta", pregunta: "?", opciones: [] })),
      pedirPdfFn: async (h) => { pdfs.push(h); return "blob"; },
      abrirPdfFn: async ({ pedirPdfFn }) => pedirPdfFn(),
      createVisorFn: ({ onActividad }) => { pulsar = onActividad; return visor; },
      centro: "Lyceo",
    });
    const shell = document.createElement("div");
    return { seccion, shell, pintadas, pedidas, sueltas, pdfs, pulsar: (n) => pulsar(n) };
  }

  test("al entrar genera la hoja del primer tema, objetivo 1, normal, y la pinta con el centro", async () => {
    const { seccion, shell, pintadas, pedidas } = montar();
    await seccion.render(shell);
    assert.deepEqual(pedidas, [{ temaId: "t1", objetivo: 1, intensidad: "normal", actividades: null, baterias: null }]);
    assert.equal(pintadas[0].centro, "Lyceo");
    assert.equal(shell.querySelector(".ac-tab.active").dataset.intensidad, "normal");
  });

  test("CURSO → MATERIA → TEMA: cada selector ofrece solo lo que existe con lo de arriba", async () => {
    const { seccion, shell, pedidas } = montar();
    await seccion.render(shell);
    const [curso, materia, tema] = shell.querySelectorAll(".ej-select-corto");
    assert.deepEqual([...curso.options].map((o) => o.value), ["1.º ESO", "2.º ESO"]);
    assert.deepEqual([...tema.options].map((o) => o.textContent), ["Enteros", "Fracciones"]);
    cambia(tema, "t2");
    await tick();
    assert.equal(pedidas.at(-1).temaId, "t2");
    cambia(curso, "2.º ESO");
    await tick();
    assert.deepEqual([...tema.options].map((o) => o.textContent), ["Potencias"]);
    assert.equal(pedidas.at(-1).temaId, "t3");
    assert.equal(materia.value, "Matemáticas");
  });

  test("cambiar la intensidad o el objetivo genera al momento", async () => {
    const { seccion, shell, pedidas } = montar();
    await seccion.render(shell);
    shell.querySelector('[data-intensidad="refuerzo"]').click();
    await tick();
    cambia(shell.querySelector(".ej-objetivo"), "2");
    await tick();
    assert.deepEqual(pedidas.slice(1).map((p) => [p.objetivo, p.intensidad]), [[1, "refuerzo"], [2, "refuerzo"]]);
  });

  test("CUÁNTOS: automático por defecto, y solo los números que el objetivo puede dar", async () => {
    const { seccion, shell, pedidas } = montar();
    await seccion.render(shell);
    const cuantas = shell.querySelector(".ej-cuantas");
    assert.deepEqual([...cuantas.options].map((o) => o.textContent), ["Automático", "1", "2", "3", "4", "5", "6", "7", "8"]);
    cambia(cuantas, "6");
    await tick();
    assert.equal(pedidas.at(-1).actividades, 6);
    assert.ok(shell.textContent.includes("Ocupa los folios que necesite"));
    cambia(shell.querySelector(".ej-objetivo"), "2");
    await tick();
    assert.equal(pedidas.at(-1).actividades, null, "el objetivo 2 no llega a 6: vuelve a automático");
    assert.equal(cuantas.options.length, 4);
  });

  test("PULSAR UN EJERCICIO abre la barra; 'otro parecido' cambia SOLO ese, con su misma batería", async () => {
    const { seccion, shell, pintadas, sueltas, pulsar } = montar();
    await seccion.render(shell);
    const editor = shell.querySelector(".ej-editor");
    assert.equal(editor.hidden, true);
    pulsar(2);
    assert.equal(editor.hidden, false);
    assert.ok(editor.textContent.includes("Ejercicio 2 · N-b"));
    const opciones = [...editor.querySelectorAll("option")].map((o) => o.value);
    assert.deepEqual(opciones, ["", "a", "c"], "no se ofrece cambiarlo por sí mismo");
    editor.querySelector("button").click();
    await tick(); await tick();
    assert.deepEqual(sueltas[0], { temaId: "t1", objetivo: 1, intensidad: "normal", clave: "b" });
    assert.deepEqual(pintadas.at(-1).actividades.map((a) => a.enunciado), ["A", "nuevo-b", "C"]);
  });

  test("'cambiar por' pide la batería elegida; 'quitar' lo saca y deja el resto", async () => {
    const { seccion, shell, pintadas, sueltas, pulsar } = montar();
    await seccion.render(shell);
    pulsar(1);
    cambia(shell.querySelector(".ej-editor-cambiar"), "c");
    await tick(); await tick();
    assert.equal(sueltas[0].clave, "c");
    assert.deepEqual(pintadas.at(-1).actividades.map((a) => a.enunciado), ["nuevo-c", "B", "C"]);
    pulsar(3);
    [...shell.querySelectorAll(".ej-editor button")].find((b) => b.textContent === "Quitar").click();
    assert.deepEqual(pintadas.at(-1).actividades.map((a) => a.enunciado), ["nuevo-c", "B"]);
    assert.equal(shell.querySelector(".ej-editor").hidden, true);
  });

  const escribe = (shell, texto) => {
    shell.querySelector(".ej-pedido-input").value = texto;
    [...shell.querySelectorAll(".ej-pedido button")].find((b) => b.textContent === "Pedir").click();
  };

  test("PEDIDO EN PALABRAS → HOJA: se genera con el plan (tipos incluidos) y los controles lo reflejan", async () => {
    const vistas = [];
    const { seccion, shell, pedidas } = montar({
      interpretarFn: async (p) => { vistas.push(p); return { accion: "hoja", explicacion: "Dos de d.", plan: { temaId: "t1", objetivo: 2, intensidad: "refuerzo", baterias: ["d", "d"] } }; },
    });
    await seccion.render(shell);
    escribe(shell, "dos de d en refuerzo");
    await tick(); await tick();
    assert.deepEqual(vistas[0].conversacion, [{ rol: "profesor", texto: "dos de d en refuerzo" }]);
    assert.deepEqual(vistas[0].contexto, { temaId: "t1", objetivo: 1, intensidad: "normal" });
    assert.deepEqual(pedidas.at(-1), { temaId: "t1", objetivo: 2, intensidad: "refuerzo", actividades: null, baterias: ["d", "d"] });
    assert.equal(shell.querySelector(".ej-objetivo").value, "2");
    assert.equal(shell.querySelector(".ac-tab.active").dataset.intensidad, "refuerzo");
    assert.ok(shell.textContent.includes("Dos de d."));
    // "Otra versión" conserva los tipos pedidos; tocar un control los olvida.
    [...shell.querySelectorAll("button")].find((b) => b.textContent === "Otra versión").click();
    await tick();
    assert.deepEqual(pedidas.at(-1).baterias, ["d", "d"]);
    shell.querySelector('[data-intensidad="repaso"]').click();
    await tick();
    assert.equal(pedidas.at(-1).baterias, null);
  });

  test("SI PREGUNTA, la respuesta del profesor viaja con la pregunta delante", async () => {
    const vistas = [];
    let turno = 0;
    const { seccion, shell } = montar({
      interpretarFn: async (p) => {
        vistas.push(p.conversacion);
        turno += 1;
        return turno === 1
          ? { accion: "pregunta", pregunta: "¿De qué objetivo?", opciones: ["Uno", "Dos"] }
          : { accion: "hoja", explicacion: "", plan: { temaId: "t1", objetivo: 1, intensidad: "normal" } };
      },
    });
    await seccion.render(shell);
    escribe(shell, "unos cuantos");
    await tick(); await tick();
    assert.ok(shell.querySelector(".ej-pedido-respuesta").textContent.includes("¿De qué objetivo?"));
    [...shell.querySelectorAll(".ej-pedido-acciones button")].find((b) => b.textContent === "Dos").click();
    await tick(); await tick();
    assert.deepEqual(vistas[1], [
      { rol: "profesor", texto: "unos cuantos" },
      { rol: "asistente", texto: "¿De qué objetivo?" },
      { rol: "profesor", texto: "Dos" },
    ]);
    assert.equal(shell.querySelector(".ej-pedido-respuesta").hidden, true, "resuelto: se cierra");
  });

  test("FUERA DE CATÁLOGO: avisa y pide confirmación; 'seguir' dice que es la fase 3, sin fingir", async () => {
    const { seccion, shell, pedidas } = montar({
      interpretarFn: async () => ({ accion: "fuera_de_catalogo", explicacion: "Las raíces no son de este tema.", parecido: { temaId: "t1", objetivo: 2, intensidad: "normal" } }),
    });
    await seccion.render(shell);
    escribe(shell, "raíces cuadradas");
    await tick(); await tick();
    const caja = shell.querySelector(".ej-pedido-respuesta");
    assert.ok(caja.textContent.includes("Las raíces no son de este tema. ¿Quieres seguir?"));
    [...caja.querySelectorAll("button")].find((b) => b.textContent === "Seguir igualmente").click();
    assert.ok(caja.textContent.includes("fase 3"));
    const antes = pedidas.length;
    [...caja.querySelectorAll("button")].find((b) => b.textContent === "Vale").click();
    assert.equal(pedidas.length, antes, "no se generó nada");
    escribe(shell, "raíces cuadradas");
    await tick(); await tick();
    [...caja.querySelectorAll("button")].find((b) => b.textContent === "Usar lo más parecido").click();
    await tick();
    assert.equal(pedidas.at(-1).objetivo, 2);
  });

  test("CON UN EJERCICIO ELEGIDO, lo pedido cambia ESE ejercicio", async () => {
    const vistas = [];
    const { seccion, shell, sueltas, pintadas, pulsar } = montar({
      interpretarFn: async (p) => { vistas.push(p.contexto); return { accion: "ejercicio", clave: "c", explicacion: "Uno de c." }; },
    });
    await seccion.render(shell);
    pulsar(2);
    assert.ok(shell.querySelector(".ej-pedido-input").placeholder.includes("en lugar del 2"));
    escribe(shell, "mejor uno de c");
    await tick(); await tick(); await tick();
    assert.deepEqual(vistas[0].ejercicio, { orden: 2, objetivo: 1, clave: "b" });
    assert.equal(sueltas[0].clave, "c");
    assert.deepEqual(pintadas.at(-1).actividades.map((a) => a.enunciado), ["A", "nuevo-c", "C"]);
  });

  test("si la IA falla, se dice y el texto se queda en la caja para reintentar", async () => {
    const { seccion, shell } = montar({ interpretarFn: async () => { throw new Error("La IA no ha respondido."); } });
    await seccion.render(shell);
    escribe(shell, "dos de restar");
    await tick(); await tick();
    assert.ok(shell.textContent.includes("La IA no ha respondido."));
    assert.equal(shell.querySelector(".ej-pedido-input").value, "dos de restar");
  });

  test("IMPRIMIR ES UN PDF de la hoja tal como está en pantalla, con el centro", async () => {
    const { seccion, shell, pdfs, pulsar } = montar();
    await seccion.render(shell);
    pulsar(3);
    [...shell.querySelectorAll(".ej-editor button")].find((b) => b.textContent === "Quitar").click();
    [...shell.querySelectorAll("button")].find((b) => b.textContent === "PDF para imprimir").click();
    await tick(); await tick();
    assert.equal(pdfs.length, 1);
    assert.equal(pdfs[0].centro, "Lyceo");
    assert.deepEqual(pdfs[0].actividades.map((a) => a.enunciado), ["A", "B"], "con el cambio hecho");
  });

  test("MIENTRAS GENERA NO SE PUEDE PEDIR OTRA: los controles se bloquean y vuelven", async () => {
    let soltar;
    const { seccion, shell, pintadas } = montar({
      generarFn: () => new Promise((r) => { soltar = () => r({ hoja: { actividades: [] }, huecos: [] }); }),
    });
    const render = seccion.render(shell);
    await tick();
    const controles = [...shell.querySelectorAll(".ej-controles select, .ej-controles button")];
    assert.ok(controles.length >= 8);
    assert.ok(controles.every((c) => c.disabled), "algún control sigue activo mientras genera");
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
