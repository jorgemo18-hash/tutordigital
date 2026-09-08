// Qué horas salen marcadas como completas en la hoja para familias.
//
// La cuenta tiene que ser LA MISMA que la del cuadrante. Si se calculara
// aparte, el papel diría que el martes a las cinco está lleno y la pantalla
// diría que queda sitio — y con una familia delante, la que se cree es la
// que está impresa.
import fs from "node:fs";

export async function run({ test, assert }) {
  const { ocupacionPorCasilla, estaCompleta, clave, franjasQueOcupanPlaza } =
    await import("../../server/lib/academiaHojaFamilias/ocupacionHoja.js");
  const { bloquesDeConfig } = await import("../../assets/shared/js/horarioBloques.js");

  const LYCEO = { franja_inicio: "15:30", franja_fin: "20:30", franja_duracion: 60 };
  const bloques = bloquesDeConfig(LYCEO);
  const DIAS = [1, 2, 3, 4, 5];
  const f = (dia, hora_inicio, hora_fin) => ({ dia_semana: dia, hora_inicio, hora_fin });

  test("cada franja cuenta solo en SU día", () => {
    const mapa = ocupacionPorCasilla([f(2, "15:30", "16:30")], { dias: DIAS, bloques });
    assert.equal(mapa.get(clave(2, bloques[0])), 1);
    assert.equal(mapa.get(clave(1, bloques[0])), 0, "el lunes no hereda la clase del martes");
  });

  test("REGRESIÓN: dos medias horas seguidas no llenan el aula", () => {
    // Contando "franjas que tocan la hora" saldrían 2 de golpe. En el aula
    // nunca coincidieron, y marcar esa hora como completa dejaría fuera a
    // una familia que sí cabía.
    const franjas = [f(1, "15:30", "16:00"), f(1, "16:00", "16:30")];
    assert.equal(ocupacionPorCasilla(franjas, { dias: DIAS, bloques }).get(clave(1, bloques[0])), 1);
  });

  test("los que se solapan a medias SÍ cuentan juntos", () => {
    const franjas = [f(1, "16:00", "17:00"), f(1, "16:30", "17:30")];
    assert.equal(ocupacionPorCasilla(franjas, { dias: DIAS, bloques }).get(clave(1, bloques[1])), 2);
  });

  test("una clase de dos horas ocupa las dos", () => {
    const mapa = ocupacionPorCasilla([f(3, "16:30", "18:30")], { dias: DIAS, bloques });
    assert.equal(mapa.get(clave(3, bloques[1])), 1);
    assert.equal(mapa.get(clave(3, bloques[2])), 1);
  });

  test("una franja de un día que no es laborable no cuenta en ninguna casilla", () => {
    const mapa = ocupacionPorCasilla([f(6, "15:30", "16:30")], { dias: DIAS, bloques });
    assert.equal([...mapa.values()].reduce((a, b) => a + b, 0), 0);
  });

  test("sin franjas, todas las casillas a cero — y ninguna revienta", () => {
    const mapa = ocupacionPorCasilla(null, { dias: DIAS, bloques });
    assert.equal(mapa.size, DIAS.length * bloques.length);
    assert.equal([...mapa.values()].every((n) => n === 0), true);
  });

  // ── Cuándo se marca ──────────────────────────────────────────────────

  test("completa es llegar al máximo, no pasarse de él", () => {
    assert.equal(estaCompleta(6, 6), true);
    assert.equal(estaCompleta(5, 6), false);
    assert.equal(estaCompleta(8, 6), true, "por encima del tope sigue estando llena");
  });

  test("SIN límite de plazas no se marca nada, y no es un descuido", () => {
    // Un centro que no ha puesto máximo por franja no puede decir que una
    // hora esté llena: no existe la idea de lleno. Su hoja sale limpia.
    assert.equal(estaCompleta(50, null), false);
    assert.equal(estaCompleta(50, 0), false);
    assert.equal(estaCompleta(50, undefined), false);
  });

  test("LYCEO 07/09: el martes y el jueves a las 16:30 están por encima del tope de 6", () => {
    // Datos reales de producción: 7 alumnos a la vez el martes y 8 el jueves
    // en esa hora. Es lo que hace que esas dos casillas salgan sombreadas en
    // la hoja, y de paso lo que Jorge no veía en su hoja de cálculo.
    const franjas = [
      ...Array.from({ length: 7 }, () => f(2, "16:30", "17:30")),
      ...Array.from({ length: 8 }, () => f(4, "16:30", "17:30")),
      ...Array.from({ length: 2 }, () => f(1, "15:30", "16:30")),
    ];
    const mapa = ocupacionPorCasilla(franjas, { dias: DIAS, bloques });
    assert.equal(mapa.get(clave(2, bloques[1])), 7);
    assert.equal(mapa.get(clave(4, bloques[1])), 8);
    assert.equal(estaCompleta(mapa.get(clave(2, bloques[1])), 6), true);
    assert.equal(estaCompleta(mapa.get(clave(1, bloques[0])), 6), false, "el lunes a las 15:30 sí tiene sitio");
  });

  // --- Quién ocupa plaza de verdad (añadido el 08/09/2026) ---
  //
  // La hoja contaba TODA franja vigente. Un borrador conserva su horario con
  // fecha_fin a null, así que entraba en la cuenta sin estar dentro: en
  // Lyceo, 17 franjas de 73, y marcaba 5 horas completas donde solo hay 3.
  test("REGRESIÓN: la franja de un alumno NO activo no ocupa plaza", () => {
    const filas = [
      { dia_semana: 1, hora_inicio: "16:30", hora_fin: "17:30", alumno: { activo: true } },
      { dia_semana: 1, hora_inicio: "16:30", hora_fin: "17:30", alumno: { activo: false } },
    ];
    assert.equal(franjasQueOcupanPlaza(filas).length, 1);
  });

  test("REGRESIÓN: si el alumno no viene embebido, la franja SÍ cuenta", () => {
    // Quedarse corto en un aforo es peor que pasarse: ante la duda, ocupa.
    const filas = [
      { dia_semana: 1, hora_inicio: "16:30", hora_fin: "17:30" },
      { dia_semana: 1, hora_inicio: "16:30", hora_fin: "17:30", alumno: null },
      { dia_semana: 1, hora_inicio: "16:30", hora_fin: "17:30", alumno: {} },
    ];
    assert.equal(franjasQueOcupanPlaza(filas).length, 3);
  });

  test("mismo criterio que el cuadrante de pantalla, literalmente", () => {
    // Si el cuadrante cambiara a `=== true` y esto no, el papel y la
    // pantalla volverían a discrepar — que es el fallo que se acaba de
    // cerrar. El criterio vive en un solo sitio a propósito.
    const src = fs.readFileSync(
      new URL("../../server/routes/v1/academia.horario.routes.js", import.meta.url), "utf8"
    );
    assert.match(src, /alumno\?\.activo !== false/);
  });

  test("aguanta null, undefined y lista vacía", () => {
    assert.deepEqual(franjasQueOcupanPlaza(), []);
    assert.deepEqual(franjasQueOcupanPlaza(null), []);
    assert.deepEqual(franjasQueOcupanPlaza([]), []);
  });

}
