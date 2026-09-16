import assert from "node:assert/strict";

// EL CUADRANTE EN TEXTO: el contrato entre la pantalla y el papel.
//
// `filasDelCuadrante` devuelve días, horas y casillas ya en texto, sin DOM y
// sin pdfkit. Lo llaman el navegador y el backend, y por eso lo que NO puede
// pasar es que el papel y la pantalla digan cosas distintas del mismo martes —
// el mismo criterio que ya se documentó en ocupacionHoja.js.
//
// Lo que se prueba aquí es lo que el cuadrante no puede perder: la hora de
// quien no ocupa la fila entera, el aviso de quien todavía no viene, y cuál de
// los dos Danieles es cada uno.
export async function run({ test }) {
  const {
    filasDelCuadrante, lineasDeCelda, nombresDeCelda, normalizarDias, textoDeCelda, textoDePlazas, etiquetaHora,
  } = await import("../../assets/shared/js/textoDelCuadrante.js");

  const HOY = "2026-09-16";
  const alumno = (nombre, extra = {}) => ({ alumno: { nombre }, ...extra });

  // ── Los nombres ──────────────────────────────────────────────────────

  test("va el nombre de pila, como en el cuaderno", () => {
    assert.deepEqual(
      nombresDeCelda([alumno("Rakel Trallero Gallego"), alumno("Lucía López Ubán")]),
      ["Rakel", "Lucía"]
    );
  });

  // En pantalla dos "Daniel" se distinguen pasando el ratón por encima. En un
  // folio no hay ratón, y la misma hora con dos Danieles es justo donde hace
  // falta saber cuál es cuál.
  test("dos nombres de pila iguales en la misma hora llevan la inicial", () => {
    assert.deepEqual(
      nombresDeCelda([alumno("Daniel Abadias Otal"), alumno("Daniel Esteban Giménez")]),
      ["Daniel A.", "Daniel E."]
    );
  });

  test("el mismo alumno repetido no se convierte en dos Danieles distintos", () => {
    assert.deepEqual(
      nombresDeCelda([alumno("Daniel Abadias Otal"), alumno("Daniel Abadias Otal")]),
      ["Daniel", "Daniel"]
    );
  });

  test("un alumno sin apellido no inventa una inicial", () => {
    assert.deepEqual(nombresDeCelda([alumno("Daniel"), alumno("Daniel Otal")]), ["Daniel", "Daniel O."]);
  });

  test("una franja sin alumno no rompe la fila", () => {
    assert.deepEqual(nombresDeCelda([{}]), ["(sin nombre)"]);
  });

  // ── El contenido de una casilla ──────────────────────────────────────

  test("los nombres se separan con ' / ', como en la hoja de cálculo de Jorge", () => {
    const celda = { dentro: [alumno("Daniel Otal"), alumno("Lucía López"), alumno("Alex Solsona")] };
    assert.equal(textoDeCelda(celda, { hoyISO: HOY }), "Daniel / Lucía / Alex");
  });

  // Sin la hora, quien viene de 16:00 a 17:00 parece que viene de 15:30 a
  // 16:30. Es el fallo que Jorge encontró el 11/09 con Rakel, aquí en papel.
  test("quien no ocupa la fila entera lleva SU hora detrás", () => {
    const celda = {
      dentro: [alumno("Eric Val")],
      sueltas: [alumno("Rakel Trallero", { hora_inicio: "16:00", hora_fin: "17:00" })],
    };
    assert.equal(textoDeCelda(celda, { hoyISO: HOY }), "Eric / Rakel (16:00 – 17:00)");
  });

  // Decisión de Jorge del 11/09 ("sí, que se vea"): la plaza está comprometida
  // —por eso sale— pero quién esté hoy en el aula es otra cosa.
  test("quien todavía no ha empezado sale marcado con su fecha", () => {
    const celda = { dentro: [alumno("Cristian Marquez", { fecha_inicio: "2026-10-01" })] };
    assert.equal(textoDeCelda(celda, { hoyISO: HOY }), "Cristian (desde 1/10)");
  });

  test("cuando la fecha de comienzo ya ha pasado, el aviso desaparece", () => {
    const celda = { dentro: [alumno("Cristian Marquez", { fecha_inicio: "2026-10-01" })] };
    assert.equal(textoDeCelda(celda, { hoyISO: "2026-10-01" }), "Cristian", "el mismo día ya cuenta");
    assert.equal(textoDeCelda(celda, { hoyISO: "2026-10-02" }), "Cristian");
  });

  test("hora y 'desde' juntos, separados por coma", () => {
    const celda = {
      sueltas: [alumno("Enara Romero", { hora_inicio: "17:00", hora_fin: "19:00", fecha_inicio: "2026-09-21" })],
    };
    assert.equal(textoDeCelda(celda, { hoyISO: HOY }), "Enara (17:00 – 19:00, desde 21/9)");
  });

  test("una hora sin nadie se queda en blanco, no con un guion", () => {
    assert.equal(textoDeCelda({}, { hoyISO: HOY }), "");
  });

  // El curso alarga la casilla, y en el papel eso se paga en cuerpo de letra
  // (la elige el PDF según lo que ocupa el contenido). Por eso viene apagado.
  test("el curso y el contador son opcionales y vienen apagados", () => {
    const celda = { dentro: [{ alumno: { nombre: "Daniel Otal", curso: "3º ESO" } }], ocupacion: 4 };
    assert.equal(textoDeCelda(celda, { hoyISO: HOY, maxPorFranja: 6 }), "Daniel");
    assert.equal(textoDeCelda(celda, { hoyISO: HOY, conCurso: true }), "Daniel (3º ESO)");
    assert.equal(textoDeCelda(celda, { hoyISO: HOY, conContador: true, maxPorFranja: 6 }), "4/6 · Daniel");
  });

  test("una casilla vacía no imprime un contador suelto", () => {
    assert.equal(textoDeCelda({ ocupacion: 0 }, { hoyISO: HOY, conContador: true, maxPorFranja: 6 }), "");
  });

  // ── El modo "enseñar a una familia" ──────────────────────────────────

  test("sin nombres, la casilla dice las plazas que quedan", () => {
    assert.equal(textoDePlazas({ ocupacion: 2 }, 6), "4 plazas");
    assert.equal(textoDePlazas({ ocupacion: 5 }, 6), "1 plaza");
    assert.equal(textoDePlazas({ ocupacion: 6 }, 6), "Completo");
    assert.equal(textoDePlazas({ ocupacion: 8 }, 6), "Completo", "nunca plazas negativas");
    assert.equal(textoDePlazas({ ocupacion: 3 }, 0), "", "sin tope no se inventa un número");
  });

  // ── El contrato completo ─────────────────────────────────────────────

  const DIAS = [1, 2];
  const BLOQUES = [{ inicio: "15:30", fin: "16:30" }, { inicio: "16:30", fin: "17:30" }];
  const FRANJAS = [
    { dia_semana: 1, hora_inicio: "15:30", hora_fin: "16:30", alumno: { nombre: "Daniel Otal" } },
    { dia_semana: 1, hora_inicio: "15:30", hora_fin: "16:30", alumno: { nombre: "Lucía López" } },
    { dia_semana: 2, hora_inicio: "16:30", hora_fin: "17:30", alumno: { nombre: "Eric Val" } },
  ];

  test("devuelve una columna por día y una fila por hora, en orden", () => {
    const { columnas, filas } = filasDelCuadrante({ franjas: FRANJAS, dias: DIAS, bloques: BLOQUES, hoyISO: HOY });
    assert.deepEqual(columnas, [{ value: 1, name: "Lunes" }, { value: 2, name: "Martes" }]);
    assert.deepEqual(filas.map((f) => f.hora), ["15:30–16:30", "16:30–17:30"]);
    assert.deepEqual(filas[0].celdas[0].dentro.map((a) => a.nombre), ["Daniel", "Lucía"]);
    assert.deepEqual(filas[0].celdas[1].dentro, [], "el martes a esa hora no viene nadie");
    assert.deepEqual(filas[1].celdas[1].dentro.map((a) => a.nombre), ["Eric"]);
  });

  // ── Las líneas: una por alumno, y las notas debajo ───────────────────

  // Jorge, 16/09, viendo el primer PDF: *"no sé, lo veo un poco
  // desorganizado... o lista con los nombres"*. Con todo en un párrafo corrido
  // los nombres partían por donde caía y los paréntesis con las horas se
  // mezclaban con los del alumno de al lado.
  test("una línea por alumno: nombre a la izquierda y curso a la derecha", () => {
    const celda = { dentro: [{ nombre: "Alex", curso: "1º BACH", hora: "", desde: "" }], sueltas: [] };
    assert.deepEqual(lineasDeCelda(celda), [
      { izquierda: "Alex", derecha: "1º BACH", tenue: false, separadorAntes: false },
    ]);
  });

  // La hora y el "desde" van DEBAJO y sangrados, nunca pegados al nombre: con
  // los tres en la misma línea, la línea se partía y el curso de la derecha se
  // quedaba colgado arriba.
  test("la hora y la fecha de comienzo van en su propia línea, sangradas y en gris", () => {
    const celda = {
      dentro: [{ nombre: "Cristian", curso: "1º BACH", hora: "", desde: "desde 1/10" }],
      sueltas: [{ nombre: "Rakel", curso: "2º ESO", hora: "16:00 – 16:30", desde: "" }],
    };
    const lineas = lineasDeCelda(celda);
    assert.deepEqual(lineas.map((l) => l.izquierda), ["Cristian", "desde 1/10", "Rakel", "16:00 – 16:30"]);
    assert.deepEqual(lineas.map((l) => Boolean(l.sangrada)), [false, true, false, true]);
    assert.equal(lineas[0].tenue, true, "quien no ha empezado va en gris");
    assert.equal(lineas[2].tenue, false, "quien ya viene, en negro");
  });

  // La raya de puntos que abre el bloque de los de media hora: *"que se vean
  // con una línea más fina o de puntos, tipo el horario original"*.
  test("la raya separa a los de media hora, y solo si hay alguien encima", () => {
    const conAmbos = lineasDeCelda({
      dentro: [{ nombre: "Alex", curso: "", hora: "", desde: "" }],
      sueltas: [{ nombre: "Rakel", curso: "", hora: "16:00 – 16:30", desde: "" }],
    });
    assert.deepEqual(conAmbos.map((l) => l.separadorAntes), [false, true, false]);

    // Una raya en el borde de arriba de una casilla donde solo hay gente de
    // media hora parece un error de impresión.
    const soloSueltas = lineasDeCelda({
      dentro: [], sueltas: [{ nombre: "Alex", curso: "", hora: "19:30 – 20:00", desde: "" }],
    });
    assert.deepEqual(soloSueltas.map((l) => l.separadorAntes), [false, false]);
  });

  test("en el modo sin nombres la casilla es una sola línea con las plazas", () => {
    assert.deepEqual(lineasDeCelda({ texto: "4 plazas", dentro: [], sueltas: [] }), [
      { izquierda: "4 plazas", derecha: "", tenue: false, separadorAntes: false },
    ]);
  });

  test("una casilla vacía no genera ninguna línea", () => {
    assert.deepEqual(lineasDeCelda({ texto: "", dentro: [], sueltas: [] }), []);
    assert.deepEqual(lineasDeCelda({}), []);
  });

  test("las dos horas en la etiqueta: con filas que empiezan y media, una sola obliga a echar cuentas", () => {
    assert.equal(etiquetaHora({ inicio: "15:30", fin: "16:30" }), "15:30–16:30");
  });

  test("sin bloques no hay filas, y no revienta", () => {
    assert.deepEqual(filasDelCuadrante({ franjas: FRANJAS, dias: DIAS, bloques: [] }).filas, []);
    assert.deepEqual(filasDelCuadrante({}).filas, []);
  });

  // Los llamadores tienen formas distintas y ninguno debería cambiar la suya.
  test("acepta los días como números (backend y centro) y como objetos (aula)", () => {
    assert.deepEqual(normalizarDias([1, 5]), [{ value: 1, name: "Lunes" }, { value: 5, name: "Viernes" }]);
    assert.deepEqual(normalizarDias([{ value: 3, name: "Miércoles" }]), [{ value: 3, name: "Miércoles" }]);
  });
}
