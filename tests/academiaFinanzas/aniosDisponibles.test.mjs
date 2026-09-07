// Qué años ofrecen los selectores de período de Finanzas y Envío.
//
// Dos fallos distintos vigilados aquí, y ninguno da error en pantalla:
//   1. Años FUTUROS en la lista (2027, 2028 estando en 2026). No existe un
//      recibo de 2028: elegirlo lleva a una pantalla vacía y a pensar que
//      algo se ha roto.
//   2. Que un año con datos DESAPAREZCA por el paso del tiempo. Eso no es
//      limpieza, es esconder la contabilidad.
export async function run({ test, assert }) {
  const { aniosDisponibles, PRIMER_ANIO } =
    await import("../../assets/academia/admin/js/aniosDisponibles.js");

  test("REGRESIÓN: no se ofrece ningún año futuro", () => {
    // Es lo que Jorge vio en pantalla el 07/09: 2024, 2025, 2026, 2027, 2028.
    const anios = aniosDisponibles(2026);
    assert.equal(Math.max(...anios), 2026, "el año actual es el último");
    assert.equal(anios.includes(2027), false);
    assert.equal(anios.includes(2028), false);
  });

  test("hoy (2026) la lista va de 2020 al año actual", () => {
    assert.deepEqual(aniosDisponibles(2026), [2020, 2021, 2022, 2023, 2024, 2025, 2026]);
  });

  test("se ofrecen años VACÍOS a propósito: hay que poder meter contabilidad vieja", () => {
    // Un centro que empieza a usar la app trae los gastos de años
    // anteriores. Si la lista solo tuviera los años con datos, 2022 no se
    // podría abrir porque está vacío, y estaría vacío porque no se puede
    // abrir.
    assert.ok(aniosDisponibles(2026).includes(2022));
    assert.equal(Math.min(...aniosDisponibles(2026)), PRIMER_ANIO);
  });

  test("REGRESIÓN: un año no se cae de la lista por el paso del tiempo", () => {
    // Con una ventana estrictamente deslizante de seis años, en 2032 el
    // desplegable dejaría de ofrecer 2025 — con los datos de 2025 dentro.
    const en2032 = aniosDisponibles(2032);
    assert.ok(en2032.includes(2025), "2025 sigue estando en 2032");
    assert.ok(en2032.includes(2020));
    assert.equal(Math.max(...en2032), 2032);
  });

  test("la lista solo crece: la de un año contiene entera la del anterior", () => {
    const antes = aniosDisponibles(2027);
    const despues = aniosDisponibles(2028);
    for (const a of antes) assert.ok(despues.includes(a), `${a} sigue ofreciéndose al año siguiente`);
    assert.equal(despues.length, antes.length + 1);
  });

  test("van en orden y sin repetidos", () => {
    const anios = aniosDisponibles(2029);
    assert.deepEqual(anios, [...anios].sort((a, b) => a - b));
    assert.equal(new Set(anios).size, anios.length);
  });

  test("con el reloj del ordenador mal puesto, el selector NO se queda vacío", () => {
    // Un desplegable sin opciones no deja trabajar; unas opciones raras sí.
    const anios = aniosDisponibles(2019);
    assert.ok(anios.length > 0);
    assert.equal(Math.max(...anios), 2019, "el año actual entra siempre");
  });
}
