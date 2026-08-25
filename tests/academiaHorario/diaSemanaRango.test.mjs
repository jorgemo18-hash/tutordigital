// El rango de dia_semana estaba desalineado en tres capas: la BD admitía
// 1-5 (migración 055), HorarioEntrySchema 1-6, y academia_config
// dias_laborables 1-7. Ajustes ofrece el sábado desde la 057, así que
// guardar el horario de un alumno en sábado daba un 500 contra el CHECK
// —con el alumno ya insertado— hasta la migración 102.
//
// Este test fija el rango del schema en 1-7. REGRESIÓN: falla si se
// revierte a max(6), que es como estaba antes.
export async function run({ test, assert }) {
  const { HorarioEntrySchema } = await import("../../server/lib/academiaAlumnoSchemas.js");

  const base = { hora_inicio: "17:00", hora_fin: "18:00" };

  test("dia_semana: acepta sábado (6) — el día que Ajustes ya ofrece", () => {
    assert.equal(HorarioEntrySchema.safeParse({ ...base, dia_semana: 6 }).success, true);
  });

  test("dia_semana: acepta domingo (7) — la BD lo admite desde la migración 102", () => {
    assert.equal(HorarioEntrySchema.safeParse({ ...base, dia_semana: 7 }).success, true);
  });

  test("dia_semana: sigue aceptando lunes a viernes", () => {
    for (const dia of [1, 2, 3, 4, 5]) {
      assert.equal(
        HorarioEntrySchema.safeParse({ ...base, dia_semana: dia }).success,
        true,
        `dia_semana=${dia} debería ser válido`
      );
    }
  });

  test("dia_semana: rechaza fuera de rango (0 y 8) y no enteros", () => {
    assert.equal(HorarioEntrySchema.safeParse({ ...base, dia_semana: 0 }).success, false);
    assert.equal(HorarioEntrySchema.safeParse({ ...base, dia_semana: 8 }).success, false);
    assert.equal(HorarioEntrySchema.safeParse({ ...base, dia_semana: 5.5 }).success, false);
  });
}
