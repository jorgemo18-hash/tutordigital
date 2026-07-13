// Cubre las 3 decisiones del informe de validación de alta de alumno:
// email de alumno obligatorio solo en alta activa, email de familia
// obligatorio al crearla, e indicador de horario/tarifa incompletos.
export async function run({ test, assert }) {
  const { AlumnoCreateSchema } = await import("../server/lib/academiaAlumnoSchemas.js");
  const { CreateFamiliaSchema } = await import("../server/routes/v1/academia.familias.routes.js");
  const { enriquecerConTarifaYHorario } = await import("../server/lib/academiaAlumnoHelpers.js");

  const base = { nombre: "Ana", curso: "1º ESO", fecha_alta: "2026-07-13" };

  test("AlumnoCreateSchema: alta activa sin email falla con el mensaje de invitación", () => {
    const parsed = AlumnoCreateSchema.safeParse({ ...base });
    assert.ok(!parsed.success, "debería fallar sin email cuando activo es true por defecto");
    const issue = parsed.error.issues.find((i) => i.path.join(".") === "email");
    assert.ok(issue, "debería haber un issue en el path email");
    assert.equal(issue.message, "El email del alumno es obligatorio para poder invitarle al tutor");
  });

  test("AlumnoCreateSchema: alta activa con email pasa", () => {
    const parsed = AlumnoCreateSchema.safeParse({ ...base, email: "ana@example.com" });
    assert.ok(parsed.success, "debería pasar con email presente");
  });

  test("AlumnoCreateSchema: borrador (activo:false) sin email pasa", () => {
    const parsed = AlumnoCreateSchema.safeParse({ ...base, activo: false });
    assert.ok(parsed.success, "un borrador no debe exigir email todavía");
  });

  test("AlumnoCreateSchema: familia_nueva sin email en alta activa falla", () => {
    const parsed = AlumnoCreateSchema.safeParse({
      ...base,
      email: "ana@example.com",
      familia_nueva: { nombre: "Familia Ana" },
    });
    assert.ok(!parsed.success, "debería fallar sin email de familia_nueva en alta activa");
    const issue = parsed.error.issues.find((i) => i.path.join(".") === "familia_nueva.email");
    assert.ok(issue, "debería haber un issue en el path familia_nueva.email");
    assert.equal(issue.message, "El email de la familia es obligatorio para el envío de facturas e informes");
  });

  test("AlumnoCreateSchema: familia_nueva sin email en borrador pasa", () => {
    const parsed = AlumnoCreateSchema.safeParse({
      ...base,
      activo: false,
      familia_nueva: { nombre: "Familia Ana" },
    });
    assert.ok(parsed.success, "un borrador no debe exigir email de familia_nueva todavía");
  });

  test("CreateFamiliaSchema: sin email falla con el mensaje de facturas/informes", () => {
    const parsed = CreateFamiliaSchema.safeParse({ nombre: "Familia López" });
    assert.ok(!parsed.success, "debería fallar sin email");
    const issue = parsed.error.issues.find((i) => i.path.join(".") === "email");
    assert.ok(issue, "debería haber un issue en el path email");
    assert.equal(issue.message, "El email de la familia es obligatorio para el envío de facturas e informes");
  });

  test("CreateFamiliaSchema: email vacío (\"\") se trata igual que ausente", () => {
    const parsed = CreateFamiliaSchema.safeParse({ nombre: "Familia López", email: "" });
    assert.ok(!parsed.success, "\"\" debería tratarse como campo ausente, no como email inválido");
  });

  test("CreateFamiliaSchema: con email válido pasa", () => {
    const parsed = CreateFamiliaSchema.safeParse({ nombre: "Familia López", email: "lopez@example.com" });
    assert.ok(parsed.success, "debería pasar con email presente y válido");
  });

  test("enriquecerConTarifaYHorario: marca tiene_horario y tarifa_vigente por alumno", () => {
    const alumnos = [{ id: "a1" }, { id: "a2" }, { id: "a3" }];
    const tarifas = [{ alumno_id: "a1", precio_neto: 120 }];
    const horarios = [{ alumno_id: "a2" }, { alumno_id: "a1" }];

    const items = enriquecerConTarifaYHorario(alumnos, tarifas, horarios);

    const a1 = items.find((a) => a.id === "a1");
    const a2 = items.find((a) => a.id === "a2");
    const a3 = items.find((a) => a.id === "a3");

    assert.deepEqual(a1.tarifa_vigente, { precio_neto: 120 });
    assert.equal(a1.tiene_horario, true);
    assert.equal(a2.tarifa_vigente, null);
    assert.equal(a2.tiene_horario, true);
    assert.equal(a3.tarifa_vigente, null);
    assert.equal(a3.tiene_horario, false);
  });

  test("enriquecerConTarifaYHorario: listas vacías no rompe y deja todo incompleto", () => {
    const items = enriquecerConTarifaYHorario([{ id: "a1" }], [], []);
    assert.equal(items[0].tarifa_vigente, null);
    assert.equal(items[0].tiene_horario, false);
  });
}
