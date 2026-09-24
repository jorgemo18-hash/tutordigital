import { Window } from "happy-dom";

const window = new Window();
const document = window.document;

// RECURSOS → PROGRAMACIÓN (js/recursos/programacion/).
export async function run({ test, assert }) {
  const { crearGuardadoAutomatico, ESPERA_MS } = await import("../../../assets/teacher/js/recursos/programacion/guardadoAutomatico.js");
  const { createPantallaDeProgramaciones } = await import("../../../assets/teacher/js/recursos/programacion/pantallaDeProgramaciones.js");
  const { estadoDeLosPasos } = await import("../../../assets/teacher/js/recursos/programacion/editorDeProgramacion.js");
  const { PESTANAS } = await import("../../../assets/teacher/js/recursos/recursosConPestanas.js");

  const tick = () => new Promise((r) => setTimeout(r, 0));
  function relojFalso() {
    let n = 0;
    const pendientes = new Map();
    return {
      setTimeout(fn, ms) { n += 1; pendientes.set(n, { fn, ms }); return n; },
      clearTimeout(id) { pendientes.delete(id); },
      pasar() { const l = [...pendientes.values()]; pendientes.clear(); l.forEach((p) => p.fn()); },
      get cuantos() { return pendientes.size; },
    };
  }

  test("GUARDADO AUTOMÁTICO: muchos cambios seguidos = un solo guardado, al pasar la espera", async () => {
    const reloj = relojFalso();
    const estados = [];
    let guardados = 0;
    const g = crearGuardadoAutomatico({ guardarFn: async () => { guardados += 1; }, onEstado: (t) => estados.push(t), reloj });
    g.cambio(); g.cambio(); g.cambio();
    assert.equal(reloj.cuantos, 1, "cada cambio reinicia la espera");
    assert.equal(guardados, 0);
    assert.equal(ESPERA_MS, 1500);
    reloj.pasar();
    await tick(); await tick();
    assert.equal(guardados, 1);
    assert.deepEqual(estados.slice(-2), ["Guardando…", "Guardado"]);
  });

  test("guardado automático: el error se enseña y guardarYa no espera", async () => {
    const reloj = relojFalso();
    let ultimo = "";
    const g = crearGuardadoAutomatico({ guardarFn: async () => { throw new Error("Sin conexión"); }, onEstado: (t) => { ultimo = t; }, reloj });
    g.cambio();
    await g.guardarYa();
    assert.equal(ultimo, "Sin conexión");
    assert.equal(reloj.cuantos, 0, "guardarYa anula la espera");
  });

  const MATERIAS = [
    { slug: "matematicas", materia: "Matemáticas", cursos: [1, 2, 3, 4], etapa: "ESO" },
    { slug: "musica", materia: "Música", cursos: [1, 2, 3, 4], etapa: "ESO" },
  ];
  const CUR = {
    materia: "Matemáticas", curso: 1, literal: 99.7, sesionesSemanales: 4, criteriosSueltos: [],
    competencias: [
      { codigo: "CE.M.1", texto: "Resolver problemas", criterios: [{ codigo: "1.1", texto: "Interpretar problemas", columna: "x" }] },
      { codigo: "CE.M.2", texto: "Analizar soluciones", criterios: [{ codigo: "2.1", texto: "Comprobar soluciones", columna: "x" }] },
      { codigo: "CE.M.3", texto: "Conjeturas", criterios: [{ codigo: "3.1", texto: "Formular conjeturas", columna: "x" }] },
    ],
    saberes: [{ etiqueta: "Matemáticas 1º de ESO", cursos: [1], bloques: [
      { bloque: "A. Sentido numérico", apartados: [{ codigo: "A.2", nombre: "Cantidad", saberes: ["Recta numérica", "Números enteros"] }] },
      { bloque: "E. Sentido estocástico", apartados: [{ codigo: "E.2", nombre: "Incertidumbre", saberes: ["Regla de Laplace"] }] },
    ] }],
  };

  function montar({ lista = [] } = {}) {
    const reloj = relojFalso();
    const llamadas = { crear: [], guardar: [], borrar: [] };
    const guardadas = new Map();
    const api = {
      materiasDelCurriculo: async () => ({ materias: MATERIAS }),
      programaciones: async () => ({ programaciones: lista }),
      creaProgramacion: async (cuerpo) => {
        llamadas.crear.push(cuerpo);
        const p = { id: "p1", ...cuerpo, datos: {}, updated_at: "2026-09-24T10:00:00Z" };
        guardadas.set("p1", p);
        return p;
      },
      leeProgramacion: async (id) => guardadas.get(id),
      curriculo: async () => CUR,
      guardaProgramacion: async (id, cuerpo) => { llamadas.guardar.push(JSON.parse(JSON.stringify(cuerpo))); return { id }; },
      borraProgramacion: async (id) => { llamadas.borrar.push(id); },
    };
    const pantalla = createPantallaDeProgramaciones({ api, doc: document, reloj, centro: "IES de prueba", getAsignatura: () => "Matemáticas" });
    const raiz = document.createElement("div");
    return { pantalla, raiz, llamadas, reloj };
  }
  const botonCon = (raiz, texto) => [...raiz.querySelectorAll("button")].find((b) => b.textContent.includes(texto));
  const paso = (raiz, clave) => raiz.querySelector(`[data-paso="${clave}"]`);

  async function nueva() {
    const m = montar();
    await m.pantalla.render(m.raiz);
    botonCon(m.raiz, "Crear programación").click();
    await tick(); await tick(); await tick();
    return m;
  }

  test("RECURSOS tiene una tercera pestaña: Programación", () => {
    assert.deepEqual(PESTANAS.map(([c]) => c), ["hojas", "curriculo", "programacion"]);
  });

  test("LISTA vacía: lo dice; crear manda materia (la del profesor), curso y título, y abre el editor", async () => {
    const m = montar();
    await m.pantalla.render(m.raiz);
    assert.match(m.raiz.textContent, /Todavía no tienes ninguna/);
    botonCon(m.raiz, "Crear programación").click();
    await tick(); await tick(); await tick();
    assert.deepEqual(m.llamadas.crear[0], { materia_slug: "matematicas", curso: 1, titulo: "Matemáticas 1.º ESO" });
    assert.equal(m.raiz.querySelectorAll("[data-paso]").length, 5);
    assert.match(m.raiz.querySelector(".rc-h1").textContent, /Matemáticas 1.º ESO/);
  });

  test("DATOS: las sesiones semanales salen del anexo III (4) y el título guarda solo", async () => {
    const m = await nueva();
    assert.equal(m.pantalla.editor.datos.sesionesSemanales, 4);
    assert.match(m.raiz.textContent, /Unas 140 sesiones/);
    const titulo = m.raiz.querySelector(".rc-pg__datos input");
    titulo.value = "Mates 1.º A";
    titulo.dispatchEvent(new window.Event("input"));
    assert.equal(m.raiz.querySelector(".rc-pg__estado").textContent, "Cambios sin guardar");
    m.reloj.pasar();
    await tick(); await tick();
    assert.equal(m.llamadas.guardar.at(-1).titulo, "Mates 1.º A");
    assert.equal(m.llamadas.guardar.at(-1).datos.sesionesSemanales, 4);
  });

  test("UNIDADES: sin unidades avisa de lo que falta; 'Proponer una por bloque' lo cubre todo", async () => {
    const m = await nueva();
    paso(m.raiz, "unidades").click();
    assert.match(m.raiz.textContent, /Falta por programar: 3 de 3 saberes y 3 de 3 criterios/);
    botonCon(m.raiz, "Proponer una por bloque").click();
    assert.equal(m.pantalla.editor.datos.unidades.length, 2);
    assert.match(m.raiz.textContent, /Todo programado/);
    assert.match(paso(m.raiz, "unidades").textContent, /✓/);
    assert.equal(m.pantalla.editor.datos.unidades.reduce((n, u) => n + u.sesiones, 0), 140, "reparte las sesiones del curso");
  });

  test("unidades: desmarcar un saber lo vuelve a poner en 'falta' y guarda", async () => {
    const m = await nueva();
    paso(m.raiz, "unidades").click();
    botonCon(m.raiz, "Proponer una por bloque").click();
    const casilla = m.raiz.querySelector(".rc-ud__casilla input");
    casilla.checked = false;
    casilla.dispatchEvent(new window.Event("change"));
    assert.match(m.raiz.textContent, /Falta por programar: 1 de 3 saberes y 0 de 3 criterios/);
    m.reloj.pasar();
    await tick(); await tick();
    assert.equal(m.llamadas.guardar.at(-1).datos.unidades[0].saberes.length, 1);
  });

  test("unidades: mover abajo cambia el orden; añadir abre una vacía", async () => {
    const m = await nueva();
    paso(m.raiz, "unidades").click();
    botonCon(m.raiz, "Proponer una por bloque").click();
    const primera = m.pantalla.editor.datos.unidades[0].titulo;
    m.raiz.querySelector('[aria-label="Bajar la unidad"]').click();
    assert.equal(m.pantalla.editor.datos.unidades[1].titulo, primera);
    botonCon(m.raiz, "+ Añadir unidad").click();
    assert.equal(m.pantalla.editor.datos.unidades.length, 3);
    assert.equal(m.raiz.querySelectorAll("details.rc-ud[open]").length, 1, "la nueva se abre");
  });

  test("EVALUACIÓN: pesos a partes iguales que suman 100; si no suman, lo dice", async () => {
    const m = await nueva();
    paso(m.raiz, "evaluacion").click();
    assert.deepEqual(m.pantalla.editor.datos.pesos, { "CE.M.1": 34, "CE.M.2": 33, "CE.M.3": 33 });
    assert.match(m.raiz.textContent, /Suma 100 %/);
    const n = m.raiz.querySelector('[aria-label="Peso de CE.M.1"]');
    n.value = "50";
    n.dispatchEvent(new window.Event("input"));
    assert.match(m.raiz.textContent, /Suma 116 %: tiene que sumar 100/);
    assert.equal(m.raiz.querySelectorAll("textarea").length, 2, "c) y e)");
  });

  test("CALIFICACIÓN POR CRITERIO: se elige, reparte por criterio, suma por competencia y va al documento", async () => {
    const m = await nueva();
    paso(m.raiz, "evaluacion").click();
    assert.equal(m.raiz.querySelector('[data-modo="competencia"]').getAttribute("aria-checked"), "true", "por defecto, por competencia");
    m.raiz.querySelector('[data-modo="criterio"]').click();
    assert.equal(m.pantalla.editor.datos.calificacion, "criterio");
    assert.deepEqual(m.pantalla.editor.datos.pesos, { "1.1": 34, "2.1": 33, "3.1": 33 });
    const n = m.raiz.querySelector('[aria-label="Peso de 1.1"]');
    n.value = "40";
    n.dispatchEvent(new window.Event("input"));
    assert.match(m.raiz.querySelector(".rc-pg__subtotal").textContent, /CE.M.1: 40 %/);
    assert.match(m.raiz.textContent, /Suma 106 %/);
    m.reloj.pasar();
    await tick(); await tick();
    assert.equal(m.llamadas.guardar.at(-1).datos.calificacion, "criterio");
    paso(m.raiz, "documento").click();
    const d = [...m.raiz.querySelectorAll(".rc-doc__sec")][3].textContent;
    assert.match(d, /Criterio de evaluación/);
    assert.match(d, /1\.1\. Interpretar problemas40 %/);
    assert.match(d, /suman 106 %/);
  });

  test("volver a 'por competencia' reparte de nuevo por competencia (no mezcla pesos)", async () => {
    const m = await nueva();
    paso(m.raiz, "evaluacion").click();
    m.raiz.querySelector('[data-modo="criterio"]').click();
    m.raiz.querySelector('[data-modo="competencia"]').click();
    assert.deepEqual(Object.keys(m.pantalla.editor.datos.pesos), ["CE.M.1", "CE.M.2", "CE.M.3"]);
  });

  test("DOCUMENTO: los 15 apartados a–ñ en orden, con el currículo en a) y 'Sin redactar' donde falta", async () => {
    const m = await nueva();
    paso(m.raiz, "resto").click();
    const f = m.raiz.querySelector('textarea[data-letra="f"]');
    f.value = "Refuerzo en grupos flexibles.";
    f.dispatchEvent(new window.Event("input"));
    paso(m.raiz, "documento").click();
    const h2 = [...m.raiz.querySelectorAll(".rc-doc__h2")].map((h) => h.textContent.split(")")[0]);
    assert.deepEqual(h2, ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "ñ"]);
    const texto = m.raiz.querySelector(".rc-doc").textContent;
    assert.match(texto, /1\.1\. Interpretar problemas/);
    assert.match(texto, /Refuerzo en grupos flexibles/);
    assert.match(texto, /IES de prueba/);
    assert.match(m.raiz.textContent, /Faltan por redactar: c\), e\), g\)/);
  });

  test("IMPRIMIR: pone una copia suelta en <body> y la quita al acabar", async () => {
    const m = await nueva();
    document.body.appendChild(m.raiz);
    paso(m.raiz, "documento").click();
    let impreso = 0;
    window.print = () => {
      impreso += 1;
      assert.ok(document.body.classList.contains("rc-imprime-doc"));
      assert.equal(document.querySelectorAll("body > .rc-doc-impresion .rc-doc").length, 1);
    };
    botonCon(m.raiz, "Imprimir o guardar en PDF").click();
    assert.equal(impreso, 1);
    window.dispatchEvent(new window.Event("afterprint"));
    assert.equal(document.querySelectorAll(".rc-doc-impresion").length, 0);
    assert.ok(!document.body.classList.contains("rc-imprime-doc"));
    m.raiz.remove();
  });

  test("ESTADO de los pasos: evaluación completa solo con c), e) y pesos que suman 100", () => {
    const base = { sesionesSemanales: 4, unidades: [], pesos: { "CE.M.1": 100 }, textos: { c: "x", e: "y" } };
    assert.equal(estadoDeLosPasos(CUR, base).evaluacion, true);
    assert.equal(estadoDeLosPasos(CUR, { ...base, pesos: { "CE.M.1": 90 } }).evaluacion, false);
    assert.equal(estadoDeLosPasos(CUR, { ...base, textos: { c: "x", e: "  " } }).evaluacion, false);
    assert.equal(estadoDeLosPasos(CUR, base).unidades, false, "sin unidades no está hecho");
  });

  test("VOLVER guarda en el momento (sin esperar) y vuelve a la lista", async () => {
    const m = await nueva();
    const titulo = m.raiz.querySelector(".rc-pg__datos input");
    titulo.value = "Otra";
    titulo.dispatchEvent(new window.Event("input"));
    botonCon(m.raiz, "Mis programaciones").click();
    await tick(); await tick(); await tick();
    assert.equal(m.llamadas.guardar.at(-1).titulo, "Otra");
    assert.equal(m.reloj.cuantos, 0);
    assert.match(m.raiz.textContent, /Programaciones didácticas/);
  });

  test("LISTA con programaciones: cada una con materia y curso; borrar pide confirmación", async () => {
    const m = montar({ lista: [{ id: "p9", titulo: "Música 2.º", materia_slug: "musica", curso: 2, updated_at: "2026-09-20T10:00:00Z" }] });
    await m.pantalla.render(m.raiz);
    assert.match(m.raiz.querySelector(".rc-pg__lista").textContent, /Música 2.º.*Música · 2.º/);
    window.confirm = () => false;
    botonCon(m.raiz, "Borrar").click();
    await tick();
    assert.equal(m.llamadas.borrar.length, 0);
    window.confirm = () => true;
    botonCon(m.raiz, "Borrar").click();
    await tick();
    assert.deepEqual(m.llamadas.borrar, ["p9"]);
  });
}
