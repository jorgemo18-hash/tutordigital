import { Window } from "happy-dom";

// No se pisa un window ya instalado por otro archivo de test: varios módulos
// de la suite comparten estos globals, y sessionExpiredFrontend.test.mjs
// depende de que el suyo (creado con una URL concreta, y con localStorage/
// sessionStorage enlazados a ÉL) siga en pie cuando le toque ejecutarse.
// Todos los módulos se importan antes de que corra ningún test, así que
// pisarlo aquí rompía un test de otro archivo importado antes.
const window = globalThis.window || new Window();
globalThis.window = window;
globalThis.document = window.document;

// Vista global del horario del centro: la rejilla que le faltaba al admin
// para cuadrar el curso sin llevar un Excel en paralelo. GET
// /academia/horario ya devolvía todas las franjas para el rol admin desde
// que se escribió, pero ninguna pantalla lo consumía.
export async function run({ test, assert }) {
  const { buildRejillaCentro } = await import(
    "../../assets/academia/admin/js/sections/horario/rejillaCentro.js"
  );
  const { buildSinHorarioLista } = await import(
    "../../assets/academia/admin/js/sections/horario/sinHorarioLista.js"
  );

  const config = {
    dias_laborables: [1, 2, 3],
    franja_inicio: "17:00",
    franja_fin: "19:00",
    franja_duracion: 60,
  };
  // Las filas son las CLASES del centro (17:00-18:00 y 18:00-19:00, ver
  // horarioBloques.js), no medias horas: una clase de una hora ocupa una
  // fila y sale una sola vez.
  const franjas = [
    { dia_semana: 2, hora_inicio: "17:00:00", hora_fin: "18:00:00", alumno: { id: "a1", nombre: "Ana García", curso: "1º ESO", nivel: "eso" } },
    { dia_semana: 2, hora_inicio: "17:00:00", hora_fin: "18:00:00", alumno: { id: "a2", nombre: "Luis Ruiz", curso: "5º PRIM", nivel: "primaria" } },
    { dia_semana: 3, hora_inicio: "18:00:00", hora_fin: "19:00:00", alumno: { id: "a3", nombre: "Marta Sanz", curso: "2º BACH", nivel: "bachillerato" } },
  ];

  test("pinta una columna por día laborable, más la de horas", () => {
    const el = buildRejillaCentro({ franjas, config });
    assert.equal(el.querySelectorAll(".ach-head").length, 3);
    assert.equal(el.querySelectorAll(".ach-hora").length, 2, "dos clases: 17:00-18:00 y 18:00-19:00");
  });

  test("cada alumno aparece en su franja, con su curso", () => {
    const el = buildRejillaCentro({ franjas, config });
    const celdas = [...el.querySelectorAll(".ach-cell")];
    const conAna = celdas.find((c) => c.textContent.includes("Ana García"));
    assert.ok(conAna, "Ana debe estar en la rejilla");
    assert.ok(conAna.textContent.includes("Luis Ruiz"), "comparten franja");
    assert.ok(conAna.textContent.includes("1º ESO"));
  });

  test("las franjas sin nadie se marcan como vacías", () => {
    const el = buildRejillaCentro({ franjas, config });
    // 3 días x 2 clases = 6 celdas; 2 tienen alumnos -> 4 vacías.
    assert.equal(el.querySelectorAll(".ach-cell--vacia").length, 4);
  });

  test("sin máximo definido, el conteo es un número suelto y nada está lleno", () => {
    const el = buildRejillaCentro({ franjas, config });
    const conteos = [...el.querySelectorAll(".ach-cell-conteo")].map((c) => c.textContent);
    assert.deepEqual(conteos.sort(), ["1", "2"]);
    assert.equal(el.querySelectorAll(".ach-cell--lleno, .ach-cell--excedido").length, 0);
  });

  test("con máximo, el conteo es N/max y la franja al límite se marca", () => {
    const el = buildRejillaCentro({ franjas, config: { ...config, max_alumnos_por_franja: 2 } });
    const conteos = [...el.querySelectorAll(".ach-cell-conteo")].map((c) => c.textContent);
    assert.ok(conteos.includes("2/2"));
    assert.equal(el.querySelectorAll(".ach-cell--lleno").length, 1, "la clase de Ana y Luis");
  });

  test("REGRESIÓN: pasarse del máximo se pinta, no se oculta — el límite avisa y no bloquea", () => {
    const el = buildRejillaCentro({ franjas, config: { ...config, max_alumnos_por_franja: 1 } });
    assert.equal(el.querySelectorAll(".ach-cell--excedido").length, 1);
    assert.ok([...el.querySelectorAll(".ach-cell-conteo")].some((c) => c.textContent === "2/1"));
  });

  test("el color de nivel viaja como clase, sin color escrito a mano en el JS", () => {
    const el = buildRejillaCentro({ franjas, config });
    assert.equal(el.querySelectorAll(".ach-lv-eso").length, 1, "una vez, no una por media hora");
    assert.equal(el.querySelectorAll(".ach-lv-pri").length, 1);
    assert.equal(el.querySelectorAll(".ach-lv-bach").length, 1);
  });

  test("sin franjas: la rejilla se pinta igual, toda vacía", () => {
    const el = buildRejillaCentro({ franjas: [], config });
    assert.equal(el.querySelectorAll(".ach-cell").length, 6);
    assert.equal(el.querySelectorAll(".ach-cell--vacia").length, 6);
  });

  test("lista de sin horario: nombra a los alumnos y los cuenta", () => {
    const el = buildSinHorarioLista([
      { id: "a9", nombre: "Nuevo de octubre", curso: "3º ESO", nivel: "eso" },
    ]);
    assert.ok(el.querySelector(".ach-pendientes-head").textContent.includes("1"));
    assert.ok(el.textContent.includes("Nuevo de octubre"));
  });

  test("lista de sin horario vacía: lo dice, no deja un hueco mudo", () => {
    const el = buildSinHorarioLista([]);
    assert.ok(el.querySelector(".ach-pendientes-vacio"));
    assert.ok(el.textContent.includes("Todos los alumnos activos tienen horario"));
  });
  test("REGRESIÓN: dos alumnos que se solapan a medias se ven juntos en la media hora que comparten", () => {
    // El caso que obligó a contar por tramo: quien viene de 17:00 a 18:00 y
    // quien viene de 17:30 a 18:30 comparten aula media hora. Contando por
    // hora de inicio no coincidían nunca y el aviso de plazas mentía.
    const solapadas = [
      { dia_semana: 1, hora_inicio: "17:00", hora_fin: "18:00", alumno: { id: "x1", nombre: "Pronto", nivel: "eso" } },
      { dia_semana: 1, hora_inicio: "17:30", hora_fin: "18:30", alumno: { id: "x2", nombre: "Tarde", nivel: "eso" } },
    ];
    const el = buildRejillaCentro({ franjas: solapadas, config: { ...config, max_alumnos_por_franja: 1 } });
    const celdas = [...el.querySelectorAll(".ach-cell")];
    const compartida = celdas.find((c) => c.textContent.includes("Pronto") && c.textContent.includes("Tarde"));
    assert.ok(compartida, "a las 17:30 están los dos: 'Tarde' en la cajita de esa fila");
    assert.ok(compartida.querySelector(".ach-sueltas"), "la de 17:30 no llena la fila entera: va a la cajita");
    assert.ok(compartida.classList.contains("ach-cell--excedido"), "y con máximo 1, eso es pasarse");
  });

  test("EL CASO RAKEL en el cuadrante del centro: sale en cada fila que pisa, recortada", () => {
    // Las filas del centro son 17:00–18:00 y 18:00–19:00; ella viene de
    // 17:30 a 18:30, o sea que pisa media hora de cada una.
    //
    // Hasta el 11/09/2026 salía UNA vez, en la primera, con su horario
    // completo ("17:30 – 18:30"). Lo cambió el mismo fallo que en el
    // cuadrante del profesor (ver horarioBloques.test.mjs): la segunda fila
    // la contaba en su ocupación y no la enseñaba, así que el número decía
    // que había alguien y la lista no.
    const rakel = [{ dia_semana: 1, hora_inicio: "17:30", hora_fin: "18:30", alumno: { id: "r", nombre: "Rakel", nivel: "eso" } }];
    const el = buildRejillaCentro({ franjas: rakel, config });
    const conRakel = [...el.querySelectorAll(".ach-cell")].filter((c) => c.textContent.includes("Rakel"));
    assert.equal(conRakel.length, 2, "en las dos filas que pisa, no solo en la de su hora de inicio");
    assert.deepEqual(
      conRakel.map((c) => c.querySelector(".ach-suelta-hora").textContent),
      ["17:30 – 18:00", "18:00 – 18:30"],
      "y con el trozo que pasa en cada una: repetir '17:30 – 18:30' dos veces parecerían dos clases de una hora"
    );
  });

  test("la etiqueta de la fila lleva las dos horas", () => {
    const el = buildRejillaCentro({ franjas, config });
    const primera = el.querySelector(".ach-hora");
    assert.equal(primera.querySelector(".ach-hora-desde").textContent, "17:00");
    assert.equal(primera.querySelector(".ach-hora-hasta").textContent, "18:00");
  });

  test("REGRESIÓN: el que aún no ha empezado sale marcado 'desde D/M'", () => {
    // Jorge, 11/09: *"dijimos de no tocarlo en horario —a lo mejor que
    // salgan entre paréntesis o marcados de alguna manera— pero que no
    // salgan en diario"*.
    //
    // ES ESTA la pantalla donde hace falta: aquí se decide si cabe alguien
    // más en un hueco, y un alumno de octubre se veía IDÉNTICO a uno que ya
    // viene. La plaza cuenta —está comprometida, y por eso sigue saliendo—
    // pero quién esté hoy en el aula es otra cosa. El cuadrante del
    // profesor lo marcaba desde el 11/09; este no marcaba nada.
    const futuro = [{
      dia_semana: 1, hora_inicio: "17:00", hora_fin: "18:00", fecha_inicio: "2026-10-06",
      alumno: { id: "f1", nombre: "De octubre", curso: "1º ESO", nivel: "eso" },
    }];
    // `hoyISO` explícito y no el reloj de verdad: un test que compara con
    // hoy deja de comprobar nada el 6 de octubre.
    const el = buildRejillaCentro({ franjas: futuro, config, hoyISO: "2026-09-11" });
    const chip = el.querySelector(".ach-alumno--futuro");
    assert.ok(chip, "el chip entero se marca, no solo la pastilla");
    assert.equal(chip.querySelector(".ach-alumno-desde").textContent, "desde 6/10");
    assert.match(
      chip.querySelector(".ach-alumno-desde").title, /todavía no aparece en el Diario/,
      "la pastilla dice cuándo; el título, qué significa"
    );
    assert.ok(chip.textContent.includes("De octubre"), "y sigue saliendo: la plaza está dada");
  });

  test("al que ya viene no se le marca nada: una marca en todos no marca nada", () => {
    const el = buildRejillaCentro({ franjas, config });
    assert.equal(el.querySelectorAll(".ach-alumno-desde").length, 0);
  });

  test("una clase de media hora ocupa una sola casilla, en la cajita de su fila", () => {
    const corta = [{ dia_semana: 1, hora_inicio: "17:00", hora_fin: "17:30", alumno: { id: "c1", nombre: "Corta", nivel: "eso" } }];
    const el = buildRejillaCentro({ franjas: corta, config });
    assert.equal([...el.querySelectorAll(".ach-cell")].filter((c) => c.textContent.includes("Corta")).length, 1);
  });
}
