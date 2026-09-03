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

  test("EL CASO RAKEL: de en punto a en punto va a la cajita de la fila donde empieza", () => {
    // Es la niña que solo puede de 16:00 a 17:00 y no cabía en ninguna
    // casilla. Sale UNA vez, en 15:30-16:30, con su hora escrita.
    const reparto = repartirEnBloques([f("16:00", "17:00", "Rakel")], bloques);
    assert.deepEqual(reparto[0].sueltas.map((x) => x.alumno.nombre), ["Rakel"]);
    assert.deepEqual(reparto[0].dentro, []);
    assert.deepEqual(reparto[1].sueltas, [], "en la cajita de UNA fila, no en las dos que toca");
    assert.equal(etiquetaFranja(reparto[0].sueltas[0]), "16:00 – 17:00", "la hora se ve, que es lo que la distingue");
  });

  test("una clase de dos horas sale en las dos filas que ocupa", () => {
    // No es duplicar: el alumno está ahí las dos horas.
    const reparto = repartirEnBloques([f("16:30", "18:30", "Pablo")], bloques);
    assert.deepEqual(reparto.map((r) => r.dentro.length), [0, 1, 1, 0, 0]);
    assert.deepEqual(reparto.map((r) => r.sueltas.length), [0, 0, 0, 0, 0]);
  });

  test("una clase de hora y media: fila entera donde cabe, y no ensucia la siguiente", () => {
    // 17:30-19:00 llena 17:30-18:30 y se mete media hora en la siguiente.
    const reparto = repartirEnBloques([f("17:30", "19:00", "Lucía")], bloques);
    assert.deepEqual(reparto[2].dentro.map((x) => x.alumno.nombre), ["Lucía"]);
    assert.deepEqual(reparto[3].dentro, []);
    assert.deepEqual(reparto[3].sueltas, [], "ya se ve en la fila de arriba, con su hora");
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

  test("Lyceo, 02/09: 42 de las 48 franjas caen en fila y 6 van a la cajita", () => {
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
    const sueltas = reparto.reduce((n, r) => n + r.sueltas.length, 0);
    assert.equal(sueltas, 6, "las de 16:00 y 17:00, que es justo lo que Jorge apunta aparte");
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
