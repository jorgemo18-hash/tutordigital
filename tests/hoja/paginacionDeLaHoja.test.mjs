import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// DÓNDE CAEN LOS SALTOS DE PÁGINA.
//
// Esta pieza existe porque dividir la altura total entre el alto de un folio
// MIENTE, y se vio midiendo: con diez actividades la cuenta daba dos folios y
// Chrome imprimía tres. El motivo es que una actividad no se parte
// (`break-inside: avoid`), así que la que no cabe abajo se va entera a la
// página siguiente y deja un hueco blanco que la altura total no recoge.
//
// Lo que se prueba aquí es el reparto, con números inyectados: la medición
// real se comprobó con Chromium contra los folios que imprime de verdad, en
// once hojas de tamaños distintos.
export async function run({ test, assert }) {
  const { repartirEnFolios, medirPiezas } = await import(
    "../../assets/shared/hoja/js/paginacionDeLaHoja.js"
  );

  const UTIL = 275; // milímetros útiles por folio; aquí la unidad da igual

  test("lo que entra en un folio va en un folio", () => {
    const r = repartirEnFolios({
      utilPx: UTIL,
      cabeceraPx: 60,
      actividadesPx: [35, 35, 35, 35],
      piePx: 8,
    });
    assert.equal(r.folios, 1);
    assert.equal(r.usadoUltimoPx, 60 + 140 + 8);
  });

  test("LA CABECERA SOLO OCUPA EL PRIMER FOLIO", () => {
    // El título, los datos del alumno y "lo esencial" van una vez. Si se
    // contaran en todos, una hoja de dos folios saldría como tres.
    const unFolio = repartirEnFolios({ utilPx: UTIL, cabeceraPx: 200, actividadesPx: [70], piePx: 0 });
    assert.equal(unFolio.folios, 1, "200 + 70 = 270, cabe");

    const dos = repartirEnFolios({
      utilPx: UTIL,
      cabeceraPx: 200,
      actividadesPx: [70, 70, 70],
      piePx: 0,
    });
    // Folio 1: cabecera 200 + una actividad de 70 = 270. Folio 2: las otras
    // dos, 140 — que es menos de 275 porque la cabecera ya no cuenta.
    assert.equal(dos.folios, 2);
    assert.equal(dos.usadoUltimoPx, 140);
  });

  test("UNA ACTIVIDAD QUE NO CABE SE VA ENTERA, y su hueco se pierde", () => {
    // Es la diferencia entre simular y sumar. Con piezas de 140 solo cabe
    // una por folio: cuatro actividades son cuatro folios, mientras que
    // dividir 560 entre 275 daría tres.
    const r = repartirEnFolios({ utilPx: UTIL, cabeceraPx: 0, actividadesPx: [140, 140, 140, 140] });
    assert.equal(r.folios, 4);
    assert.deepEqual(r.reparto, [[1], [2], [3], [4]]);
  });

  test("EL PIE TAMBIÉN PUEDE BUMPEAR un folio él solo", () => {
    // El pie va al final del flujo, así que si no entra abre folio. Una hoja
    // cuyo último folio lleva SOLO el pie es el peor resultado posible: una
    // cara de papel con la marca y el código.
    const r = repartirEnFolios({ utilPx: UTIL, cabeceraPx: 0, actividadesPx: [270], piePx: 10 });
    assert.equal(r.folios, 2);
    assert.equal(r.usadoUltimoPx, 10);
    assert.deepEqual(r.reparto, [[1], ["pie"]]);
  });

  test("el reparto dice QUÉ actividad va en cada folio", () => {
    // No es decoración: el montador necesita saber si la actividad 5 cae al
    // principio del segundo folio o al final del primero.
    const r = repartirEnFolios({
      utilPx: UTIL,
      cabeceraPx: 100,
      actividadesPx: [50, 50, 50, 50, 50],
      piePx: 0,
    });
    // Folio 1: cabecera 100 + tres de 50 = 250. La cuarta no entra en 25.
    assert.deepEqual(r.reparto, [[1, 2, 3], [4, 5]]);
    assert.equal(r.folios, 2);
  });

  test("una pieza más alta que el folio no abre folios sin fin", () => {
    // El navegador la partirá de todas formas; lo que no puede pasar es que
    // la simulación se quede dando vueltas o devuelva un número absurdo.
    const r = repartirEnFolios({ utilPx: UTIL, cabeceraPx: 0, actividadesPx: [400], piePx: 0 });
    assert.equal(r.folios, 1);
    assert.ok(r.usadoUltimoPx >= 275, `usó ${r.usadoUltimoPx}`);
  });

  test("sin alto útil no se inventa nada", () => {
    assert.equal(repartirEnFolios({ utilPx: 0, actividadesPx: [10] }).folios, 1);
    assert.deepEqual(repartirEnFolios({ utilPx: 0, actividadesPx: [10] }).reparto, []);
  });

  test("sin actividades, la hoja es la cabecera y el pie", () => {
    const r = repartirEnFolios({ utilPx: UTIL, cabeceraPx: 60, actividadesPx: [], piePx: 8 });
    assert.equal(r.folios, 1);
    assert.equal(r.usadoUltimoPx, 68);
  });

  test("medirPiezas no revienta con una hoja vacía", () => {
    // En happy-dom no hay maquetación, así que lo que se prueba es que
    // devuelve la forma correcta y no que los números sean buenos.
    const vacia = document.createElement("article");
    const p = medirPiezas(vacia, document);
    assert.deepEqual(p.actividadesPx, []);
    assert.equal(p.cabeceraPx, 0);
    assert.equal(p.piePx, 0);

    const nada = medirPiezas(null, document);
    assert.deepEqual(nada.actividadesPx, []);
  });

  test("medirPiezas cuenta UNA entrada por actividad", () => {
    const hoja = document.createElement("article");
    hoja.innerHTML = '<div class="hj-act"></div><div class="hj-act"></div>'
      + '<footer class="hj-foot"></footer>';
    assert.equal(medirPiezas(hoja, document).actividadesPx.length, 2);
  });
}
