export async function run({ test, assert }) {
  const { formatAvisoArchivoFamilia } = await import("../assets/academia/admin/js/drawer/avisoArchivoFamilia.js");

  test("sin hermanos con descuento -> null (no se muestra nada)", () => {
    assert.equal(formatAvisoArchivoFamilia([]), null);
    assert.equal(formatAvisoArchivoFamilia(undefined), null);
  });

  test("un hermano con un descuento -> mensaje con nombre y descuento", () => {
    const msg = formatAvisoArchivoFamilia([{ nombre: "Ana", descuentos: [{ concepto: "Hermanos", porcentaje: 15 }] }]);
    assert.equal(msg, "La familia queda con 1 alumno(s) activo(s) con descuentos asignados: Ana — Hermanos 15%. Revísalos si ya no corresponden.");
  });

  test("varios hermanos, cada uno con varios descuentos -> todos listados", () => {
    const msg = formatAvisoArchivoFamilia([
      { nombre: "Ana", descuentos: [{ concepto: "Hermanos", porcentaje: 15 }, { concepto: "Primer mes", porcentaje: 20 }] },
      { nombre: "Luis", descuentos: [{ concepto: "Hermanos", porcentaje: 15 }] },
    ]);
    assert.equal(
      msg,
      "La familia queda con 2 alumno(s) activo(s) con descuentos asignados: Ana — Hermanos 15%, Primer mes 20%; Luis — Hermanos 15%. Revísalos si ya no corresponden."
    );
  });
}
