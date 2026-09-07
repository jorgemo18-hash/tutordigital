// Qué años ofrecen los selectores de período de Finanzas y Envío.
//
// EL FALLO: los cinco selectores hacían `for (a = 2024; a <= actual + 2)`.
// En 2026 eso ofrecía 2024-2028 — cinco años, sí, pero dos en el futuro. No
// existe un recibo de 2028: elegirlo solo lleva a una pantalla vacía y a
// pensar que algo se ha roto.
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

  test("se mira hacia atrás: hasta cinco años, el actual incluido", () => {
    assert.deepEqual(aniosDisponibles(2030), [2026, 2027, 2028, 2029, 2030]);
  });

  test("no se baja de 2024, aunque eso deje menos de cinco", () => {
    // Antes de 2024 no puede haber datos. Enseñar 2021 con cero euros no es
    // más historial: es una opción que no lleva a ninguna parte.
    assert.deepEqual(aniosDisponibles(2026), [2024, 2025, 2026]);
    assert.equal(Math.min(...aniosDisponibles(2026)), PRIMER_ANIO);
  });

  test("van en orden y sin repetidos", () => {
    const anios = aniosDisponibles(2029);
    assert.deepEqual(anios, [...anios].sort((a, b) => a - b));
    assert.equal(new Set(anios).size, anios.length);
  });

  test("con el reloj del ordenador mal puesto, el selector NO se queda vacío", () => {
    // Un desplegable sin opciones no deja trabajar; una opción rara sí.
    assert.deepEqual(aniosDisponibles(2019), [2019]);
  });
}
