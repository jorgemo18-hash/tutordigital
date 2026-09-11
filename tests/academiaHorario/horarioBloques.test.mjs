// La rejilla por CLASES en vez de por medias horas (el cuaderno de Jorge).
//
// Con filas de media hora, el cuadrante de Lyceo tiene diez filas para
// cinco clases y cada alumno sale dos veces por una clase de una hora.
// Aquí las filas son las clases estándar del centro y lo que no encaja
// —de en punto a en punto— va a una cajita, con su hora escrita.
export async function run({ test, assert }) {
  const { bloquesDeConfig, repartirEnBloques, ocupacionDeBloque, etiquetaBloque, etiquetaFranja } =
    await import("../../assets/shared/js/horarioBloques.js");

  // La configuración real de Lyceo (verificada en producción el 02/09).
  const LYCEO = { franja_inicio: "15:30", franja_fin: "20:30", franja_duracion: 60 };

  test("las filas son las clases del centro, no las medias horas", () => {
    assert.deepEqual(
      bloquesDeConfig(LYCEO).map(etiquetaBloque),
      ["15:30 – 16:30", "16:30 – 17:30", "17:30 – 18:30", "18:30 – 19:30", "19:30 – 20:30"],
      "cinco filas para cinco clases; antes eran diez"
    );
  });

  test("jornada partida: mañana y tarde, sin las filas muertas del mediodía", () => {
    const bloques = bloquesDeConfig({
      franja_inicio: "09:00", franja_fin: "11:00", franja_duracion: 60,
      franja_inicio_2: "16:00", franja_fin_2: "18:00",
    });
    assert.deepEqual(bloques.map((b) => b.inicio), ["09:00", "10:00", "16:00", "17:00"]);
  });

  test("dos tramos que se solapan no duplican filas", () => {
    // Un dedazo en Ajustes (tarde que empieza antes de que acabe la mañana)
    // dibujaba el cuadrante dos veces montado sobre sí mismo.
    const bloques = bloquesDeConfig({
      franja_inicio: "15:30", franja_fin: "20:30", franja_duracion: 60,
      franja_inicio_2: "16:00", franja_fin_2: "21:00",
    });
    const inicios = bloques.map((b) => b.inicio);
    assert.equal(new Set(inicios).size, inicios.length, "ninguna fila repetida");
    assert.deepEqual(inicios, [...inicios].sort(), "y en orden");
  });

  test("un resto al cerrar se queda como fila corta, no se tira", () => {
    // Abre hasta las 20:00 con clases de una hora empezando y media: la
    // última media hora es sitio donde caben clases.
    const bloques = bloquesDeConfig({ franja_inicio: "15:30", franja_fin: "20:00", franja_duracion: 60 });
    assert.deepEqual(bloques.map(etiquetaBloque).slice(-1), ["19:30 – 20:00"]);
  });

  test("un resto de menos de media hora no crea una fila de dos minutos", () => {
    const bloques = bloquesDeConfig({ franja_inicio: "15:30", franja_fin: "17:45", franja_duracion: 60 });
    assert.deepEqual(bloques.map(etiquetaBloque), ["15:30 – 16:30", "16:30 – 17:30"]);
  });

  // ── El reparto, que es la decisión ────────────────────────────────────

  const bloques = bloquesDeConfig(LYCEO);
  const f = (hora_inicio, hora_fin, nombre) => ({ hora_inicio, hora_fin, alumno: { nombre } });

  test("una clase de y media a y media va en su fila", () => {
    const reparto = repartirEnBloques([f("16:30", "17:30", "Marta")], bloques);
    assert.deepEqual(reparto[1].dentro.map((x) => x.alumno.nombre), ["Marta"]);
    assert.deepEqual(reparto[1].sueltas, []);
    assert.deepEqual(reparto[0].dentro, [], "y NO se repite en la fila de antes");
  });

  test("EL CASO RAKEL: de en punto a en punto sale en LAS DOS filas que pisa, recortada", () => {
    // Es la niña que solo puede de 16:00 a 17:00 y no cabe en ninguna
    // casilla. Hasta el 11/09/2026 salía UNA sola vez, en la fila donde
    // empieza, con su horario completo ("16:00 – 17:00"). La razón era
    // buena: repetida en las dos filas con la hora entera, parecen dos
    // clases de una hora.
    //
    // LO QUE LA CAMBIÓ, usándolo (Jorge): "sale abajo del horario de 3:30 y
    // pone que va de 4 a 5, pero en el horario de las 4:30 no sale abajo y
    // me puedo pensar que no viene". Y la ocupación de la fila de 16:30 SÍ
    // la contaba —ocupacionDeBloque va tramo a tramo—, así que el número
    // decía que estaba y la lista no la enseñaba.
    //
    // EL RECORTE es lo que resuelve la objeción original: en cada fila se
    // ve solo el trozo que pasa en ella, así que no hay forma de leerlo
    // como dos clases.
    const reparto = repartirEnBloques([f("16:00", "17:00", "Rakel")], bloques);
    assert.deepEqual(reparto[0].sueltas.map((x) => x.alumno.nombre), ["Rakel"]);
    assert.deepEqual(reparto[1].sueltas.map((x) => x.alumno.nombre), ["Rakel"]);
    assert.deepEqual(reparto[0].dentro, [], "sigue sin ser una clase de la fila");
    assert.equal(etiquetaFranja(reparto[0].sueltas[0]), "16:00 – 16:30");
    assert.equal(etiquetaFranja(reparto[1].sueltas[0]), "16:30 – 17:00");
    assert.deepEqual(reparto[2].sueltas, [], "y no aparece donde no pisa");
  });

  test("el recorte NO muta la franja original", () => {
    // La misma franja se reparte en varias filas y cada una necesita su
    // recorte: mutándola, la última ganaría en todas y las dos filas
    // acabarían diciendo lo mismo.
    const rakel = f("16:00", "17:00", "Rakel");
    repartirEnBloques([rakel], bloques);
    assert.equal(rakel.hora_inicio, "16:00");
    assert.equal(rakel.hora_fin, "17:00");
  });

  test("una clase FUERA del horario de apertura sigue saliendo en alguna fila", () => {
    // Es la excepción que justifica el fallback: una clase de las 8 de la
    // mañana (de antes de cambiar el horario en Ajustes) no pisa ninguna
    // fila. Se agarra a la primera, porque una clase que no se pinta en
    // ningún sitio es una clase que se olvida.
    const reparto = repartirEnBloques([f("08:00", "09:00", "Madrugadora")], bloques);
    const total = reparto.reduce((n, r) => n + r.sueltas.length, 0);
    assert.equal(total, 1, "una vez, y solo una");
    assert.deepEqual(reparto[0].sueltas.map((x) => x.alumno.nombre), ["Madrugadora"]);
    assert.equal(
      etiquetaFranja(reparto[0].sueltas[0]), "08:00 – 09:00",
      "y sin recortar: recortarla a una fila que no pisa sería inventarse su hora"
    );
  });

  test("una clase de dos horas sale en las dos filas que ocupa", () => {
    // No es duplicar: el alumno está ahí las dos horas.
    const reparto = repartirEnBloques([f("16:30", "18:30", "Pablo")], bloques);
    assert.deepEqual(reparto.map((r) => r.dentro.length), [0, 1, 1, 0, 0]);
    assert.deepEqual(reparto.map((r) => r.sueltas.length), [0, 0, 0, 0, 0]);
  });

  test("una clase de hora y media: fila entera donde cabe, y la media hora en la siguiente", () => {
    // 17:30-19:00 llena 17:30-18:30 y se mete media hora en la siguiente.
    //
    // Hasta el 11/09/2026 la media hora no se pintaba ("ya se ve en la fila
    // de arriba, con su hora"). Lo cambió el MISMO fallo que el caso Rakel,
    // y lo encontró el test del horario real de Lyceo: el contador de la
    // fila de las 18:30 decía 12 y solo se veían 9, porque las 3 clases de
    // 17:30–19:00 estaban contadas y no listadas. La regla es una sola: en
    // cada fila se ve a quien está en el aula en algún momento de esa fila.
    const reparto = repartirEnBloques([f("17:30", "19:00", "Lucía")], bloques);
    assert.deepEqual(reparto[2].dentro.map((x) => x.alumno.nombre), ["Lucía"]);
    assert.deepEqual(reparto[3].dentro, [], "la de 18:30 no la llena entera");
    assert.deepEqual(reparto[3].sueltas.map((x) => x.alumno.nombre), ["Lucía"]);
    assert.equal(
      etiquetaFranja(reparto[3].sueltas[0]), "18:30 – 19:00",
      "y con el trozo que pasa en esa fila, no su hora completa"
    );
  });

  test("una clase de media hora suelta también tiene sitio", () => {
    const reparto = repartirEnBloques([f("17:00", "17:30", "Iván")], bloques);
    assert.deepEqual(reparto[1].sueltas.map((x) => x.alumno.nombre), ["Iván"]);
  });

  test("REGRESIÓN: ninguna franja se pierde, ni las que caen fuera del horario del centro", () => {
    // Un centro que cambia su apertura en Ajustes deja clases fuera. Una
    // clase que no se pinta en ningún sitio es una clase que se olvida.
    const franjas = [f("08:00", "09:00", "Temprano"), f("21:00", "22:00", "Tarde")];
    const reparto = repartirEnBloques(franjas, bloques);
    const pintadas = reparto.flatMap((r) => [...r.dentro, ...r.sueltas]).map((x) => x.alumno.nombre);
    assert.deepEqual(pintadas.sort(), ["Tarde", "Temprano"]);
    assert.deepEqual(reparto[0].sueltas.map((x) => x.alumno.nombre), ["Temprano"], "antes de abrir: primera fila");
    assert.deepEqual(reparto[4].sueltas.map((x) => x.alumno.nombre), ["Tarde"], "después de cerrar: última");
  });

  test("sin bloques (config imposible) no revienta", () => {
    assert.deepEqual(repartirEnBloques([f("16:00", "17:00", "X")], []), []);
  });

  // ── Las plazas siguen contándose por media hora ───────────────────────

  test("REGRESIÓN: dos medias horas seguidas no llenan el aula", () => {
    // Contando "franjas que tocan el bloque" saldría 2 de golpe. En el aula
    // nunca coincidieron.
    const franjas = [f("15:30", "16:00", "A"), f("16:00", "16:30", "B")];
    assert.equal(ocupacionDeBloque(franjas, bloques[0]), 1);
  });

  test("los que se solapan a medias SÍ cuentan juntos", () => {
    // 16:00-17:00 y 16:30-17:30 comparten el aula media hora: son 2.
    const franjas = [f("16:00", "17:00", "A"), f("16:30", "17:30", "B")];
    assert.equal(ocupacionDeBloque(franjas, bloques[1]), 2);
  });

  test("una clase de fuera del bloque no suma en él", () => {
    assert.equal(ocupacionDeBloque([f("18:30", "19:30", "A")], bloques[0]), 0);
  });

  // ── El cuadrante real de Lyceo ────────────────────────────────────────

  test("Lyceo, 02/09: el reparto real, con las franjas que pisan dos filas", () => {
    // Las horas y los recuentos son los de producción (consulta agrupada
    // por hora_inicio/hora_fin). Es la prueba de que el reparto describe
    // el cuaderno de verdad y no un caso inventado.
    const reales = [
      ["15:30", "16:30", 9], ["16:00", "17:00", 2], ["16:30", "17:30", 11],
      ["16:30", "18:30", 1], ["17:00", "17:30", 1], ["17:00", "18:00", 3],
      ["17:30", "18:30", 9], ["17:30", "19:00", 3], ["18:30", "19:30", 9],
    ];
    const franjas = reales.flatMap(([ini, fin, n]) =>
      Array.from({ length: n }, (_, i) => f(ini, fin, `${ini}-${i}`))
    );
    const reparto = repartirEnBloques(franjas, bloques);
    // El reparto fila a fila, que es lo que se ve en pantalla. Hasta el
    // 11/09/2026 las 6 franjas que no cuadran en ninguna fila salían solo
    // en la de su hora de inicio (2 + 4 + 0); ahora salen en todas las que
    // pisan, recortadas:
    //   2 de 16:00–17:00 → filas 15:30 y 16:30
    //   1 de 17:00–17:30 → solo 16:30 (cabe entera dentro)
    //   3 de 17:00–18:00 → filas 16:30 y 17:30
    //   3 de 17:30–19:00 → llenan la fila de 17:30 y se meten media hora en
    //     la de 18:30, donde ahora salen en la cajita. ESTAS TRES son el
    //     segundo caso del mismo fallo, y no las vio Jorge: las encontró
    //     este test al comparar lo visible con el contador.
    assert.deepEqual(reparto.map((r) => r.dentro.length), [9, 12, 13, 9, 0]);
    assert.deepEqual(reparto.map((r) => r.sueltas.length), [2, 6, 3, 3, 0]);

    // Y LA COMPROBACIÓN QUE IMPORTA: en cada fila, la gente que se ve
    // (dentro + cajita) tiene que cuadrar con lo que dice su contador. Es
    // el desajuste que provocó todo esto — la ocupación contaba a Rakel en
    // la fila de las 16:30 y la lista no la enseñaba.
    //
    // Se ve MÁS o IGUAL que el contador, nunca menos: la ocupación es el
    // máximo por media hora, así que dos clases seguidas de media hora se
    // ven las dos y cuentan como una. Lo que no puede pasar es lo contrario
    // —contar a alguien que no se ve—, que es lo que pasaba en la fila de
    // las 18:30: decía 12 y se veían 9.
    for (const r of reparto) {
      const visibles = r.dentro.length + r.sueltas.length;
      assert.ok(
        visibles >= r.ocupacion,
        `fila ${r.bloque.inicio}: el contador dice ${r.ocupacion} y solo se ven ${visibles}`
      );
    }
    assert.equal(
      reparto[3].dentro.length + reparto[3].sueltas.length, reparto[3].ocupacion,
      "la fila de las 18:30, que es la que delató el segundo caso: 12 y 12"
    );
    assert.equal(reparto[0].dentro.length, 9);
    assert.equal(reparto[1].dentro.length, 12, "las 11 de 16:30 más la de dos horas");
    assert.equal(reparto[2].dentro.length, 13, "9 + las 3 de hora y media + la de dos horas");
    assert.equal(reparto[3].dentro.length, 9);
    assert.equal(reparto[4].dentro.length, 0, "a las 19:30 ya no hay nadie");
  });

  test("la cuenta de una fila es 'a la vez', no 'en algún momento'", () => {
    // Un día de Lyceo, a mano, en la fila 16:30-17:30:
    //   16:30 -> la de 16:00-17:00 y la de 16:30-17:30  = 2
    //   17:00 -> la de 16:30-17:30 y la de 17:00-18:00  = 2
    // Cuatro clases distintas tocan la fila, pero a la vez nunca hay más
    // de dos. Contando "franjas que tocan" saldría 4/6 y no es verdad.
    const franjas = [
      f("16:00", "17:00", "Rakel"), f("16:30", "17:30", "Marta"), f("17:00", "18:00", "Iván"),
      f("15:30", "16:30", "Ana"),
    ];
    assert.equal(ocupacionDeBloque(franjas, bloques[1]), 2);
  });
}
