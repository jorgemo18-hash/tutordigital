// diarioFechas.js — helpers de fecha compartidos entre diario.js y el
// drawer. RANGO_DIAS_ADELANTE es el límite hasta el que se puede avanzar
// para marcar una ausencia anticipada (ver justificación en el propio
// archivo); RANGO_DIAS_ATRAS es el límite hacia atrás, sin cambios.
export async function run({ test, assert }) {
  const {
    todayISO, shiftISO, clampToRange, esFechaFutura, RANGO_DIAS_ADELANTE, RANGO_DIAS_ATRAS,
  } = await import("../../assets/academia/profesor/js/diarioFechas.js");

  test("todayISO devuelve la fecha real de hoy en formato YYYY-MM-DD", () => {
    assert.equal(todayISO(), new Date().toISOString().slice(0, 10));
  });

  test("shiftISO suma/resta días respetando cambios de mes", () => {
    assert.equal(shiftISO("2026-07-30", 3), "2026-08-02");
    assert.equal(shiftISO("2026-08-02", -3), "2026-07-30");
  });

  test("esFechaFutura: estrictamente posterior a hoy -> true; hoy mismo o pasado -> false", () => {
    assert.equal(esFechaFutura("2026-08-01", "2026-07-26"), true);
    assert.equal(esFechaFutura("2026-07-26", "2026-07-26"), false);
    assert.equal(esFechaFutura("2026-07-01", "2026-07-26"), false);
  });

  test(`clampToRange: no deja avanzar más de RANGO_DIAS_ADELANTE (${RANGO_DIAS_ADELANTE} días)`, () => {
    const hoy = "2026-07-26";
    const masAlla = shiftISO(hoy, RANGO_DIAS_ADELANTE + 10);
    assert.equal(clampToRange(masAlla, hoy), shiftISO(hoy, RANGO_DIAS_ADELANTE));
  });

  test(`clampToRange: no deja retroceder más de RANGO_DIAS_ATRAS (${RANGO_DIAS_ATRAS} días)`, () => {
    const hoy = "2026-07-26";
    const masAtras = shiftISO(hoy, -(RANGO_DIAS_ATRAS + 10));
    assert.equal(clampToRange(masAtras, hoy), shiftISO(hoy, -RANGO_DIAS_ATRAS));
  });

  test("clampToRange: una fecha dentro de rango se devuelve tal cual", () => {
    const hoy = "2026-07-26";
    assert.equal(clampToRange("2026-08-01", hoy), "2026-08-01");
    assert.equal(clampToRange(hoy, hoy), hoy);
  });
}
