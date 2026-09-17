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
  const {
    medirFolios, textoDeFolios, revisarAjuste,
    ALTO_FOLIO_MM, MINIMO_ULTIMO_FOLIO_MM, MARGEN_DE_DUDA_MM,
  } = await import("../../assets/shared/hoja/js/ajusteDelFolio.js");
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

  // ── El apartado resuelto que sirve de ejemplo ────────────────────────

  test("un apartado en OBJETO sale marcado como ejemplo; uno en cadena, normal", () => {
    // Las dos formas conviven a propósito: la hoja escrita a mano usa cadenas.
    const act = buildActividad({
      enunciado: "Calcula:",
      columnas: 2,
      apartados: [
        { texto: "$(-7) \\cdot 10=-70$", resuelto: true, explicacion: "Signos distintos." },
        "$2 \\cdot (-7)=$ ___",
      ],
    }, 1, doc);

    const items = act.querySelectorAll(".hj-apartado");
    assert.equal(items.length, 2);
    assert.ok(items[0].className.includes("hj-apartado--resuelto"), "el ejemplo no está marcado");
    assert.equal(items[1].className.includes("hj-apartado--resuelto"), false);

    // LA PALABRA TIENE QUE ESTAR: en fotocopia en blanco y negro el fondo gris
    // casi no se ve, así que la etiqueta es lo único que distingue el ejemplo
    // de un ejercicio que alguien ya hizo.
    assert.equal(act.querySelector(".hj-apartado-marca")?.textContent, "Ejemplo");
    assert.ok(act.querySelector(".hj-apartado-razon")?.textContent.includes("Signos distintos"));
  });

  test("EL EJEMPLO OCUPA TODAS LAS COLUMNAS de la batería", () => {
    // En el folio impreso, con la batería a dos columnas, el ejemplo se quedó
    // en la izquierda y el apartado b) se subió a su derecha DENTRO de la
    // misma fila: leído en papel parecía que b) formaba parte del ejemplo.
    // El ejemplo es la cabecera de la batería, no uno de sus dos primeros
    // huecos.
    assert.ok(
      /\.hj-apartado--resuelto\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/.test(CSS),
      "el apartado resuelto tiene que ocupar la fila entera",
    );
  });

  test("un apartado resuelto sin explicación no rompe nada", () => {
    const act = buildActividad({
      enunciado: "Calcula:",
      apartados: [{ texto: "$1+1=2$", resuelto: true }],
    }, 1, doc);
    assert.ok(act.querySelector(".hj-apartado--resuelto"), "sigue siendo el ejemplo");
    assert.equal(act.querySelector(".hj-apartado-razon"), null, "sin explicación, sin línea");
  });

  test("el texto del ejemplo tampoco inyecta HTML", () => {
    // Misma regla que el enunciado: el apartado resuelto y su explicación
    // pasan por el mismo camino, y la explicación la genera código nuestro
    // hoy pero la de los problemas la generará un modelo.
    const act = buildActividad({
      enunciado: "x",
      apartados: [{
        texto: '<img src=x onerror="fallo()">',
        resuelto: true,
        explicacion: '<script>fallo()</script>',
      }],
    }, 1, doc);
    assert.equal(act.querySelectorAll("img").length, 0, "se ha inyectado una imagen");
    assert.equal(act.querySelectorAll("script").length, 0, "se ha inyectado un script");
  });

  // ── En cuántos folios va, y cómo queda el último ─────────────────────
  //
  // CAMBIO DE CRITERIO (Jorge, 17/9): dos folios es un resultado legítimo, no
  // un error. Lo que hay que avisar es el folio DESPERDICIADO: una actividad
  // sola en la segunda hoja. Así que estos tests ya no comprueban "cabe", que
  // era la pregunta anterior.

  // Los altos se inyectan porque happy-dom no maqueta: lo que se prueba es la
  // regla, no la medición del navegador (esa se comprobó con Chromium).
  const FOLIO = 1122.5; // 297mm a 96dpi

  test("un folio justo es un folio, y pasarse un poco son dos", () => {
    assert.equal(medirFolios(null, { alto: FOLIO, folio: FOLIO }).folios, 1);
    assert.equal(medirFolios(null, { alto: FOLIO - 200, folio: FOLIO }).folios, 1);
    assert.equal(medirFolios(null, { alto: FOLIO * 1.136, folio: FOLIO }).folios, 2);
    assert.equal(medirFolios(null, { alto: FOLIO * 2.5, folio: FOLIO }).folios, 3);
  });

  // Medio milímetro es redondeo del navegador, no una actividad de sobra.
  test("un redondeo de medio milímetro no convierte una hoja en dos", () => {
    assert.equal(medirFolios(null, { alto: FOLIO + 1, folio: FOLIO }).folios, 1);
  });

  test("se mide cuánto se usa del ÚLTIMO folio, no cuánto se pasa del primero", () => {
    // Es el cambio de fondo: antes esto devolvía "se sale 40mm". Lo que le
    // sirve a quien monta la hoja es "la segunda hoja lleva 40mm de 297".
    const dos = medirFolios(null, { alto: FOLIO * 1.136, folio: FOLIO });
    assert.ok(dos.usadoUltimoMm > 39 && dos.usadoUltimoMm < 42, `raro: ${dos.usadoUltimoMm}`);
  });

  test("EL CASO QUE HAY QUE AVISAR: un folio gastado en una actividad", () => {
    // 44mm de desborde saca un segundo folio con una actividad y un palmo de
    // blanco. El profesor gasta dos hojas de papel para lo que cabía en una y
    // pico, y en pantalla no se ve porque la página sigue hacia abajo.
    const malo = medirFolios(null, { alto: FOLIO * 1.15, folio: FOLIO });
    assert.equal(malo.desaprovechado, true, `usó ${malo.usadoUltimoMm}mm`);
    const texto = textoDeFolios(malo);
    assert.ok(texto.includes("casi vacío"), texto);
    // Las dos salidas, porque las dos son válidas.
    assert.ok(texto.includes("Quita un ejercicio"), texto);
    assert.ok(texto.includes("añade otro"), texto);
    assert.ok(/no reduzcas la letra/.test(texto), texto);
  });

  test("dos folios bien aprovechados NO son un aviso: son un dato", () => {
    // Antes esto salía en rojo diciendo "quita un ejercicio". Con el criterio
    // nuevo es información y va en gris.
    const bien = medirFolios(null, { alto: FOLIO * 1.6, folio: FOLIO });
    assert.equal(bien.folios, 2);
    assert.equal(bien.desaprovechado, false, `usó ${bien.usadoUltimoMm}mm`);
    const texto = textoDeFolios(bien);
    assert.ok(texto.includes("Va en 2 folios"), texto);
    assert.equal(/Quita un ejercicio/.test(texto), false, "no es una queja: " + texto);
  });

  test("un folio solo no dice nada", () => {
    const uno = medirFolios(null, { alto: FOLIO * 0.9, folio: FOLIO });
    assert.equal(uno.desaprovechado, false);
    assert.equal(textoDeFolios(uno), "");
  });

  test("el umbral del folio gastado es un cuarto de folio largo, no un número suelto", () => {
    assert.ok(
      MINIMO_ULTIMO_FOLIO_MM > ALTO_FOLIO_MM / 5 && MINIMO_ULTIMO_FOLIO_MM < ALTO_FOLIO_MM / 3,
      `umbral raro: ${MINIMO_ULTIMO_FOLIO_MM}`,
    );
  });

  test("LOS MÁRGENES DE @page Y LOS DE LA HOJA TIENEN QUE SER LOS MISMOS", () => {
    // Están escritos dos veces a la fuerza: `@page` no es un elemento, así que
    // no hereda las variables CSS y `margin: var(--hj-margen-alto)` es una
    // declaración inválida — el margen cae a 0 y la hoja sale pegada al canto
    // del papel. Lo comprobé imprimiendo con Chromium y mirando los píxeles.
    // Este test es lo que impide que los dos juegos de números se separen.
    const vars = {
      alto: /--hj-margen-alto:\s*([\d.]+)mm/.exec(CSS)?.[1],
      ancho: /--hj-margen-ancho:\s*([\d.]+)mm/.exec(CSS)?.[1],
      bajo: /--hj-margen-bajo:\s*([\d.]+)mm/.exec(CSS)?.[1],
    };
    assert.ok(vars.alto && vars.ancho && vars.bajo, "faltan las variables de margen");
    const page = /@page\s*\{[^}]*margin:\s*([\d.]+)mm\s+([\d.]+)mm\s+([\d.]+)mm/.exec(CSS);
    assert.ok(page, "@page tiene que llevar los tres márgenes en milímetros literales");
    assert.equal(page[1], vars.alto, "el margen de arriba no coincide");
    assert.equal(page[2], vars.ancho, "el margen de los lados no coincide");
    assert.equal(page[3], vars.bajo, "el margen de abajo no coincide");
    // Y nunca con una variable, porque ahí no se ve: falla en silencio.
    assert.equal(
      /@page\s*\{[^}]*margin:[^;}]*var\(/.test(CSS),
      false,
      "@page no puede leer variables CSS",
    );
  });

  test("EN EL LÍMITE: no se afirma el número de folios cuando no se sabe", () => {
    // Comparé esta función con los folios que Chrome imprime de verdad sobre
    // siete hojas. Coinciden las siete, pero a 6 mm del borde la maquetación
    // de pantalla y la de impresión ya redondean distinto, así que dentro de
    // esta franja el número es una estimación y el mensaje lo dice.
    const justo = medirFolios(null, { alto: FOLIO * 1.02, folio: FOLIO, margen: 0 });
    assert.equal(justo.enElLimite, true, `usó ${justo.usadoUltimoMm}mm`);
    const texto = textoDeFolios(justo);
    assert.ok(texto.includes("justo en el límite"), texto);
    assert.ok(/puede salir en 1 o en 2/.test(texto), texto);
    assert.equal(/^Va en 2 folios/.test(texto), false, "no puede afirmarlo: " + texto);

    // Y fuera de la franja sí se afirma.
    const claro = medirFolios(null, { alto: FOLIO * 1.6, folio: FOLIO, margen: 0 });
    assert.equal(claro.enElLimite, false);
    assert.ok(MARGEN_DE_DUDA_MM > 5 && MARGEN_DE_DUDA_MM < MINIMO_ULTIMO_FOLIO_MM);
  });

  test("los folios se cuentan sobre el alto ÚTIL, descontando los márgenes", () => {
    // Con el margen en `@page`, cada folio pierde los dos márgenes: caben 275
    // mm de contenido, no 297. Contar sobre 297 coincide por casualidad en un
    // folio y miente en tres.
    const margen = 22 * (FOLIO / ALTO_FOLIO_MM); // 22mm en píxeles
    const tres = medirFolios(null, { alto: margen + FOLIO * (560 / ALTO_FOLIO_MM), folio: FOLIO, margen });
    assert.equal(tres.folios, 3, `560mm de contenido son 3 folios de 275, no ${tres.folios}`);
    assert.ok(tres.utilPorFolioMm > 274 && tres.utilPorFolioMm < 276, `útil: ${tres.utilPorFolioMm}`);
  });

  test("el folio desperdiciado va en rojo y los dos folios normales en gris", async () => {
    const cont = doc.createElement("div");
    const hoja = doc.createElement("article");
    cont.appendChild(hoja);

    await revisarAjuste(cont, hoja, { doc, alto: FOLIO * 1.15, folio: FOLIO });
    assert.equal(cont.querySelectorAll(".hj-aviso").length, 1, "el folio gastado es un aviso");
    assert.equal(cont.querySelectorAll(".hj-nota").length, 0);

    await revisarAjuste(cont, hoja, { doc, alto: FOLIO * 1.6, folio: FOLIO });
    assert.equal(cont.querySelectorAll(".hj-aviso").length, 0, "dos folios llenos no son un aviso");
    assert.equal(cont.querySelectorAll(".hj-nota").length, 1, "pero sí una nota");
  });

  test("revisar dos veces no acumula notas, y al arreglarlo desaparece", async () => {
    const cont = doc.createElement("div");
    const hoja = doc.createElement("article");
    cont.appendChild(hoja);

    await revisarAjuste(cont, hoja, { doc, alto: FOLIO * 1.15, folio: FOLIO });
    await revisarAjuste(cont, hoja, { doc, alto: FOLIO * 1.15, folio: FOLIO });
    assert.equal(cont.querySelectorAll(".hj-aviso").length, 1, "uno por hoja, no uno por revisión");

    // La nota es para quien monta la hoja: nunca se imprime.
    assert.ok(cont.querySelector(".hj-aviso").className.includes("hj-no-imprimir"));

    await revisarAjuste(cont, hoja, { doc, alto: FOLIO, folio: FOLIO });
    assert.equal(cont.querySelectorAll(".hj-aviso, .hj-nota").length, 0, "en un folio, sin nota");
  });

  test("el CSS distingue los dos estados, y ninguna actividad se parte entre folios", () => {
    assert.ok(/\.hj-nota\s*\{[^}]*background/.test(CSS), "la nota gris necesita su propio fondo");
    assert.ok(/\.hj-aviso\s*\{[^}]*background:\s*#fbeceb/.test(CSS), "el aviso sigue en rojo");
    // Con hojas de dos folios esto pasa de detalle a requisito: sin él, el
    // enunciado se queda en una hoja y los apartados c) y d) en la siguiente.
    assert.ok(
      /\.hj-act[^{]*\{\s*break-inside:\s*avoid/.test(CSS),
      "una actividad no puede partirse entre folios",
    );
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
