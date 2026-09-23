// LOS TÍTULOS DE BLOQUE (assets/shared/hoja/js/titulosDeBloque.js) y los
// retoques de la hoja en el panel (assets/shared/generador/hojaEditable.js), que
// los recalculan con la misma regla que el montador.
export async function run({ test, assert }) {
  const { conTitulosDeBloque } = await import("../../assets/shared/hoja/js/titulosDeBloque.js");
  const { reemplazaActividad, quitaActividad } = await import(
    "../../assets/shared/generador/hojaEditable.js"
  );
  const titulo = (o) => `T${o}`;
  const acts = (n) => Array.from({ length: n }, (_, i) => ({ enunciado: `e${i + 1}` }));
  const bloques = (l) => l.map((a) => a.bloque || "");

  test("título solo en la primera de cada bloque; con un solo objetivo, ninguno", () => {
    assert.deepEqual(bloques(conTitulosDeBloque(acts(4), [1, 1, 3, 3], titulo)), ["T1", "", "T3", ""]);
    assert.deepEqual(bloques(conTitulosDeBloque(acts(2), [3, 3], titulo)), ["", ""]);
  });

  test("SE RECALCULA DESDE CERO: los títulos viejos no se quedan pegados", () => {
    const viejas = [{ enunciado: "x", bloque: "T1" }, { enunciado: "y" }];
    assert.deepEqual(bloques(conTitulosDeBloque(viejas, [3, 3], titulo)), ["", ""]);
  });

  const estado = () => ({
    hoja: { objetivo: "O", actividades: conTitulosDeBloque(acts(3), [1, 3, 3], titulo) },
    huecos: [{ orden: 1, clave: "r", objetivo: 1 }, { orden: 2, clave: "a", objetivo: 3 }, { orden: 3, clave: "b", objetivo: 3 }],
  });

  test("QUITAR EL PRIMERO DE UN BLOQUE pasa el título al siguiente, y renumera", () => {
    const s = quitaActividad(estado(), 0, titulo);
    assert.deepEqual(s.hoja.actividades.map((a) => a.enunciado), ["e2", "e3"]);
    assert.deepEqual(bloques(s.hoja.actividades), ["", ""], "queda un solo objetivo: sin títulos");
    assert.deepEqual(s.huecos.map((h) => h.orden), [1, 2]);
    const conDos = quitaActividad(estado(), 1, titulo);
    assert.deepEqual(bloques(conDos.hoja.actividades), ["T1", "T3"], "el título del bloque 3 pasa a e3");
  });

  test("el último ejercicio no se quita", () => {
    const uno = { hoja: { actividades: acts(1) }, huecos: [{ orden: 1, clave: "a", objetivo: 3 }] };
    assert.equal(quitaActividad(uno, 0, titulo), uno);
  });

  test("REEMPLAZAR cambia solo ese hueco, conserva su número y no toca la hoja de partida", () => {
    const antes = estado();
    const s = reemplazaActividad(antes, 2, { actividad: { enunciado: "nuevo" }, hueco: { clave: "z", objetivo: 3 } }, titulo);
    assert.deepEqual(s.hoja.actividades.map((a) => a.enunciado), ["e1", "e2", "nuevo"]);
    assert.deepEqual(s.huecos[2], { clave: "z", objetivo: 3, orden: 3 });
    assert.deepEqual(bloques(s.hoja.actividades), ["T1", "T3", ""]);
    assert.equal(antes.hoja.actividades[2].enunciado, "e3");
  });
}
