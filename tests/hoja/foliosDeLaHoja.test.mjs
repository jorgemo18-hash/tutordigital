import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// LA HOJA PARTIDA EN FOLIOS DE VERDAD (assets/shared/hoja/js/foliosDeLaHoja.js).
// happy-dom no maqueta: las alturas se inyectan, como en el resto de tests de
// paginación. Lo que se prueba es la regla y que los nodos acaban donde deben.
export async function run({ test, assert }) {
  const { partirEnFolios } = await import("../../assets/shared/hoja/js/foliosDeLaHoja.js");
  const { buildHoja } = await import("../../assets/shared/hoja/js/hojaDeEjercicios.js");
  const doc = window.document;
  const FOLIO = 1122.5;
  const mm = (n) => n * (FOLIO / 297);
  const MARGEN = mm(20);

  function montar(n) {
    const cont = doc.createElement("div");
    const hoja = buildHoja({
      objetivo: "Obj", centro: "Lyceo",
      actividades: Array.from({ length: n }, (_, i) => ({ enunciado: `E${i + 1}`, apartados: ["x"] })),
    }, { doc, pantalla: false });
    cont.appendChild(hoja);
    return { cont, hoja };
  }
  const piezas = (cabecera, alturas, pie = 8) => ({ cabeceraPx: mm(cabecera), actividadesPx: alturas.map(mm), piePx: mm(pie) });
  const enunciados = (folio) => [...folio.querySelectorAll(".hj-act-enunciado")].map((e) => e.textContent);

  test("si cabe en un folio, no se toca nada", () => {
    const { cont, hoja } = montar(3);
    const folios = partirEnFolios(hoja, { doc, folio: FOLIO, margen: MARGEN, piezas: piezas(60, [50, 50, 50]) });
    assert.equal(folios.length, 1);
    assert.equal(cont.querySelectorAll("article").length, 1);
    assert.ok(hoja.classList.contains("hj-folio"));
  });

  test("UN EJERCICIO QUE NO CABE PASA ENTERO al folio siguiente, y el pie va en TODOS", () => {
    // Útil por folio: 297 - 20 de márgenes - 3 de holgura - 8 del pie = 266.
    // 60 + 100 + 100 = 260; el tercero (100) no cabe.
    const { cont, hoja } = montar(4);
    const folios = partirEnFolios(hoja, { doc, folio: FOLIO, margen: MARGEN, piezas: piezas(60, [100, 100, 100, 40]) });
    assert.equal(folios.length, 2);
    assert.deepEqual(enunciados(folios[0]), ["E1", "E2"]);
    assert.deepEqual(enunciados(folios[1]), ["E3", "E4"]);
    // (Comparar nodos con assert.equal hace que, si falla, el mensaje
    // intente imprimir el DOM entero; se comprueba con booleanos.)
    assert.equal(folios.every((f) => f.querySelectorAll(".hj-foot").length === 1), true, "un pie por folio");
    assert.equal(folios[0].querySelector(".hj-head") !== null, true);
    assert.equal(folios[1].querySelector(".hj-head") === null, true, "la cabecera solo en el primero");
    assert.deepEqual([...cont.querySelectorAll("article")].map((a) => a.dataset.folio), ["1", "2"]);
    // Los números del cuadrado no se reinician: son los de la hoja.
    assert.deepEqual([...folios[1].querySelectorAll(".hj-act-num")].map((n) => n.textContent), ["3", "4"]);
  });

  test("REPARTO VORAZ: cada folio se llena hasta donde cabe", () => {
    const { hoja } = montar(6);
    const folios = partirEnFolios(hoja, { doc, folio: FOLIO, margen: MARGEN, piezas: piezas(40, [70, 70, 70, 70, 70, 70]) });
    // Útil 266: 40 + 3×70 = 250 (cabe); +70 no. Luego 3×70 = 210; +70 = 280 no.
    assert.deepEqual(folios.map((f) => enunciados(f).length), [3, 3]);
  });

  test("CON EL PIE EN TODOS, un pie 'suelto' deja de existir: se reserva su sitio en cada folio", () => {
    const { hoja } = montar(2);
    hoja.querySelector(".hj-foot").classList.add("hj-foot--suelto");
    const folios = partirEnFolios(hoja, { doc, folio: FOLIO, margen: MARGEN, piezas: piezas(60, [100, 100]) });
    assert.equal(folios.length, 1);
    assert.equal(hoja.querySelector(".hj-foot").classList.contains("hj-foot--suelto"), false);
  });
}
