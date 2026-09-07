// La lista de precios pública: el modelo de la tabla que se imprime en la
// hoja para familias.
//
// Lo que se prueba aquí no es "que se guarde un texto", es que borrar una
// fila del medio no desplace los precios de las demás. Ese fallo no da
// error, no se ve al guardar y acaba en un papel que se le entrega a una
// familia con el precio de otra cosa.
export async function run({ test, assert }) {
  const {
    preciosPorDefecto, normalizarPrecios, precioDe, conPrecio,
    anadirFila, anadirColumna, quitarFila, quitarColumna,
    renombrarFila, renombrarColumna, moverFila, hayPrecios, nuevoId, clavePrecio,
    LIMITES_PRECIOS,
  } = await import("../../assets/shared/js/preciosPublicos.js");

  const titulos = (m) => m.filas.map((f) => f.titulo);

  test("la tabla de ejemplo trae los ejes puestos y NINGÚN precio inventado", () => {
    const modelo = preciosPorDefecto();
    assert.deepEqual(modelo.columnas.map((c) => c.titulo), ["Primaria", "ESO", "Bachillerato"]);
    assert.equal(modelo.filas.length, 5);
    assert.deepEqual(modelo.precios, {}, "un precio de ejemplo acabaría impreso tal cual en la hoja");
  });

  test("las filas del ejemplo son HORAS a la semana, no días", () => {
    // Se cobra por horas: un alumno puede venir dos días y hacer tres horas.
    // Con las filas en días, esa tarifa no se puede ni escribir.
    assert.deepEqual(
      preciosPorDefecto().filas.map((f) => f.titulo),
      ["1 h / semana", "2 h / semana", "3 h / semana", "4 h / semana", "5 h / semana"]
    );
  });

  // ── Lo importante: los precios van por ID, no por posición ────────────

  test("REGRESIÓN: borrar la fila del medio no mueve los precios de las demás", () => {
    // Con los precios indexados por posición, quitar la fila 2 subiría el
    // precio de la 3 a la 2 y la hoja diría que tres horas cuestan lo de dos.
    let m = preciosPorDefecto();
    const [f1, f2, f3] = m.filas.map((f) => f.id);
    const c1 = m.columnas[0].id;
    m = conPrecio(m, f1, c1, "40 €");
    m = conPrecio(m, f2, c1, "55 €");
    m = conPrecio(m, f3, c1, "70 €");

    m = quitarFila(m, f2);

    assert.equal(m.filas.some((f) => f.id === f2), false, "la fila borrada ya no está");
    assert.equal(precioDe(m, f1, c1), "40 €");
    assert.equal(precioDe(m, f3, c1), "70 €", "el de tres horas sigue siendo el de tres horas");
  });

  test("quitar una columna se lleva sus precios y deja los de las otras", () => {
    let m = preciosPorDefecto();
    const f1 = m.filas[0].id;
    const [c1, c2] = m.columnas.map((c) => c.id);
    m = conPrecio(m, f1, c1, "40 €");
    m = conPrecio(m, f1, c2, "50 €");

    m = quitarColumna(m, c1);

    assert.equal(precioDe(m, f1, c2), "50 €");
    assert.deepEqual(Object.keys(m.precios), [clavePrecio(f1, c2)], "el precio de la columna borrada no se queda de polizón");
  });

  test("REGRESIÓN: una fila nueva no hereda los precios de la que se borró", () => {
    // Si el id se reutilizara ("f2" otra vez), la fila recién añadida
    // aparecería con los precios de la anterior ya puestos.
    let m = preciosPorDefecto();
    const f2 = m.filas[1].id;
    const c1 = m.columnas[0].id;
    m = conPrecio(m, f2, c1, "55 €");

    m = quitarFila(m, f2);
    m = anadirFila(m, "Intensivo");

    const nueva = m.filas[m.filas.length - 1];
    assert.equal(nueva.titulo, "Intensivo");
    assert.equal(precioDe(m, nueva.id, c1), "", "la fila nueva empieza vacía");
  });

  // ── Cambiar filas de orden ────────────────────────────────────────────

  test("EL CASO REAL: la fila añadida al final se coloca en su sitio", () => {
    // El "+" añade siempre al final. Jorge tenía 1h, 2h, 3h y 5h y le
    // faltaba la de 4h: se añade abajo y se sube un puesto.
    let m = normalizarPrecios({
      filas: ["1 h", "2 h", "3 h", "5 h"].map((t, i) => ({ id: `f${i + 1}`, titulo: t })),
      columnas: [{ id: "c1", titulo: "ESO" }],
    });
    m = anadirFila(m, "4 h");
    assert.deepEqual(titulos(m), ["1 h", "2 h", "3 h", "5 h", "4 h"], "el + añade al final");

    m = moverFila(m, m.filas[4].id, 3);
    assert.deepEqual(titulos(m), ["1 h", "2 h", "3 h", "4 h", "5 h"]);
  });

  test("REGRESIÓN: mover una fila NO mueve los precios de las demás", () => {
    // El fallo que esto vigila no da error: si los precios fueran por
    // posición, subir la fila de 4 h dejaría a cada tramo con el precio del
    // de al lado, y eso acaba impreso en un papel que se le da a una madre.
    let m = normalizarPrecios({
      filas: [{ id: "f1", titulo: "1 h" }, { id: "f2", titulo: "3 h" }, { id: "f3", titulo: "2 h" }],
      columnas: [{ id: "c1", titulo: "ESO" }],
    });
    m = conPrecio(m, "f1", "c1", "45 €");
    m = conPrecio(m, "f2", "c1", "110 €");
    m = conPrecio(m, "f3", "c1", "75 €");

    m = moverFila(m, "f3", 1);

    // Se comprueba la tabla TAL Y COMO SE IMPRIME: cada concepto con el
    // precio que le va a salir al lado. Comprobarlo por id no valdría —
    // pasaría igual aunque los títulos y los precios se hubieran
    // desemparejado, que es justo el fallo.
    assert.deepEqual(
      m.filas.map((f) => [f.titulo, precioDe(m, f.id, "c1")]),
      [["1 h", "45 €"], ["2 h", "75 €"], ["3 h", "110 €"]]
    );
  });

  test("arrastrar más allá del borde deja la fila la primera o la última, no la borra", () => {
    // Con el teclado es flecha arriba en la fila de arriba del todo; con el
    // ratón, soltar por encima de la tabla.
    const m = normalizarPrecios({
      filas: [{ id: "f1", titulo: "A" }, { id: "f2", titulo: "B" }],
      columnas: [{ id: "c1", titulo: "ESO" }],
    });
    assert.deepEqual(titulos(moverFila(m, "f1", -3)), ["A", "B"], "ya estaba la primera");
    assert.deepEqual(titulos(moverFila(m, "f1", 99)), ["B", "A"], "se va al final, no se pierde");
    assert.equal(moverFila(m, "f1", 99).filas.length, 2);
  });

  test("mover una fila que no existe, o a donde ya está, no rompe nada", () => {
    const m = normalizarPrecios({
      filas: [{ id: "f1", titulo: "A" }, { id: "f2", titulo: "B" }],
      columnas: [{ id: "c1", titulo: "ESO" }],
    });
    assert.deepEqual(titulos(moverFila(m, "f9", 0)), ["A", "B"]);
    assert.deepEqual(titulos(moverFila(m, "f1", 0)), ["A", "B"]);
    assert.deepEqual(titulos(moverFila(m, "f1", "arriba")), ["A", "B"], "un destino que no es número");
  });

  test("nuevoId busca el hueco, no cuenta cuántos hay", () => {
    assert.equal(nuevoId("f", ["f1", "f3"]), "f2");
    assert.equal(nuevoId("f", ["f1", "f2"]), "f3");
    assert.equal(nuevoId("c", []), "c1");
  });

  // ── Saneado de lo que llega de la base de datos ───────────────────────

  test("un jsonb con basura dentro no revienta y sale una tabla usable", () => {
    const m = normalizarPrecios({ columnas: "no soy un array", filas: null, precios: 7, nota: 42 });
    assert.deepEqual(m, { columnas: [], filas: [], precios: {}, nota: "42" });
  });

  test("null (un centro que nunca abrió la pestaña) da una tabla vacía", () => {
    assert.deepEqual(normalizarPrecios(null), { columnas: [], filas: [], precios: {}, nota: "" });
  });

  test("los precios huérfanos de una fila que ya no existe se tiran al normalizar", () => {
    const m = normalizarPrecios({
      columnas: [{ id: "c1", titulo: "Primaria" }],
      filas: [{ id: "f1", titulo: "1 día" }],
      precios: { "f1|c1": "40 €", "f9|c1": "999 €", "f1|c9": "888 €" },
    });
    assert.deepEqual(m.precios, { "f1|c1": "40 €" });
  });

  test("dos filas con el mismo id se separan en vez de pisarse", () => {
    // Un jsonb copiado a mano puede traerlo. Con ids repetidos, escribir el
    // precio de una escribiría el de la otra.
    const m = normalizarPrecios({
      columnas: [{ id: "c1", titulo: "Primaria" }],
      filas: [{ id: "f1", titulo: "1 día" }, { id: "f1", titulo: "2 días" }],
      precios: {},
    });
    assert.equal(new Set(m.filas.map((f) => f.id)).size, 2);
  });

  test("los títulos se recortan: una cuartilla no aguanta un párrafo por columna", () => {
    const m = anadirColumna(normalizarPrecios(null), "x".repeat(500));
    assert.equal(m.columnas[0].titulo.length, LIMITES_PRECIOS.MAX_TEXTO);
  });

  test("los topes de cada eje son distintos, y el de columnas es el más corto", () => {
    // Una fila de más solo encoge la tabla; una columna de más estrecha
    // TODAS las casillas de precio a la vez, y en una cuartilla de 10,5 cm
    // a partir de seis no cabe ni encogiendo la letra.
    assert.ok(LIMITES_PRECIOS.MAX_COLUMNAS < LIMITES_PRECIOS.MAX_FILAS);

    let m = normalizarPrecios(null);
    for (let i = 0; i < LIMITES_PRECIOS.MAX_COLUMNAS + 5; i++) m = anadirColumna(m, `C${i}`);
    assert.equal(m.columnas.length, LIMITES_PRECIOS.MAX_COLUMNAS);

    for (let i = 0; i < LIMITES_PRECIOS.MAX_FILAS + 5; i++) m = anadirFila(m, `F${i}`);
    assert.equal(m.filas.length, LIMITES_PRECIOS.MAX_FILAS);
  });

  // ── Precios como texto, y el vacío como ausencia ──────────────────────

  test("el precio es texto: '55 €/mes' y 'a consultar' se guardan tal cual", () => {
    let m = preciosPorDefecto();
    const f1 = m.filas[0].id;
    const [c1, c2] = m.columnas.map((c) => c.id);
    m = conPrecio(m, f1, c1, "55 €/mes");
    m = conPrecio(m, f1, c2, "a consultar");
    assert.equal(precioDe(m, f1, c1), "55 €/mes");
    assert.equal(precioDe(m, f1, c2), "a consultar");
  });

  test("vaciar una casilla la BORRA, no guarda una cadena vacía", () => {
    // Es lo que permite que la hoja distinga "aquí no se cobra" de "aún no
    // lo he puesto" — y que hayPrecios() diga la verdad.
    let m = preciosPorDefecto();
    const f1 = m.filas[0].id;
    const c1 = m.columnas[0].id;
    m = conPrecio(m, f1, c1, "40 €");
    m = conPrecio(m, f1, c1, "   ");
    assert.deepEqual(m.precios, {});
    assert.equal(hayPrecios(m), false);
  });

  test("hayPrecios: los ejes puestos pero sin un solo precio NO es una tabla imprimible", () => {
    assert.equal(hayPrecios(preciosPorDefecto()), false, "imprimir una tabla en blanco es peor que no imprimirla");
    const f1 = preciosPorDefecto().filas[0].id;
    const c1 = preciosPorDefecto().columnas[0].id;
    assert.equal(hayPrecios(conPrecio(preciosPorDefecto(), f1, c1, "40 €")), true);
  });

  test("renombrar no toca los precios", () => {
    let m = preciosPorDefecto();
    const f1 = m.filas[0].id;
    const c1 = m.columnas[0].id;
    m = conPrecio(m, f1, c1, "40 €");
    m = renombrarFila(m, f1, "1 día / semana (tarde)");
    m = renombrarColumna(m, c1, "Primaria y Infantil");
    assert.equal(precioDe(m, f1, c1), "40 €");
    assert.equal(m.filas[0].titulo, "1 día / semana (tarde)");
    assert.equal(m.columnas[0].titulo, "Primaria y Infantil");
  });
}
