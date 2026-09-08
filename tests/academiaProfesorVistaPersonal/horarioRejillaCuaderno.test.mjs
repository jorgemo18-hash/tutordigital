import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// El horario que ve el profesor (y el admin en "Dar clase"), dibujado como
// el cuaderno: una fila por clase, y el que viene a otra hora en la cajita
// de la esquina con su hora escrita. Jorge, 02/09: "la clase de y media a y
// media, pero que a la derecha abajo aparezcan los que van de en punto a en
// punto, como lo tengo con Rakel en el cuaderno".
export async function run({ test, assert }) {
  const { buildHorarioGrid } = await import("../../assets/academia/profesor/js/horario.js");

  const dias = [{ value: 1, name: "Lunes" }];
  // Las filas reales de Lyceo (15:30-20:30, clases de una hora).
  const bloques = [
    { inicio: "15:30", fin: "16:30" },
    { inicio: "16:30", fin: "17:30" },
  ];
  const alumno = (nombre) => ({ id: nombre, nombre, curso: "1º ESO", nivel: "eso", activo: true });
  const f = (hora_inicio, hora_fin, nombre) => ({
    id: `${nombre}-${hora_inicio}`, dia_semana: 1, hora_inicio, hora_fin, alumno: alumno(nombre),
  });

  test("una clase de y media a y media ocupa su fila y NO se repite en la siguiente", () => {
    // Con filas de media hora salía dos veces: el horario parecía el doble
    // de lleno de lo que estaba.
    const grid = buildHorarioGrid([f("15:30", "16:30", "Ana")], dias, bloques);
    const celdas = [...grid.querySelectorAll(".ac-cell")];
    assert.equal(celdas.length, 2, "dos filas, una celda por fila");
    assert.equal(celdas[0].querySelectorAll(".ac-slot").length, 1);
    assert.equal(celdas[1].classList.contains("empty"), true);
  });

  test("EL CASO RAKEL: la de 16:00 a 17:00 va a la cajita, con su hora", () => {
    const grid = buildHorarioGrid([f("16:00", "17:00", "Rakel")], dias, bloques);
    const celdas = [...grid.querySelectorAll(".ac-cell")];
    const caja = celdas[0].querySelector(".ac-sueltas");
    assert.ok(caja, "en la fila donde empieza, la de las 15:30");
    assert.equal(caja.querySelector(".ac-suelta-hora").textContent, "16:00 – 17:00",
      "la hora es lo único que la distingue de las de la fila");
    assert.equal(caja.querySelector(".ac-suelta-nombre").textContent, "Rakel");
    assert.equal(celdas[0].querySelectorAll(".ac-slot").length, 0, "no se cuela entre las de la fila");
    assert.equal(celdas[1].querySelector(".ac-sueltas"), null, "en una sola fila, no en las dos que toca");
  });

  // ── El contador del hueco (Jorge, 03/09) ──────────────────────────────

  test("el hueco dice cuántos hay y cuántos caben: 2/6", () => {
    // Antes ponía "Grupo · 2" a la izquierda. Lo que interesa al mirar un
    // hueco es si cabe alguien más.
    const grid = buildHorarioGrid([f("15:30", "16:30", "Ana"), f("15:30", "16:30", "Bea")], dias, bloques, 6);
    assert.equal(grid.querySelector(".ac-cell-conteo").textContent, "2/6");
  });

  test("sin máximo configurado, el contador es un número suelto", () => {
    const grid = buildHorarioGrid([f("15:30", "16:30", "Ana")], dias, bloques);
    assert.equal(grid.querySelector(".ac-cell-conteo").textContent, "1");
  });

  test("REGRESIÓN: los de media hora SÍ cuentan — el número es el momento de más gente", () => {
    // CAMBIÓ EL 08/09/2026. Este test decía "1/6*": los de media hora no
    // contaban, con el argumento de que "ocupan el aula media hora, no el
    // hueco entero, y sumarlos daría un lleno que no es verdad".
    //
    // El argumento era falso, y se vio comparándolo con la hoja impresa para
    // familias, que sí cuenta el pico (ocupacionDeBloque): 12 de las 25
    // casillas del horario real de Lyceo decían números distintos en la
    // pantalla y en el papel. La cuenta buena no suma a lo bruto — coge el
    // tramo de media hora con más gente. Aquí, de 16:00 a 16:30 están Ana y
    // Rakel las dos: son 2, y decir 1 es decir que cabe una plaza que no
    // cabe.
    //
    // El asterisco se queda con OTRO significado: ya no avisa de gente sin
    // contar, sino de que la hora no es uniforme.
    const grid = buildHorarioGrid([f("15:30", "16:30", "Ana"), f("16:00", "17:00", "Rakel")], dias, bloques, 6);
    const celda = grid.querySelector(".ac-cell");
    assert.equal(celda.querySelector(".ac-cell-conteo").textContent, "2/6*");
    // El DIBUJO no cambia: Rakel sigue en la cajita de la esquina, porque no
    // cubre la fila entera. Lo que cambió es la cuenta, no dónde va cada uno.
    assert.equal(celda.querySelectorAll(".ac-slot").length, 1);
    assert.equal(celda.querySelectorAll(".ac-suelta").length, 1);
  });

  test("REGRESIÓN: el martes de Lyceo que la pantalla daba por libre y el papel por lleno", () => {
    // Caso real, leído de producción el 08/09/2026. Martes 16:30–17:30:
    //   16:30–17:00  Rakel, Aarón, Eric, Luis, Óscar        → 5
    //   17:00–17:30  Aarón, Eric, Luis, Óscar, Aylén, Enara → 6  ← lleno
    // La pantalla decía "4/6" (solo los cuatro de hora entera) y la hoja
    // impresa lo pintaba en rojo. Jorge podía prometer plaza a una madre a
    // la que acababa de dar un papel que decía que esa hora estaba llena.
    const martes = [
      f("16:30", "17:30", "Aarón"), f("16:30", "17:30", "Eric"),
      f("16:30", "17:30", "Luis"), f("16:30", "17:30", "Óscar"),
      f("16:00", "17:00", "Rakel"), f("17:00", "18:00", "Aylén"), f("17:00", "19:00", "Enara"),
    ];
    const grid = buildHorarioGrid(martes, dias, [{ inicio: "16:30", fin: "17:30" }], 6);
    const celda = grid.querySelector(".ac-cell");
    assert.equal(celda.querySelector(".ac-cell-conteo").textContent, "6/6*");
    assert.ok(celda.classList.contains("ac-cell--completa"), "una hora llena tiene que verse llena");
  });

  test("una hora que NO llega al tope no se marca como completa", () => {
    const grid = buildHorarioGrid([f("15:30", "16:30", "Ana")], dias, bloques, 6);
    assert.equal(grid.querySelector(".ac-cell").classList.contains("ac-cell--completa"), false);
  });

  test("sin máximo configurado no se marca nada como completo", () => {
    // Sin tope no existe la idea de "lleno" — mismo criterio que
    // estaCompleta() en la hoja impresa (ocupacionHoja.js).
    const grid = buildHorarioGrid([f("15:30", "16:30", "Ana"), f("15:30", "16:30", "Luis")], dias, bloques);
    assert.equal(grid.querySelector(".ac-cell").classList.contains("ac-cell--completa"), false);
  });

  test("un hueco sin nadie de media hora no lleva asterisco", () => {
    const grid = buildHorarioGrid([f("15:30", "16:30", "Ana")], dias, bloques, 6);
    assert.equal(grid.querySelector(".ac-cell-conteo").textContent, "1/6");
  });

  test("la etiqueta de la fila lleva las dos horas, no solo la de inicio", () => {
    const grid = buildHorarioGrid([], dias, bloques);
    const primera = grid.querySelector(".ac-time");
    assert.equal(primera.querySelector(".ac-time-desde").textContent, "15:30");
    assert.equal(primera.querySelector(".ac-time-hasta").textContent, "16:30");
  });

  test("una celda con cajita y sin clase de fila no se pinta como vacía", () => {
    const grid = buildHorarioGrid([f("16:00", "17:00", "Rakel")], dias, bloques);
    const celda = grid.querySelector(".ac-cell");
    assert.equal(celda.classList.contains("filled"), true);
    assert.equal(celda.classList.contains("empty"), false);
  });

  // ── Cómo se lee cada alumno (Jorge, 03/09) ────────────────────────────

  test("en el cuadrante va el nombre de pila, no el nombre completo", () => {
    // Una columna de día mide ~140px con el menú lateral abierto: los
    // apellidos solo consiguen que se corte el nombre. El completo se queda
    // en el title.
    const grid = buildHorarioGrid([f("15:30", "16:30", "Rakel Trallero Gallego")], dias, bloques);
    const nombre = grid.querySelector(".ac-slot-name");
    assert.equal(nombre.textContent, "Rakel");
    assert.equal(nombre.title, "Rakel Trallero Gallego", "el completo no se pierde");
  });

  test("la etiqueta dice el CURSO, no la etapa", () => {
    // Antes ponía "ESO", que es lo mismo que ya dice el color. Lo que
    // distingue a dos alumnos de ESO es el curso.
    const grid = buildHorarioGrid([f("15:30", "16:30", "Ana")], dias, bloques);
    const tag = grid.querySelector(".ac-lv");
    assert.equal(tag.textContent, "1º ESO");
    assert.ok(tag.classList.contains("eso"), "y lleva el color de su etapa");
  });

  test("sin curso no hay etiqueta: un nivel suelto no dice nada que el color no diga ya", () => {
    const sinCurso = { id: "x", dia_semana: 1, hora_inicio: "15:30", hora_fin: "16:30", alumno: { id: "x", nombre: "Ana", nivel: "eso" } };
    const grid = buildHorarioGrid([sinCurso], dias, bloques);
    assert.equal(grid.querySelector(".ac-lv"), null);
    assert.equal(grid.querySelector(".ac-slot-name").textContent, "Ana", "el nombre sí, siempre");
  });

  test("REGRESIÓN: ya no se pinta una tarjeta de color por alumno — se encuadra la hora", () => {
    // Cinco tarjetas dentro de la tarjeta de la celda era un cuadrado
    // dentro de un cuadrado, y el color repetía lo que dice la etiqueta.
    const grid = buildHorarioGrid([f("15:30", "16:30", "Ana")], dias, bloques);
    const slot = grid.querySelector(".ac-slot");
    assert.equal(slot.style.getPropertyValue("--lvc"), "", "sin color propio");
    assert.ok(grid.querySelector(".ac-cell.filled"), "la caja es la de la hora");
  });

  test("la cajita de la esquina se lee igual: nombre de pila y curso", () => {
    const grid = buildHorarioGrid([f("16:00", "17:00", "Rakel Trallero Gallego")], dias, bloques);
    const suelta = grid.querySelector(".ac-suelta");
    assert.equal(suelta.querySelector(".ac-suelta-nombre").textContent, "Rakel");
    assert.equal(suelta.querySelector(".ac-lv").textContent, "1º ESO");
    assert.equal(suelta.querySelector(".ac-suelta-hora").textContent, "16:00 – 17:00");
  });

  test("en la cajita, el alumno va DEBAJO de la hora y no a su derecha", () => {
    // Jorge, 03/09: la hora es la etiqueta de la excepción; el alumno es el
    // dato, y va en su propia línea como en las filas normales.
    const grid = buildHorarioGrid([f("16:00", "17:00", "Rakel")], dias, bloques);
    const hijos = [...grid.querySelector(".ac-suelta").children].map((el) => el.className);
    assert.deepEqual(hijos, ["ac-suelta-hora", "ac-suelta-quien"], "dos líneas, en este orden");
    assert.ok(grid.querySelector(".ac-suelta-quien .ac-suelta-nombre"), "el nombre va en la segunda");
  });

  test("la leyenda del asterisco solo aparece si hay a quien aplicar", async () => {
    const { hayMediaHora } = await import("../../assets/academia/profesor/js/horario.js");
    assert.equal(hayMediaHora([f("16:00", "17:00", "Rakel")], dias, bloques), true);
    assert.equal(hayMediaHora([f("15:30", "16:30", "Ana")], dias, bloques), false,
      "una nota fija que no aplica a nadie es ruido");
    assert.equal(hayMediaHora([], dias, bloques), false);
  });

  test("sin filas configuradas, el mensaje de siempre y no una rejilla en blanco", () => {
    const el = buildHorarioGrid([f("16:00", "17:00", "Rakel")], dias, []);
    assert.equal(el.className, "ac-empty");
  });
}
