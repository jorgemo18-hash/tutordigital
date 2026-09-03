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

  test("la cajita no cuenta como 'Grupo': son alumnos de otra hora", () => {
    // "Grupo · 2" al lado de la fila significa dos a la vez en el aula. Un
    // alumno de la cajita no está a la misma hora.
    const grid = buildHorarioGrid([f("15:30", "16:30", "Ana"), f("16:00", "17:00", "Rakel")], dias, bloques);
    const celda = grid.querySelector(".ac-cell");
    assert.equal(celda.querySelector(".ac-group-tag"), null);
    assert.equal(celda.querySelectorAll(".ac-slot").length, 1);
    assert.equal(celda.querySelectorAll(".ac-suelta").length, 1);
  });

  test("dos a la misma hora sí son grupo", () => {
    const grid = buildHorarioGrid([f("15:30", "16:30", "Ana"), f("15:30", "16:30", "Bea")], dias, bloques);
    assert.equal(grid.querySelector(".ac-group-tag").textContent, "Grupo · 2");
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

  test("sin filas configuradas, el mensaje de siempre y no una rejilla en blanco", () => {
    const el = buildHorarioGrid([f("16:00", "17:00", "Rakel")], dias, []);
    assert.equal(el.className, "ac-empty");
  });
}
