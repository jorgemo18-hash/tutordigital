// La rejilla pasa a media hora y una clase es un grupo de casillas.
//
// El caso real que lo obligó: con franjas de una hora empezando y media
// (16:30, 17:30…), una alumna que solo puede de 16:00 a 17:00 no cabía en
// ninguna casilla. No había forma de meterla, ni desde la ficha ni desde el
// horario del centro.
export async function run({ test, assert }) {
  const { PASO_MIN, tramosDe, filasDeRejilla, celdasPorClase, fusionarCeldas, celdasDeFranjas } =
    await import("../../assets/shared/js/horarioTramos.js");

  // ── Qué tramos ocupa una clase ────────────────────────────────────────

  test("una clase de hora y media ocupa tres tramos", () => {
    assert.deepEqual(tramosDe("16:00", "17:30"), ["16:00", "16:30", "17:00"]);
  });

  test("el final es abierto: quien acaba a las 17:00 no ocupa las 17:00", () => {
    // A las 17:00 entra el siguiente. Contar ese tramo daría por llena un
    // aula que está libre.
    assert.deepEqual(tramosDe("16:00", "17:00"), ["16:00", "16:30"]);
  });

  test("sin hora_fin se cuenta solo el tramo de inicio (comportamiento de antes)", () => {
    // Una fila antigua o un dato a medias no puede empeorar lo que ya había.
    assert.deepEqual(tramosDe("16:00", null), ["16:00"]);
    assert.deepEqual(tramosDe("16:00", "16:00"), ["16:00"]);
  });

  test("las filas de la rejilla van de media en media hora, no por duración de clase", () => {
    const filas = filasDeRejilla("16:00", "18:00");
    assert.deepEqual(filas, ["16:00", "16:30", "17:00", "17:30"]);
    assert.equal(PASO_MIN, 30);
  });

  test("una clase estándar de 90 minutos son 3 casillas; una mal configurada, 1", () => {
    assert.equal(celdasPorClase(90), 3);
    assert.equal(celdasPorClase(60), 2);
    assert.equal(celdasPorClase(30), 1);
    assert.equal(celdasPorClase(0), 1, "nunca 0: un clic tiene que marcar algo");
    assert.equal(celdasPorClase("nada"), 1);
  });

  // ── De casillas a franjas ─────────────────────────────────────────────

  test("casillas contiguas del mismo día = UNA clase", () => {
    // Si no se fundieran, una clase de hora y media serían tres filas en la
    // base de datos: tres franjas para el profesor y el alumno repetido
    // tres veces en el cuadrante del centro.
    const franjas = fusionarCeldas([
      { dia_semana: 2, hora_inicio: "16:00" },
      { dia_semana: 2, hora_inicio: "16:30" },
      { dia_semana: 2, hora_inicio: "17:00" },
    ]);
    assert.deepEqual(franjas, [{ dia_semana: 2, hora_inicio: "16:00", hora_fin: "17:30" }]);
  });

  test("un hueco parte la clase en dos", () => {
    // Viene de 16:00 a 17:00, se va, y vuelve a las 18:00: son dos clases.
    const franjas = fusionarCeldas([
      { dia_semana: 3, hora_inicio: "16:00" },
      { dia_semana: 3, hora_inicio: "16:30" },
      { dia_semana: 3, hora_inicio: "18:00" },
    ]);
    assert.deepEqual(franjas, [
      { dia_semana: 3, hora_inicio: "16:00", hora_fin: "17:00" },
      { dia_semana: 3, hora_inicio: "18:00", hora_fin: "18:30" },
    ]);
  });

  test("días distintos nunca se funden, aunque las horas encajen", () => {
    const franjas = fusionarCeldas([
      { dia_semana: 1, hora_inicio: "16:00" },
      { dia_semana: 2, hora_inicio: "16:30" },
    ]);
    assert.equal(franjas.length, 2);
  });

  test("el orden de las casillas da igual", () => {
    // El DOM las devuelve en el orden de la rejilla, pero eso no puede ser
    // una condición para que el resultado salga bien.
    const desordenadas = fusionarCeldas([
      { dia_semana: 4, hora_inicio: "17:00" },
      { dia_semana: 4, hora_inicio: "16:00" },
      { dia_semana: 4, hora_inicio: "16:30" },
    ]);
    assert.deepEqual(desordenadas, [{ dia_semana: 4, hora_inicio: "16:00", hora_fin: "17:30" }]);
  });

  test("una casilla repetida no duplica ni alarga la clase", () => {
    const franjas = fusionarCeldas([
      { dia_semana: 1, hora_inicio: "16:00" },
      { dia_semana: 1, hora_inicio: "16:00" },
    ]);
    assert.deepEqual(franjas, [{ dia_semana: 1, hora_inicio: "16:00", hora_fin: "16:30" }]);
  });

  test("sin casillas marcadas no hay franjas", () => {
    assert.deepEqual(fusionarCeldas([]), []);
    assert.deepEqual(fusionarCeldas(null), []);
  });

  // ── El camino de vuelta ───────────────────────────────────────────────

  test("una franja guardada vuelve a marcar TODAS sus casillas", () => {
    // Si solo se marcara la de inicio, abrir la ficha y guardar recortaría
    // la clase a media hora sin que nadie lo pidiera.
    const celdas = celdasDeFranjas([{ dia_semana: 2, hora_inicio: "16:00", hora_fin: "17:30" }]);
    assert.deepEqual([...celdas.keys()], ["2|16:00", "2|16:30", "2|17:00"]);
  });

  test("ida y vuelta: marcar lo que hay y volver a fusionar da lo mismo", () => {
    const original = [
      { dia_semana: 2, hora_inicio: "16:00", hora_fin: "17:30" },
      { dia_semana: 4, hora_inicio: "18:00", hora_fin: "19:00" },
    ];
    const celdas = [...celdasDeFranjas(original).keys()].map((k) => {
      const [dia, hora] = k.split("|");
      return { dia_semana: Number(dia), hora_inicio: hora };
    });
    assert.deepEqual(fusionarCeldas(celdas), original);
  });

  test("cada casilla recuerda de qué franja venía (para conservar su profesor)", () => {
    const celdas = celdasDeFranjas([
      { dia_semana: 2, hora_inicio: "16:00", hora_fin: "17:00", profesor_id: "p-maria" },
    ]);
    assert.equal(celdas.get("2|16:30").profesor_id, "p-maria");
  });
}
