export async function run({ test, assert }) {
  const { UpdateConfigSchema, ImpactoHorarioQuerySchema } = await import(
    "../../server/routes/v1/academia.config.routes.js"
  );

  test("UpdateConfigSchema acepta franja_inicio/franja_fin/franja_duracion válidos", () => {
    const parsed = UpdateConfigSchema.safeParse({ franja_inicio: "15:30", franja_fin: "20:30", franja_duracion: 60 });
    assert.equal(parsed.success, true);
  });

  test("UpdateConfigSchema rechaza una hora con formato inválido", () => {
    const parsed = UpdateConfigSchema.safeParse({ franja_inicio: "3pm" });
    assert.equal(parsed.success, false);
  });

  test("UpdateConfigSchema rechaza franja_duracion fuera de rango (0 y 500)", () => {
    assert.equal(UpdateConfigSchema.safeParse({ franja_duracion: 0 }).success, false);
    assert.equal(UpdateConfigSchema.safeParse({ franja_duracion: 500 }).success, false);
  });

  test("UpdateConfigSchema: los 3 campos son opcionales (un PUT solo de dias_laborables sigue siendo válido)", () => {
    const parsed = UpdateConfigSchema.safeParse({ dias_laborables: [1, 2, 3] });
    assert.equal(parsed.success, true);
  });

  test("ImpactoHorarioQuerySchema: coerciona franja_duracion de string (query real) a número", () => {
    const parsed = ImpactoHorarioQuerySchema.safeParse({ franja_inicio: "15:30", franja_fin: "20:30", franja_duracion: "90" });
    assert.equal(parsed.success, true);
    assert.equal(parsed.data.franja_duracion, 90);
    assert.equal(typeof parsed.data.franja_duracion, "number");
  });

  test("ImpactoHorarioQuerySchema: los 3 campos son obligatorios (a diferencia de UpdateConfigSchema)", () => {
    assert.equal(ImpactoHorarioQuerySchema.safeParse({ franja_inicio: "15:30" }).success, false);
  });
}
