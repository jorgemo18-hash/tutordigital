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

  test("el título de bloque se pinta DENTRO de la actividad que encabeza", () => {
    // Dentro y no delante: es lo que impide que se quede huérfano al pie de un
    // folio (`break-inside: avoid` va en `.hj-act`) y lo que hace que la
    // medición de folios lo cuente sin saber que existe.
    const act = buildActividad({ enunciado: "Calcula:", bloque: "Potencias" }, 7, doc);
    const tit = act.querySelector(".hj-bloque-tit");
    assert.ok(tit, "no se ha pintado el título de bloque");
    assert.equal(tit.textContent, "Potencias");
    assert.equal(tit.parentElement, act, "el título tiene que colgar de la actividad");
    assert.equal(act.firstChild, tit, "el título va antes que el número");
    // Y el número sigue siendo el de la hoja, no el del bloque.
    assert.equal(act.dataset.orden, "7");
    assert.equal(act.querySelector(".hj-act-num").textContent, "7");
  });

  test("sin bloque no se pinta ningún título", () => {
    const act = buildActividad({ enunciado: "Calcula:" }, 2, doc);
    assert.equal(act.querySelector(".hj-bloque-tit"), null);
  });

  test("un título de bloque con etiquetas no inyecta HTML", () => {
    const act = buildActividad({ enunciado: "x", bloque: '<img src=x onerror="fallo()">' }, 1, doc);
    assert.equal(act.querySelector("img"), null);
    assert.ok(act.querySelector(".hj-bloque-tit").textContent.includes("<img"));
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
  // DOS CAMBIOS DE MODELO, y los tests van por el segundo.
  //
  // Primero (Jorge, 17/9): dos folios es un resultado legítimo, no un error.
  // Lo que hay que avisar es el folio DESPERDICIADO.
  //
  // Y después: la cuenta ya no divide la altura total, SIMULA los saltos de
  // página, porque una actividad no se parte y la que no cabe abajo se va
  // entera a la siguiente dejando un hueco. Por eso estos tests inyectan las
  // PIEZAS de la hoja —cabecera, cada actividad, pie— y no un alto total: es
  // lo que el modelo necesita y, de paso, permite expresar el caso que antes
  // no se podía escribir.

  // Las medidas se inyectan porque happy-dom no maqueta: lo que se prueba es
  // la regla, no la medición del navegador (esa se comprobó con Chromium
  // contra los folios que imprime de verdad).
  const FOLIO = 1122.5; // 297mm a 96dpi
  const MARGEN = 22 * (FOLIO / ALTO_FOLIO_MM); // los 12mm + 10mm de @page
  const UTIL = FOLIO - MARGEN; // 275mm de contenido por folio
  const mm = (n) => n * (FOLIO / ALTO_FOLIO_MM);

  // Una hoja con `n` actividades iguales de `altoMm` cada una.
  const conActividades = (n, altoMm, { cabeceraMm = 60, pieMm = 8 } = {}) => medirFolios(null, {
    folio: FOLIO,
    margen: MARGEN,
    piezas: {
      cabeceraPx: mm(cabeceraMm),
      actividadesPx: Array.from({ length: n }, () => mm(altoMm)),
      piePx: mm(pieMm),
    },
  });

  test("lo que cabe en un folio es un folio", () => {
    // Cabecera 60 + 4 actividades de 35 + pie 8 = 208 de 275.
    assert.equal(conActividades(4, 35).folios, 1);
    assert.equal(conActividades(1, 35).folios, 1);
  });

  test("UNA ACTIVIDAD QUE NO CABE ABAJO SE VA ENTERA al folio siguiente", () => {
    // EL CASO QUE DISTINGUE SIMULAR DE SUMAR, y el que hacía mentir al modelo
    // viejo. Con actividades de 140 mm solo cabe UNA por folio: la segunda
    // necesita 140 y solo quedan 135. Cuatro actividades son CUATRO folios.
    //
    // Dividiendo la altura total —4 × 140 = 560— entre los 275 útiles
    // saldrían TRES. El hueco que deja cada actividad bumpeada no está en la
    // altura total, y por eso hay que simular el reparto.
    //
    // (Mi primera versión de este test usaba actividades de 40 mm y no
    // distinguía nada: 60 + 200 + 8 = 268 cabe en un folio por los dos
    // modelos. La divergencia necesita piezas de más de medio folio.)
    const m = conActividades(4, 140, { cabeceraMm: 0, pieMm: 0 });
    assert.equal(m.folios, 4, `usó ${m.usadoUltimoMm}mm`);
    assert.equal(Math.round(m.usadoUltimoMm), 140);
  });

  test("se mide cuánto se usa del ÚLTIMO folio", () => {
    // Lo que le sirve a quien monta la hoja es "la segunda hoja lleva 48mm de
    // 275", no "se pasa 48mm del primero".
    //
    // Cabecera 60 + 5 actividades de 40 = 260 y el pie de 8 caben en el
    // primer folio (268 de 275). La sexta actividad no, así que se va al
    // segundo con el pie detrás: 40 + 8 = 48.
    const m = conActividades(6, 40);
    assert.equal(m.folios, 2);
    assert.ok(m.usadoUltimoMm > 45 && m.usadoUltimoMm < 52, `raro: ${m.usadoUltimoMm}`);
    assert.ok(m.utilPorFolioMm > 274 && m.utilPorFolioMm < 276, `útil: ${m.utilPorFolioMm}`);
  });

  test("EL CASO QUE HAY QUE AVISAR: un folio gastado en una actividad", () => {
    // Una actividad sola en la segunda hoja gasta un folio de papel para lo
    // que cabía en uno y pico, y en pantalla no se ve porque la página sigue
    // hacia abajo.
    const malo = conActividades(6, 38, { cabeceraMm: 60 });
    assert.equal(malo.folios, 2);
    assert.equal(malo.desaprovechado, true, `usó ${malo.usadoUltimoMm}mm`);
    const texto = textoDeFolios(malo);
    assert.ok(texto.includes("casi vacío"), texto);
    assert.ok(texto.includes("Quita un ejercicio"), texto);
    assert.ok(texto.includes("añade otro"), texto);
    assert.ok(/no reduzcas la letra/.test(texto), texto);
  });

  test("dos folios bien aprovechados NO son un aviso: son un dato", () => {
    const bien = conActividades(9, 40, { cabeceraMm: 60 });
    assert.equal(bien.folios, 2);
    assert.equal(bien.desaprovechado, false, `usó ${bien.usadoUltimoMm}mm`);
    const texto = textoDeFolios(bien);
    assert.ok(texto.includes("Va en 2 folios"), texto);
    assert.equal(/Quita un ejercicio/.test(texto), false, "no es una queja: " + texto);
  });

  test("un folio solo no dice nada", () => {
    const uno = conActividades(3, 35);
    assert.equal(uno.folios, 1);
    assert.equal(uno.desaprovechado, false);
    assert.equal(textoDeFolios(uno), "");
  });

  test("EN EL LÍMITE: no se afirma el número de folios cuando no se sabe", () => {
    // Comparé esta función con los folios que Chrome imprime de verdad sobre
    // once hojas de distinto tamaño. Coinciden las once, pero muy cerca del
    // borde la maquetación de pantalla y la de impresión redondean distinto,
    // así que dentro de esta franja el número es una estimación y el mensaje
    // lo dice.
    const justo = medirFolios(null, {
      folio: FOLIO,
      margen: MARGEN,
      // Una actividad pequeña que se pasa por poco, con el pie detrás. (Con
      // solo el pie pasándose ya no hay duda: se imprime sin pie, ver el
      // test "EL PIE NO ABRE UN FOLIO ÉL SOLO".)
      piezas: { cabeceraPx: mm(60), actividadesPx: [mm(212), mm(5)], piePx: mm(8) },
    });
    assert.equal(justo.folios, 2);
    assert.equal(justo.enElLimite, true, `usó ${justo.usadoUltimoMm}mm`);
    const texto = textoDeFolios(justo);
    assert.ok(texto.includes("justo en el límite"), texto);
    assert.ok(/puede salir en 1 o en 2/.test(texto), texto);
    assert.equal(/^Va en 2 folios/.test(texto), false, "no puede afirmarlo: " + texto);
    assert.ok(MARGEN_DE_DUDA_MM > 5 && MARGEN_DE_DUDA_MM < MINIMO_ULTIMO_FOLIO_MM);
  });

  test("el alto útil descuenta los márgenes: 275mm por folio, no 297", () => {
    // Con el margen en `@page`, cada folio pierde los dos márgenes. Contar
    // sobre 297 coincide por casualidad en un folio y miente en tres.
    const m = conActividades(1, 10);
    assert.ok(m.utilPorFolioMm > 274 && m.utilPorFolioMm < 276, `útil: ${m.utilPorFolioMm}`);
    // Una actividad de 270mm cabe en el folio con la cabecera fuera; una de
    // 280 no cabe en ningún folio.
    assert.equal(medirFolios(null, {
      folio: FOLIO, margen: MARGEN,
      piezas: { cabeceraPx: 0, actividadesPx: [mm(270)], piePx: 0 },
    }).folios, 1);
  });

  test("EL PIE NO ABRE UN FOLIO ÉL SOLO: se imprime sin pie y la hoja cuenta un folio menos", async () => {
    // 60 de cabecera + 3 × 70 = 270 de 275: el pie de 8 ya no cabe y se iría
    // solo al folio 2. Pasó imprimiendo una hoja de ocho ejercicios.
    const medida = conActividades(3, 70);
    assert.equal(medida.pieSuelto, true);
    assert.equal(medida.folios, 1);
    // CON TOLERANCIA: 60 + 3 × 68 = 264, y el pie de 8 cabría con 3 mm de
    // sobra. En pantalla cabe; impreso, por redondeos, puede no caber (pasó
    // con 1,7 mm). Se trata como suelto.
    assert.equal(conActividades(3, 68).pieSuelto, true);
    assert.equal(conActividades(3, 60).pieSuelto, false, "con holgura de verdad el pie se queda");
    // Si con el pie hay más cosas en el último folio, el pie se queda.
    assert.equal(conActividades(4, 70).pieSuelto, false);

    const cont = doc.createElement("div");
    const hoja = doc.createElement("article");
    const pie = doc.createElement("footer");
    pie.className = "hj-foot";
    hoja.appendChild(pie);
    cont.appendChild(hoja);
    const piezas = (n) => ({ cabeceraPx: mm(60), actividadesPx: Array.from({ length: n }, () => mm(70)), piePx: mm(8) });
    await revisarAjuste(cont, hoja, { doc, folio: FOLIO, margen: MARGEN, piezas: piezas(3) });
    assert.ok(pie.classList.contains("hj-foot--suelto"));
    await revisarAjuste(cont, hoja, { doc, folio: FOLIO, margen: MARGEN, piezas: piezas(2) });
    assert.ok(!pie.classList.contains("hj-foot--suelto"), "al cambiar la hoja, el pie vuelve");
  });

  test("el folio desperdiciado va en rojo y los dos folios normales en gris", async () => {
    const cont = doc.createElement("div");
    const hoja = doc.createElement("article");
    cont.appendChild(hoja);
    const piezas = (n, altoMm) => ({
      cabeceraPx: mm(60),
      actividadesPx: Array.from({ length: n }, () => mm(altoMm)),
      piePx: mm(8),
    });

    await revisarAjuste(cont, hoja, { doc, folio: FOLIO, margen: MARGEN, piezas: piezas(6, 38) });
    assert.equal(cont.querySelectorAll(".hj-aviso").length, 1, "el folio gastado es un aviso");
    assert.equal(cont.querySelectorAll(".hj-nota").length, 0);

    await revisarAjuste(cont, hoja, { doc, folio: FOLIO, margen: MARGEN, piezas: piezas(9, 40) });
    assert.equal(cont.querySelectorAll(".hj-aviso").length, 0, "dos folios llenos no son un aviso");
    assert.equal(cont.querySelectorAll(".hj-nota").length, 1, "pero sí una nota");
  });

  test("revisar dos veces no acumula notas, y al arreglarlo desaparece", async () => {
    const cont = doc.createElement("div");
    const hoja = doc.createElement("article");
    cont.appendChild(hoja);
    const gastado = {
      cabeceraPx: mm(60),
      actividadesPx: Array.from({ length: 6 }, () => mm(38)),
      piePx: mm(8),
    };
    const cabe = { cabeceraPx: mm(60), actividadesPx: [mm(35), mm(35)], piePx: mm(8) };

    await revisarAjuste(cont, hoja, { doc, folio: FOLIO, margen: MARGEN, piezas: gastado });
    await revisarAjuste(cont, hoja, { doc, folio: FOLIO, margen: MARGEN, piezas: gastado });
    assert.equal(cont.querySelectorAll(".hj-aviso").length, 1, "uno por hoja, no uno por revisión");

    // La nota es para quien monta la hoja: nunca se imprime.
    assert.ok(cont.querySelector(".hj-aviso").className.includes("hj-no-imprimir"));

    await revisarAjuste(cont, hoja, { doc, folio: FOLIO, margen: MARGEN, piezas: cabe });
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

  test("LOS MÁRGENES DE `@page` Y LAS VARIABLES DICEN EL MISMO NÚMERO", () => {
    // ESTE TEST FALTABA, y el comentario de hoja.css afirmaba que existía.
    //
    // Los números del margen están escritos DOS VECES a la fuerza: en las
    // variables (que en pantalla son el padding de la hoja) y literales
    // dentro de `@page`, porque `@page` no es un elemento y no hereda
    // variables CSS. Escribirlo con `var()` deja el margen en 0 y la hoja
    // sale pegada al canto del papel.
    //
    // El día que se cambie uno y no el otro, la pantalla y el papel dejan de
    // coincidir y la medición de folios —que lee el padding de pantalla para
    // predecir la impresión— empieza a mentir sin que falle nada. Me pasó
    // cambiando el margen de abajo: los tests siguieron verdes porque las
    // medidas se inyectan.
    const variables = Object.fromEntries(
      ["alto", "ancho", "bajo"].map((cual) => {
        const m = CSS.match(new RegExp(`--hj-margen-${cual}:\\s*([0-9.]+)mm`));
        assert.ok(m, `no se encuentra --hj-margen-${cual}`);
        return [cual, Number(m[1])];
      }),
    );
    const enPagina = CSS.match(/@page\s*\{[^}]*margin:\s*([0-9.]+)mm\s+([0-9.]+)mm\s+([0-9.]+)mm/);
    assert.ok(enPagina, "`@page` tiene que llevar los tres márgenes literales");
    assert.deepEqual(
      enPagina.slice(1, 4).map(Number),
      [variables.alto, variables.ancho, variables.bajo],
      "los márgenes de @page no coinciden con las variables",
    );

    // Y lo que estos tests usan como margen inyectado es esa misma suma: si
    // no, se estaría probando una hoja que no existe.
    assert.equal(
      Math.round(MARGEN / (FOLIO / ALTO_FOLIO_MM)),
      variables.alto + variables.bajo,
      "el margen inyectado en estos tests no es el del CSS",
    );
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
