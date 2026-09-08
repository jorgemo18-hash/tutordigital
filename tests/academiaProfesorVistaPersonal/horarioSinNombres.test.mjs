import { Window } from "happy-dom";

const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// El cuadrante en modo "sin nombres", para girar la pantalla cuando una
// familia pregunta qué días puede traer a su hijo.
//
// LO QUE ESTOS TESTS PROTEGEN, por orden de importancia:
//   1. Que NO se escape ni un nombre, ni un curso, ni un recuento. Es el
//      motivo entero de que la vista exista: si se cuela un dato de otro
//      alumno, la vista no es que quede fea, es que no se puede usar.
//   2. Que el número diga las plazas que QUEDAN, no las ocupadas — y que
//      salga del mismo cálculo que el resto (el momento de más gente), para
//      no prometer una plaza que solo existe media hora.
//   3. Que sin tope configurado no se ofrezca: sin máximo no hay "libres".
export async function run({ test, assert }) {
  const { buildHorarioGrid } = await import("../../assets/academia/profesor/js/horario.js");
  const { buildCeldaPlazas, buildBotonSinNombres, actualizarBotonSinNombres, notaDelCuadrante } =
    await import("../../assets/academia/profesor/js/horarioCeldaPlazas.js");

  const dias = [{ value: 1, name: "Lunes" }];
  const bloques = [{ inicio: "15:30", fin: "16:30" }, { inicio: "16:30", fin: "17:30" }];
  const alumno = (nombre) => ({ id: nombre, nombre, curso: "1º ESO", nivel: "eso", activo: true });
  const f = (hora_inicio, hora_fin, nombre) => ({
    id: `${nombre}-${hora_inicio}`, dia_semana: 1, hora_inicio, hora_fin, alumno: alumno(nombre),
  });
  const sinNombres = (franjas, max = 6) =>
    buildHorarioGrid(franjas, dias, bloques, max, { sinNombres: true });

  test("REGRESIÓN: no se escapa ningún nombre de alumno", () => {
    const grid = sinNombres([f("15:30", "16:30", "Aarón"), f("16:00", "17:00", "Rakel")]);
    // El texto entero de la rejilla, incluidos los title= que llevan el
    // nombre completo en la vista normal.
    const texto = `${grid.textContent} ${grid.innerHTML}`;
    assert.equal(texto.includes("Aarón"), false, "se ha colado un nombre");
    assert.equal(texto.includes("Rakel"), false, "se ha colado un nombre de la cajita");
  });

  test("REGRESIÓN: tampoco cursos, ni etiquetas de nivel, ni la cajita de los sueltos", () => {
    // El curso solo no identifica a nadie, pero enseñar "1º ESO, 4º ESO,
    // 1º BACH" sigue contando quién hay dentro. La cajita de los de media
    // hora además lleva la hora exacta de un alumno concreto.
    const grid = sinNombres([f("15:30", "16:30", "Aarón"), f("16:00", "17:00", "Rakel")]);
    assert.equal(grid.textContent.includes("1º ESO"), false);
    assert.equal(grid.querySelectorAll(".ac-lv").length, 0);
    assert.equal(grid.querySelectorAll(".ac-slot").length, 0);
    assert.equal(grid.querySelectorAll(".ac-suelta").length, 0);
  });

  test("REGRESIÓN: tampoco el '2 alumnos' de la cabecera del día", () => {
    // Quitar los nombres y dejar el recuento sería quedarse a medias: sigue
    // siendo información del centro y no ayuda a quien pregunta.
    const grid = sinNombres([f("15:30", "16:30", "Aarón"), f("16:30", "17:30", "Rakel")]);
    assert.equal(grid.querySelectorAll(".ac-day-count").length, 0);
    assert.equal(grid.textContent.includes("alumnos"), false);
  });

  test("la rejilla sigue siendo la misma: mismos días y mismas horas", () => {
    // Es lo que hace que la vista sirva para señalar con el dedo: si las
    // filas no coincidieran con las del cuadrante de siempre, habría que
    // traducir mentalmente entre las dos.
    const grid = sinNombres([f("15:30", "16:30", "Aarón")]);
    assert.equal(grid.querySelector(".ac-day-name").textContent, "Lunes");
    const horas = [...grid.querySelectorAll(".ac-time-desde")].map((e) => e.textContent);
    assert.deepEqual(horas, ["15:30", "16:30"]);
    assert.equal(grid.querySelectorAll(".ac-cell").length, 2);
  });

  test("dice las plazas que QUEDAN, no las ocupadas", () => {
    const grid = sinNombres([f("15:30", "16:30", "Aarón"), f("15:30", "16:30", "Eric")]);
    const primera = grid.querySelector(".ac-cell");
    assert.equal(primera.querySelector(".ac-plazas-num").textContent, "4"); // 6 - 2
    assert.match(primera.textContent, /plazas libres/);
  });

  test("una sola plaza se dice en singular", () => {
    const celda = buildCeldaPlazas({ ocupacion: 5 }, 6);
    assert.equal(celda.querySelector(".ac-plazas-num").textContent, "1");
    assert.match(celda.textContent, /plaza libre/);
    assert.equal(celda.textContent.includes("plazas"), false);
  });

  test("una hora sin nadie ofrece el tope entero, y NO parece cerrada", () => {
    // Con la caja punteada de `empty` una hora libre se leería como "ese
    // día a esa hora no hay clase" — el mismo malentendido que en la hoja
    // impresa se arregló imprimiendo "Todos" en vez de un hueco en blanco.
    const celda = buildCeldaPlazas({ ocupacion: 0 }, 6);
    assert.equal(celda.querySelector(".ac-plazas-num").textContent, "6");
    assert.equal(celda.classList.contains("empty"), false);
    assert.ok(celda.classList.contains("filled"));
  });

  test("REGRESIÓN: llena se dice 'Completo', y nunca un número negativo", () => {
    for (const ocupacion of [6, 7, 99]) {
      const celda = buildCeldaPlazas({ ocupacion }, 6);
      assert.match(celda.textContent, /Completo/);
      assert.equal(celda.querySelector(".ac-plazas-num"), null, "no debería haber número");
      assert.ok(celda.classList.contains("ac-cell--completa"));
    }
  });

  test("REGRESIÓN: cuenta el momento de más gente, no los de hora entera", () => {
    // El martes real de Lyceo: cuatro de hora entera más tres de media que
    // llegan a solaparse hasta seis. Si contara solo los cuatro diría que
    // quedan dos plazas donde no queda ninguna — y esa promesa se hace con
    // la madre delante.
    const martes = [
      f("16:30", "17:30", "Aarón"), f("16:30", "17:30", "Eric"),
      f("16:30", "17:30", "Luis"), f("16:30", "17:30", "Óscar"),
      f("16:00", "17:00", "Rakel"), f("17:00", "18:00", "Aylén"), f("17:00", "19:00", "Enara"),
    ];
    const grid = buildHorarioGrid(martes, dias, [{ inicio: "16:30", fin: "17:30" }], 6, { sinNombres: true });
    assert.match(grid.querySelector(".ac-cell").textContent, /Completo/);
  });

  test("sin tope de plazas la casilla no inventa un 'Completo'", () => {
    // Restar contra 0 daría "Completo" en un centro sin máximo, que es justo
    // lo contrario de la verdad. El botón tampoco se ofrece (ver horario.js).
    const celda = buildCeldaPlazas({ ocupacion: 3 }, 0);
    assert.equal(celda.textContent.includes("Completo"), false);
    assert.ok(celda.classList.contains("empty"));
  });

  test("el botón dice lo que hace y se re-rotula al encenderse", () => {
    let veces = 0;
    const btn = buildBotonSinNombres(() => { veces += 1; });
    assert.equal(btn.textContent, "Ocultar nombres");
    assert.equal(btn.getAttribute("aria-pressed"), "false");
    btn.click();
    assert.equal(veces, 1);

    actualizarBotonSinNombres(btn, true);
    assert.equal(btn.textContent, "Ver nombres");
    assert.equal(btn.getAttribute("aria-pressed"), "true");
    assert.ok(btn.classList.contains("ac-btn-sinnombres--activo"));
  });

  test("la nota se adapta al modo, y no sale si nadie ocupa media hora", () => {
    assert.equal(notaDelCuadrante({ conMediaHora: false }), null);
    assert.equal(notaDelCuadrante({ sinNombres: true, conMediaHora: false }), null);
    assert.match(notaDelCuadrante({ conMediaHora: true }).textContent, /^\* /);
    const paraFamilia = notaDelCuadrante({ sinNombres: true, conMediaHora: true }).textContent;
    assert.match(paraFamilia, /plazas libres/);
    assert.equal(paraFamilia.startsWith("*"), false, "en esta vista no hay asterisco al que referirse");
  });
}
