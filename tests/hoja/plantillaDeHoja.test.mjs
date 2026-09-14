import fs from "node:fs";
import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

const RAIZ = new URL("../../", import.meta.url).pathname;

// LA PLANTILLA DE LA HOJA DE EJERCICIOS.
//
// PARA QUÉ (Jorge, 14/09/2026): *"lo de la identidad visual me refiero a una
// manera tipo plantilla que tengamos y que adaptemos a todos, me gustan estos
// que te sale la fórmula o un esquema o resumen si es más teoría y debajo los
// ejercicios, si puede ser más variedad que repetición pero sin sacar 100
// ejercicios, más vale calidad y originalidad que cantidad. También cuando sea
// me gustaría que hubiera mezcla de ejercicios y problemas"*.
//
// LO QUE SE PRUEBA AQUÍ NO ES "QUE SE VEA BONITO" —eso se comprueba mirando el
// PDF, y así se hizo— sino las tres reglas que hacen que la hoja siga siendo
// esta hoja cuando el contenido lo genere un modelo:
//
//   1. CABE EN UN FOLIO, o se avisa. Medido: la primera versión, con siete
//      actividades, ocupaba 410mm (folio y medio) y en pantalla no se notaba.
//   2. NO SE INYECTA HTML. El enunciado va a venir de un modelo, así que se
//      trata como dato de entrada aunque salga de nuestra base de datos.
//   3. LAS CLASES QUE USA EL JS EXISTEN EN EL CSS. Una clase fantasma no rompe
//      nada visible: simplemente ese trozo de hoja sale sin estilo, y en papel
//      ya no hay quien lo arregle.
export async function run({ test, assert }) {
  const { buildHoja } = await import("../../assets/shared/hoja/js/hojaDeEjercicios.js");
  const { MAX_ACTIVIDADES, buildActividad, buildActividades } =
    await import("../../assets/shared/hoja/js/actividades.js");
  const { normalizarDificultad, buildDificultad } = await import("../../assets/shared/hoja/js/dificultad.js");
  const { fragmentoConHuecos } = await import("../../assets/shared/hoja/js/huecos.js");
  const { codigoDeHoja, partesDelCodigo } = await import("../../assets/shared/hoja/js/codigoHoja.js");
  const { medirDesborde, textoDeDesborde, revisarAjuste, ALTO_FOLIO_MM } =
    await import("../../assets/shared/hoja/js/ajusteDelFolio.js");
  const { buildEsencial } = await import("../../assets/shared/hoja/js/bloqueEsencial.js");
  const { buildEjemplos } = await import("../../assets/shared/hoja/js/bloqueEjemplo.js");
  const { HOJA_ENTEROS_1ESO } = await import("../../assets/shared/hoja/muestras/enteros1eso.js");

  const doc = globalThis.document;
  const CSS = fs.readFileSync(`${RAIZ}assets/shared/hoja/styles/hoja.css`, "utf8");

  // ── La hoja se monta entera ──────────────────────────────────────────

  test("la hoja lleva cabecera, lo esencial, ejemplo, actividades y pie", () => {
    const hoja = buildHoja({ ...HOJA_ENTEROS_1ESO, codigo: "H-260914-01" }, { doc });
    assert.ok(hoja.querySelector(".hj-head"), "falta la cabecera");
    assert.ok(hoja.querySelector(".hj-esencial"), "falta el bloque de lo esencial");
    assert.ok(hoja.querySelector(".hj-ejemplo"), "falta el ejemplo resuelto");
    assert.ok(hoja.querySelector(".hj-actividades"), "faltan las actividades");
    assert.ok(hoja.querySelector(".hj-foot"), "falta el pie");
  });

  // El título grande es el OBJETIVO, no el tema: "números enteros" da para
  // cinco hojas y por eso no puede ser el título.
  test("el título grande es el objetivo y el tema va en la línea pequeña", () => {
    const hoja = buildHoja(HOJA_ENTEROS_1ESO, { doc });
    assert.equal(hoja.querySelector(".hj-title").textContent, "Sumar y restar números enteros");
    const linea = hoja.querySelector(".hj-head-materia").textContent;
    assert.ok(linea.includes("Números enteros"), `el tema no está en la línea: ${linea}`);
    assert.ok(linea.includes("1.º ESO"), `el curso no está en la línea: ${linea}`);
  });

  // El código es lo que une el papel con los datos, así que tiene que estar en
  // el DOM (para imprimir y para buscar) y a la vista en la hoja.
  test("el código de la hoja va en el dataset, en la cabecera y en el pie", () => {
    const hoja = buildHoja({ ...HOJA_ENTEROS_1ESO, codigo: "H-260914-07" }, { doc });
    assert.equal(hoja.dataset.codigo, "H-260914-07");
    assert.equal(hoja.querySelector(".hj-head-linea span:last-child").textContent, "H-260914-07");
    assert.equal(hoja.querySelector(".hj-foot-codigo").textContent, "H-260914-07");
  });

  test("cada actividad lleva su número de hueco, que es lo que se registra al corregir", () => {
    const hoja = buildHoja(HOJA_ENTEROS_1ESO, { doc });
    const ordenes = [...hoja.querySelectorAll(".hj-act")].map((a) => a.dataset.orden);
    assert.deepEqual(ordenes, ["1", "2", "3", "4", "5"]);
  });

  // ── Los topes: es lo que impide que la hoja se convierta en un libro ──

  test("las actividades se cortan en el tope, no se apilan sin fin", () => {
    const muchas = Array.from({ length: MAX_ACTIVIDADES + 5 }, (_, i) => ({ enunciado: `x${i}` }));
    const seccion = buildActividades(muchas, doc);
    assert.equal(seccion.querySelectorAll(".hj-act").length, MAX_ACTIVIDADES);
  });

  test("como mucho dos ejemplos resueltos y cuatro fórmulas", () => {
    assert.equal(buildEjemplos([{}, {}, {}, {}], doc).length, 2);
    const caja = buildEsencial({ formulas: [1, 2, 3, 4, 5, 6].map((n) => ({ tex: `x=${n}` })), doc });
    assert.equal(caja.querySelectorAll(".hj-formula").length, 4);
  });

  test("sin resumen y sin fórmulas no se pinta una caja vacía", () => {
    assert.equal(buildEsencial({ parrafos: [], formulas: [], doc }), null);
  });

  // ── La mezcla de ejercicios y problemas se tiene que VER ──────────────

  test("solo los problemas llevan etiqueta; el ejercicio normal no", () => {
    const problema = buildActividad({ enunciado: "x", tipo: "problema" }, 1, doc);
    const ejercicio = buildActividad({ enunciado: "x", tipo: "ejercicio" }, 2, doc);
    assert.equal(problema.querySelector(".hj-act-tipo")?.textContent, "Problema");
    assert.equal(ejercicio.querySelector(".hj-act-tipo"), null);
  });

  test("la hoja de muestra mezcla de verdad ejercicios y problemas", () => {
    const tipos = HOJA_ENTEROS_1ESO.actividades.map((a) => a.tipo);
    assert.ok(tipos.includes("problema"), "una hoja sin ningún problema está mal montada");
    assert.ok(tipos.includes("ejercicio"), "una hoja sin ningún ejercicio de técnica también");
  });

  test("la dificultad se queda entre 1 y 3 aunque llegue cualquier cosa", () => {
    assert.equal(normalizarDificultad(0), 1);
    assert.equal(normalizarDificultad(9), 3);
    assert.equal(normalizarDificultad("2"), 2);
    assert.equal(normalizarDificultad(undefined), 1);
    const dif = buildDificultad(2, doc);
    assert.equal(dif.querySelectorAll(".hj-dif-punto").length, 3);
    assert.equal(dif.querySelectorAll(".hj-dif-punto--on").length, 2);
  });

  // ── Huecos para contestar, sin inyectar HTML ─────────────────────────

  test("los guiones bajos se convierten en huecos subrayados", () => {
    const cont = doc.createElement("p");
    cont.appendChild(fragmentoConHuecos("El opuesto de -8 es ___", doc));
    assert.equal(cont.querySelectorAll(".hj-hueco").length, 1);
    assert.ok(cont.textContent.startsWith("El opuesto de -8 es"));
  });

  test("dos guiones bajos no son un hueco (así se puede escribir a__b sin sorpresas)", () => {
    const cont = doc.createElement("p");
    cont.appendChild(fragmentoConHuecos("a__b", doc));
    assert.equal(cont.querySelectorAll(".hj-hueco").length, 0);
  });

  // El enunciado lo va a escribir un modelo. Si algún día devuelve etiquetas,
  // tienen que salir impresas como texto, no ejecutarse.
  test("un enunciado con etiquetas no inyecta HTML", () => {
    const act = buildActividad({ enunciado: '<img src=x onerror="fallo()"> calcula' }, 1, doc);
    const enun = act.querySelector(".hj-act-enunciado");
    assert.equal(enun.querySelector("img"), null);
    assert.ok(enun.textContent.includes("<img"), "el texto tiene que salir literal");
  });

  // ── El código de la hoja ─────────────────────────────────────────────

  test("el código lleva la fecha dentro y se puede volver a leer", () => {
    const codigo = codigoDeHoja({ fecha: new Date(2026, 8, 14), secuencia: 3 });
    assert.equal(codigo, "H-260914-03");
    assert.deepEqual(partesDelCodigo(codigo), { anio: 2026, mes: 9, dia: 14, secuencia: 3 });
    assert.deepEqual(partesDelCodigo("h-260914-03"), { anio: 2026, mes: 9, dia: 14, secuencia: 3 });
    assert.equal(partesDelCodigo("H-2609-3"), null);
    assert.equal(partesDelCodigo(""), null);
  });

  // ── Cabe o no cabe en el folio ───────────────────────────────────────

  // Los altos se inyectan porque happy-dom no maqueta: lo que se prueba es la
  // regla, no la medición del navegador (esa se comprobó con Chromium).
  test("un folio justo cabe; pasarse 40mm no", () => {
    const folio = 1122.5; // 297mm a 96dpi
    assert.equal(medirDesborde(null, { alto: folio, folio }).cabe, true);
    assert.equal(medirDesborde(null, { alto: folio - 200, folio }).cabe, true);

    const pasado = medirDesborde(null, { alto: folio * 1.136, folio });
    assert.equal(pasado.cabe, false);
    assert.ok(pasado.desbordeMm > 39 && pasado.desbordeMm < 42, `desborde raro: ${pasado.desbordeMm}`);
    assert.equal(pasado.folios, 2);
  });

  // Medio milímetro es redondeo del navegador, no un ejercicio de sobra.
  test("un redondeo de medio milímetro no dispara el aviso", () => {
    const folio = 1122.5;
    assert.equal(medirDesborde(null, { alto: folio + 1, folio }).cabe, true);
  });

  test("el aviso dice qué hacer, y no propone reducir la letra", () => {
    const texto = textoDeDesborde({ desbordeMm: 44.7, folios: 2 });
    assert.ok(texto.includes("44.7"), texto);
    assert.ok(texto.includes("Quita un ejercicio"), texto);
    assert.ok(/no la letra/.test(texto), texto);
  });

  test("revisar dos veces no acumula avisos, y al arreglarlo desaparece", async () => {
    const folio = 1122.5;
    const cont = doc.createElement("div");
    const hoja = doc.createElement("article");
    cont.appendChild(hoja);

    await revisarAjuste(cont, hoja, { doc, alto: folio * 1.2, folio });
    await revisarAjuste(cont, hoja, { doc, alto: folio * 1.2, folio });
    assert.equal(cont.querySelectorAll(".hj-aviso").length, 1, "un aviso por hoja, no uno por revisión");

    // El aviso es para quien monta la hoja: nunca se imprime.
    assert.ok(cont.querySelector(".hj-aviso").className.includes("hj-no-imprimir"));

    await revisarAjuste(cont, hoja, { doc, alto: folio, folio });
    assert.equal(cont.querySelectorAll(".hj-aviso").length, 0, "arreglado el desborde, fuera el aviso");
  });

  test("el folio son 297mm y el CSS dice lo mismo", () => {
    assert.equal(ALTO_FOLIO_MM, 297);
    assert.ok(/width:\s*210mm/.test(CSS), "la hoja tiene que medir 210mm de ancho");
    assert.ok(/min-height:\s*297mm/.test(CSS), "y 297mm de alto");
    assert.ok(/@page\s*\{\s*size:\s*A4 portrait/.test(CSS), "el folio se imprime en A4 vertical");
  });

  // ── Ninguna clase fantasma ───────────────────────────────────────────

  // Mismo criterio que ya se usó con el cuadrante: si el JS pinta una clase que
  // el CSS no conoce, ese trozo sale sin estilo y en papel no hay arreglo.
  test("todas las clases que pinta el JS existen en hoja.css", () => {
    const dir = `${RAIZ}assets/shared/hoja/js/`;
    const usadas = new Set();
    for (const f of fs.readdirSync(dir)) {
      const src = fs.readFileSync(`${dir}${f}`, "utf8");
      for (const m of src.matchAll(/"(hj-[a-z0-9-]+(?:\s+hj-[a-z0-9-]+)*)"/g)) {
        m[1].split(/\s+/).forEach((c) => usadas.add(c));
      }
      for (const m of src.matchAll(/`(hj-[a-z0-9-]+)/g)) usadas.add(m[1]);
    }
    usadas.add("hoja");
    // Marcadores sin estilo, a propósito: no pintan nada, le dicen algo a otro
    // programa. `hj-no-formulas` le dice a KaTeX "aquí no busques fórmulas"
    // (para que "5 $ de descuento" en un problema de dinero no se interprete).
    const MARCADORES = new Set(["hj-no-formulas"]);
    const fantasmas = [...usadas].filter((c) => !MARCADORES.has(c) && !CSS.includes(`.${c}`));
    assert.deepEqual(fantasmas, [], `clases sin estilo: ${fantasmas.join(", ")}`);
  });
}
