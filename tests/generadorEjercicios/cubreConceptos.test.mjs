// QUÉ BATERÍAS ENTRAN CUANDO NO ENTRAN TODAS (cubreConceptos.js).
//
// Nació de una hoja: al añadir la recta numérica, el objetivo 1 "normal"
// salía sin ninguna recta y con un tercio del folio en blanco, porque el
// abanico elegía por posición en la lista y no por concepto.
export async function run({ test, assert }) {
  const { cubreConceptos, enAbanico } = await import("../../server/lib/generadorEjercicios/cubreConceptos.js");
  const { montaHoja } = await import("../../server/lib/generadorEjercicios/montadorDeHoja.js");
  const { bateriasPropias } = await import("../../server/lib/generadorEjercicios/catalogoDeBaterias.js");
  const { crearAzar } = await import("../../server/lib/generadorEjercicios/aleatorio.js");

  const b = (id, concepto) => ({ id, concepto });
  const ids = (l) => l.map((x) => x.id);

  test("el abanico coge los extremos y reparte el resto", () => {
    assert.deepEqual(enAbanico([1, 2, 3, 4, 5], 3), [1, 3, 5]);
    assert.deepEqual(enAbanico([1, 2, 3], 1), [3]);
    assert.deepEqual(enAbanico([1, 2, 3], 0), []);
  });

  test("CADA CONCEPTO ANTES QUE DOS DEL MISMO: el caso del objetivo 1", () => {
    // La lista real del objetivo 1: situaciones, 2 rectas, 2 de orden,
    // 2 rectas graduadas, series (orden). Con tres huecos el abanico solo
    // daba situaciones, ordenar y series: ninguna recta.
    const lista = [b("asocia", 1), b("repr", 6), b("lee", 6), b("compara", 5), b("ordena", 5),
      b("leeG", 6), b("reprG", 6), b("series", 5)];
    assert.deepEqual(ids(cubreConceptos(lista, 3)), ["asocia", "repr", "compara"]);
    // Con un hueco más entra la más difícil del objetivo, por el abanico.
    assert.deepEqual(ids(cubreConceptos(lista, 4)), ["asocia", "repr", "compara", "series"]);
  });

  test("con menos huecos que conceptos, el abanico se hace sobre los conceptos", () => {
    const lista = [b("a1", 1), b("b1", 2), b("c1", 3), b("c2", 3), b("d1", 4)];
    assert.deepEqual(ids(cubreConceptos(lista, 2)), ["a1", "d1"]);
    assert.deepEqual(ids(cubreConceptos(lista, 3)), ["a1", "c1", "d1"]);
  });

  test("con un solo concepto se comporta como el abanico de siempre", () => {
    const lista = [b("x", 12), b("y", 12), b("z", 12)];
    assert.deepEqual(ids(cubreConceptos(lista, 2)), ["x", "z"]);
  });

  test("LA HOJA RESPETA EL ORDEN DEL CATÁLOGO, que es la secuencia pedagógica", () => {
    const lista = [b("a1", 1), b("b1", 2), b("b2", 2), b("a2", 1)];
    assert.deepEqual(ids(cubreConceptos(lista, 3)), ["a1", "b1", "a2"]);
  });

  test("EN TODAS LAS HOJAS: tantos conceptos distintos como quepan", () => {
    // La regla sobre hojas montadas de verdad, no sobre listas de ejemplo:
    // con k baterías propias y c conceptos en el objetivo, la hoja cubre
    // min(k, c) conceptos distintos.
    for (const objetivo of [1, 2, 3, 4, 5, 6]) {
      const conceptoDe = new Map(bateriasPropias(objetivo).map((x) => [x.clave, x.concepto]));
      const total = new Set(conceptoDe.values()).size;
      for (const intensidad of ["repaso", "normal", "refuerzo"]) {
        for (const s of ["a", "b", 7]) {
          const { soluciones } = montaHoja({
            objetivo, intensidad, azar: crearAzar(`${objetivo}-${intensidad}-${s}`),
            cabecera: { materia: "M", curso: "1.º ESO", objetivo: "x" },
          });
          const propias = soluciones.filter((x) => !x.esRepaso);
          const cubiertos = new Set(propias.map((x) => conceptoDe.get(x.clave))).size;
          assert.equal(
            cubiertos, Math.min(propias.length, total),
            `objetivo ${objetivo} ${intensidad}: ${propias.map((x) => x.clave).join(", ")}`,
          );
        }
      }
    }
  });
}
