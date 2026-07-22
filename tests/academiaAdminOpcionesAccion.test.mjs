export async function run({ test, assert }) {
  const { opcionesLote, opcionesFamilia } = await import(
    "../assets/academia/admin/js/sections/envioFamilias/acciones/opcionesAccion.js"
  );

  test("opcionesLote: siempre las 3 opciones fijas, 'recibos e informes' primero (por defecto)", () => {
    assert.deepEqual(opcionesLote("Regenerar"), [
      { tipo: "completo", label: "Regenerar recibos e informes" },
      { tipo: "solo_recibo", label: "Solo recibos" },
      { tipo: "solo_informe", label: "Solo informes" },
    ]);
    assert.deepEqual(opcionesLote("Enviar")[0], { tipo: "completo", label: "Enviar recibos e informes" });
  });

  test("opcionesFamilia con 0 alumnos activos: solo completo/solo_recibo, sin nada de informes", () => {
    const opciones = opcionesFamilia("Regenerar", []);
    assert.deepEqual(opciones, [
      { tipo: "completo", label: "Regenerar recibo e informes" },
      { tipo: "solo_recibo", label: "Solo recibo" },
    ]);
  });

  test("opcionesFamilia con 1 alumno activo: NO duplica 'Solo informes' con 'Regenerar informe de [nombre]' — solo la segunda", () => {
    const opciones = opcionesFamilia("Regenerar", [{ id: "a1", nombre: "Ana" }]);
    const labels = opciones.map((o) => o.label);
    assert.equal(labels.includes("Solo informes"), false, "con 1 solo alumno, la opción genérica no debe aparecer");
    assert.equal(opciones.filter((o) => o.tipo === "informe_alumno" || o.tipo === "solo_informe").length, 1, "debe haber exactamente una opción de informe (la del alumno, no la genérica)");
    assert.deepEqual(opciones, [
      { tipo: "completo", label: "Regenerar recibo e informes" },
      { tipo: "solo_recibo", label: "Solo recibo" },
      { tipo: "informe_alumno", alumnoId: "a1", alumnoNombre: "Ana", label: "Regenerar informe de Ana" },
    ]);
  });

  test("opcionesFamilia con 2 alumnos activos: SÍ muestra 'Solo informes' Y una opción por cada alumno (sin dedup)", () => {
    const opciones = opcionesFamilia("Enviar", [{ id: "a1", nombre: "Ana" }, { id: "a2", nombre: "Luis" }]);
    const labels = opciones.map((o) => o.label);
    assert.deepEqual(labels, ["Enviar recibo e informes", "Solo recibo", "Solo informes", "Enviar informe de Ana", "Enviar informe de Luis"]);
  });

  test("opcionesFamilia con 3+ alumnos activos: una opción por cada uno, en el mismo orden que se pasaron", () => {
    const alumnos = [{ id: "a1", nombre: "Ana" }, { id: "a2", nombre: "Luis" }, { id: "a3", nombre: "Marta" }];
    const opciones = opcionesFamilia("Regenerar", alumnos);
    const porAlumno = opciones.filter((o) => o.tipo === "informe_alumno");
    assert.deepEqual(porAlumno.map((o) => o.alumnoNombre), ["Ana", "Luis", "Marta"]);
    assert.ok(opciones.some((o) => o.label === "Solo informes"), "con 3+ alumnos también debe ofrecer la opción genérica");
  });
}
