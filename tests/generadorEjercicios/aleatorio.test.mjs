// AZAR REPRODUCIBLE.
//
// Lo que se vigila es una sola propiedad, y es la que hace posible todo lo
// demás: **la misma semilla da la misma hoja**. De eso dependen dos cosas
// que no se pueden negociar:
//
//   - Reimprimir el folio que repartió el profesor tres meses después.
//     Con `Math.random()` una hoja solo existe mientras esté guardada fila a
//     fila; con semilla, la hoja ES su semilla.
//   - Poder testear los generadores. Un generador que usa el azar del
//     sistema no se puede probar: el test acierta o falla según el día.
export async function run({ test, assert }) {
  const { crearAzar } = await import("../../server/lib/generadorEjercicios/aleatorio.js");

  const serie = (semilla, n = 12) => {
    const a = crearAzar(semilla);
    return Array.from({ length: n }, () => a.entero(-20, 20));
  };

  test("EL PUNTO DE TODO: la misma semilla da exactamente la misma serie", () => {
    assert.deepEqual(serie(1234), serie(1234));
    assert.deepEqual(serie("HOJA-ENT-3-20260917"), serie("HOJA-ENT-3-20260917"));
  });

  test("y dos semillas distintas dan series distintas", () => {
    assert.notDeepEqual(serie(1234), serie(1235));
    assert.notDeepEqual(serie("hoja-a"), serie("hoja-b"));
  });

  test("una semilla de texto vale: el código de la hoja es la semilla", () => {
    assert.doesNotThrow(() => serie("HOJA-ENT-3-20260917"));
    assert.equal(serie("x").length, 12);
  });

  test("REGRESIÓN: la semilla 0 no degenera", () => {
    // mulberry32 con estado 0 devolvería siempre lo mismo. Una hoja con
    // semilla 0 (o con una cadena vacía) saldría con el mismo número en
    // todos los huecos, y eso pasaría desapercibido hasta imprimirla.
    const s = serie(0);
    assert.ok(new Set(s).size > 1, `la semilla 0 da todo igual: ${s.join(", ")}`);
    const vacia = serie("");
    assert.ok(new Set(vacia).size > 1);
  });

  test("entero() respeta los extremos, los dos incluidos", () => {
    const a = crearAzar(7);
    const vistos = new Set();
    for (let i = 0; i < 2000; i += 1) vistos.add(a.entero(-2, 2));
    assert.deepEqual([...vistos].sort((x, y) => x - y), [-2, -1, 0, 1, 2]);
  });

  test("entero(n, n) devuelve n, sin bucle ni NaN", () => {
    assert.equal(crearAzar(1).entero(5, 5), 5);
  });

  test("los extremos al revés no revientan", () => {
    const v = crearAzar(1).entero(10, -10);
    assert.ok(v >= -10 && v <= 10, `${v} fuera de rango`);
  });

  test("elige() con lista vacía devuelve undefined, no revienta", () => {
    // En un generador eso significa "no hay candidatos", y quien llama
    // decide qué hacer. Reventar aquí tumbaría la generación de la hoja.
    const a = crearAzar(1);
    assert.equal(a.elige([]), undefined);
    assert.equal(a.elige(null), undefined);
    assert.equal(a.elige(["solo"]), "solo");
  });

  test("REGRESIÓN: mezcla() NO muta la lista que recibe", () => {
    // Los catálogos (conceptos, arquetipos) vienen de la base de datos y se
    // reutilizan entre los ejercicios de la misma hoja. Si mezcla() los
    // reordenara en su sitio, el segundo ejercicio vería una lista ya
    // trastocada por el primero y la progresión de la hoja se desordenaría.
    const original = [1, 2, 3, 4, 5, 6, 7, 8];
    const copiaAntes = [...original];
    const mezclada = crearAzar(9).mezcla(original);
    assert.deepEqual(original, copiaAntes, "la lista original se ha movido");
    assert.notEqual(mezclada, original, "tiene que ser otro array");
    assert.deepEqual([...mezclada].sort((a, b) => a - b), copiaAntes);
  });

  test("mezcla() con la misma semilla da el mismo orden", () => {
    const l = [1, 2, 3, 4, 5, 6, 7, 8];
    assert.deepEqual(crearAzar(3).mezcla(l), crearAzar(3).mezcla(l));
  });

  test("signo() da los dos, y suerte() reparte", () => {
    const a = crearAzar(11);
    const signos = Array.from({ length: 200 }, () => a.signo());
    assert.ok(signos.includes(1) && signos.includes(-1));

    const b = crearAzar(12);
    const ciertos = Array.from({ length: 1000 }, () => b.suerte(0.5)).filter(Boolean).length;
    assert.ok(ciertos > 400 && ciertos < 600, `reparto sospechoso: ${ciertos}/1000`);
  });

  test("suerte(0) y suerte(1) son deterministas", () => {
    const a = crearAzar(13);
    assert.equal(Array.from({ length: 50 }, () => a.suerte(0)).some(Boolean), false);
    const b = crearAzar(13);
    assert.equal(Array.from({ length: 50 }, () => b.suerte(1)).every(Boolean), true);
  });
}
