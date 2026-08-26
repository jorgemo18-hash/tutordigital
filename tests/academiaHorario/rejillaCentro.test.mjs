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
  const franjas = [
    { dia_semana: 2, hora_inicio: "17:00:00", alumno: { id: "a1", nombre: "Ana García", curso: "1º ESO", nivel: "eso" } },
    { dia_semana: 2, hora_inicio: "17:00:00", alumno: { id: "a2", nombre: "Luis Ruiz", curso: "5º PRIM", nivel: "primaria" } },
    { dia_semana: 3, hora_inicio: "18:00:00", alumno: { id: "a3", nombre: "Marta Sanz", curso: "2º BACH", nivel: "bachillerato" } },
  ];

  test("pinta una columna por día laborable, más la de horas", () => {
    const el = buildRejillaCentro({ franjas, config });
    assert.equal(el.querySelectorAll(".ach-head").length, 3);
    assert.equal(el.querySelectorAll(".ach-hora").length, 2, "17:00 y 18:00");
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
    // 3 días x 2 horas = 6 celdas; 2 tienen alumnos -> 4 vacías.
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
    assert.equal(el.querySelectorAll(".ach-cell--lleno").length, 1);
  });

  test("REGRESIÓN: pasarse del máximo se pinta, no se oculta — el límite avisa y no bloquea", () => {
    const el = buildRejillaCentro({ franjas, config: { ...config, max_alumnos_por_franja: 1 } });
    assert.equal(el.querySelectorAll(".ach-cell--excedido").length, 1);
    assert.ok([...el.querySelectorAll(".ach-cell-conteo")].some((c) => c.textContent === "2/1"));
  });

  test("el color de nivel viaja como clase, sin color escrito a mano en el JS", () => {
    const el = buildRejillaCentro({ franjas, config });
    assert.equal(el.querySelectorAll(".ach-lv-eso").length, 1);
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
}
