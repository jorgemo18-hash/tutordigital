import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// CÓMO SE EVALÚA CADA CRITERIO: lo que las programaciones reales tienen por
// unidad (comparación con la del IES Ramón y Cajal, 24/9) y la nuestra no.
export async function run({ test, assert }) {
  const { fichaDeCriterio, pesoDeCriterio, ponFicha, criteriosSinInstrumento } = await import("../../../assets/shared/programacion/detalleDeCriterios.js");
  const { bloqueDeCriterios } = await import("../../../assets/teacher/js/recursos/programacion/pasoCriterios.js");
  const { pintarDocumentoImprimible } = await import("../../../assets/teacher/js/recursos/programacion/documentoDeProgramacion.js");
  const { DatosSchema } = await import("../../../server/lib/programaciones/programaciones.js");
  const { mensajeDeContexto } = await import("../../../server/lib/programaciones/ia/redactaTextos.js");

  const CUR = {
    materia: "Matemáticas", curso: 1, criteriosSueltos: [],
    competencias: [
      { codigo: "CE.M.1", texto: "Resolver problemas", criterios: [{ codigo: "1.1", texto: "Interpretar problemas" }, { codigo: "1.2", texto: "Aplicar estrategias" }] },
      { codigo: "CE.M.2", texto: "Analizar soluciones", criterios: [{ codigo: "2.1", texto: "Comprobar soluciones" }] },
    ],
    saberes: [{ etiqueta: "1º", cursos: [1], bloques: [{ bloque: "A. Sentido numérico", apartados: [{ codigo: "A.2", nombre: "Cantidad", saberes: ["Enteros"] }] }] }],
  };

  test("los porcentajes con coma decimal, como se escribe en España", () => {
    const cont = document.createElement("div");
    pintarDocumentoImprimible({ contenedor: cont, curriculo: CUR, cabecera: { curso: 1 }, doc: document,
      datos: { pesos: { "CE.M.1": 13.3, "CE.M.2": 86.7 }, unidades: [{ id: "u", titulo: "U", trimestre: 1, sesiones: 1, saberes: [], criterios: ["1.1"] }] } });
    assert.match(cont.querySelector(".rc-doc__tabla--ud").textContent, /6,7 %/);
    assert.equal(/\d\.\d %/.test(cont.textContent), false);
  });

  test("el peso de cada criterio sale del apartado d), en los dos modos", () => {
    assert.equal(pesoDeCriterio(CUR, { calificacion: "criterio", pesos: { "1.1": 30, "1.2": 20, "2.1": 50 } }, "1.2"), 20);
    assert.equal(pesoDeCriterio(CUR, { pesos: { "CE.M.1": 60, "CE.M.2": 40 } }, "1.2"), 30, "60 % de CE.M.1 entre sus 2 criterios");
    assert.equal(pesoDeCriterio(CUR, { pesos: { "CE.M.1": 60, "CE.M.2": 40 } }, "2.1"), 40);
  });

  test("una ficha vacía no se guarda; los instrumentos quedan en orden fijo", () => {
    const datos = {};
    ponFicha(datos, "1.1", { instrumentos: ["OB", "PE"], imprescindible: true });
    assert.deepEqual(datos.criterios["1.1"], { instrumentos: ["PE", "OB"], imprescindible: true });
    ponFicha(datos, "1.1", { instrumentos: [], imprescindible: false });
    assert.equal("1.1" in datos.criterios, false);
    assert.deepEqual(criteriosSinInstrumento(CUR, datos), ["1.1", "1.2", "2.1"]);
  });

  test("se guarda lo que manda el editor; una sigla inventada, no", () => {
    assert.equal(DatosSchema.safeParse({ criterios: { "1.1": { instrumentos: ["PE", "TR"], imprescindible: true } } }).success, true);
    assert.equal(DatosSchema.safeParse({ criterios: { "1.1": { instrumentos: ["XX"] } } }).success, false);
  });

  test("en el editor: pulsar una sigla y marcar imprescindible lo guarda", () => {
    const datos = { pesos: { "CE.M.1": 60, "CE.M.2": 40 } };
    let cambios = 0;
    const bloque = bloqueDeCriterios({ curriculo: CUR, datos, onCambio: () => { cambios += 1; }, repintar: () => {}, doc: document });
    const fila = bloque.querySelector('[data-criterio="1.2"]');
    assert.match(fila.textContent, /30 %/);
    [...fila.querySelectorAll("button")].find((b) => b.textContent === "PE").click();
    const caja = fila.querySelector("input[type=checkbox]");
    caja.checked = true;
    caja.dispatchEvent(new window.Event("change"));
    assert.deepEqual(fichaDeCriterio(datos, "1.2"), { instrumentos: ["PE"], imprescindible: true });
    assert.equal(cambios, 2);
    assert.match(bloque.textContent, /2 criterios sin instrumento/);
  });

  test("'Prueba escrita y observación en todos' solo rellena los que no tienen", () => {
    const datos = { criterios: { "1.1": { instrumentos: ["TR"] } } };
    const bloque = bloqueDeCriterios({ curriculo: CUR, datos, onCambio: () => {}, repintar: () => {}, doc: document });
    [...bloque.querySelectorAll("button")].find((b) => b.textContent.startsWith("Prueba escrita y observación")).click();
    assert.deepEqual(datos.criterios["1.1"].instrumentos, ["TR"]);
    assert.deepEqual(datos.criterios["2.1"].instrumentos, ["PE", "OB"]);
  });

  test("REGRESIÓN: el documento pinta la tabla de cada unidad con peso, imprescindible e instrumentos", () => {
    const datos = {
      pesos: { "CE.M.1": 60, "CE.M.2": 40 },
      unidades: [{ id: "u1", titulo: "Enteros", trimestre: 1, sesiones: 12, saberes: ["s0.0.0.0"], criterios: ["1.1", "2.1"] }],
      criterios: { "1.1": { instrumentos: ["PE", "OB"], imprescindible: true } },
    };
    const cont = document.createElement("div");
    pintarDocumentoImprimible({ contenedor: cont, curriculo: CUR, datos, cabecera: { curso: 1 }, doc: document });
    const tabla = cont.querySelector(".rc-doc__tabla--ud");
    assert.ok(tabla, "hay tabla en la unidad");
    const filas = [...tabla.querySelectorAll("tr")].map((tr) => [...tr.children].map((c) => c.textContent));
    assert.deepEqual(filas[0], ["Criterio de evaluación", "Peso en la nota", "Imprescindible", "Instrumentos"]);
    assert.deepEqual(filas[1], ["1.1. Interpretar problemas", "30 %", "Sí", "PE, OB"]);
    assert.deepEqual(filas[2], ["2.1. Comprobar soluciones", "40 %", "", "—"]);
    assert.match(cont.textContent, /PE, prueba escrita/);
  });

  test("la IA que redacta c) recibe los instrumentos que ya se han elegido", () => {
    const m = mensajeDeContexto({ curriculo: CUR, datos: { criterios: { "1.1": { instrumentos: ["PE"], imprescindible: true } } }, letras: ["c"] });
    assert.match(m, /1\.1: Prueba escrita \(imprescindible\)/);
  });
}
