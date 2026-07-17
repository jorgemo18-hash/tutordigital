export async function run({ test, assert }) {
  const { buildImportReview } = await import("../server/lib/importReview.js");

  test("archivo vacío -> error empty_file", () => {
    assert.deepEqual(buildImportReview([]), { error: "empty_file" });
    assert.deepEqual(buildImportReview(null), { error: "empty_file" });
  });

  test("cabeceras no reconocidas -> error columns_not_found con las columnas esperadas", () => {
    const result = buildImportReview([["Curso", "Teléfono"], ["1ºA", "600000000"]]);
    assert.equal(result.error, "columns_not_found");
    assert.ok(result.expected.name.includes("nombre"));
    assert.ok(result.expected.email.includes("email"));
  });

  test("cabeceras tolerantes: variantes españolas de nombre/email/apellidos", () => {
    const table = [
      ["Alumno", "Apellidos", "Correo electrónico"],
      ["Ana", "García López", "ana@example.com"],
    ];
    const result = buildImportReview(table);
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].name, "Ana García López");
    assert.equal(result.rows[0].email, "ana@example.com");
    assert.equal(result.rows[0].status, "listo");
  });

  test("cabeceras insensibles a mayúsculas/acentos/orden de columnas", () => {
    const table = [
      ["EMAIL", "NOMBRE"],
      ["b@b.com", "Beatriz"],
    ];
    const result = buildImportReview(table);
    assert.equal(result.rows[0].name, "Beatriz");
    assert.equal(result.rows[0].email, "b@b.com");
  });

  test("sin columna de apellidos -> el nombre es solo la columna 'nombre'", () => {
    const table = [["Nombre", "Email"], ["Solo Nombre Completo", "c@c.com"]];
    const result = buildImportReview(table);
    assert.equal(result.rows[0].name, "Solo Nombre Completo");
  });

  test("email inválido -> status email_invalido, no seleccionable", () => {
    const table = [["Nombre", "Email"], ["Pedro", "no-es-un-email"]];
    const result = buildImportReview(table);
    assert.equal(result.rows[0].status, "email_invalido");
    assert.equal(result.rows[0].selectable, false);
    assert.ok(result.rows[0].reason);
  });

  test("email vacío -> email_invalido, no revienta", () => {
    const table = [["Nombre", "Email"], ["Pedro", ""]];
    const result = buildImportReview(table);
    assert.equal(result.rows[0].status, "email_invalido");
    assert.equal(result.rows[0].email, null);
  });

  test("duplicado dentro del propio archivo -> el repetido queda marcado, el primero no", () => {
    const table = [
      ["Nombre", "Email"],
      ["Ana", "ana@a.com"],
      ["Ana Otra Vez", "ANA@A.COM"],
    ];
    const result = buildImportReview(table);
    assert.equal(result.rows[0].status, "listo");
    assert.equal(result.rows[1].status, "duplicado");
    assert.ok(result.rows[1].reason.includes("propio archivo"));
  });

  test("duplicado contra alumnos/invitaciones ya existentes en el centro -> muestra el estado actual", () => {
    const table = [["Nombre", "Email"], ["Ya Existe", "existe@a.com"]];
    const existingEmailStates = new Map([["existe@a.com", "Activo"]]);
    const result = buildImportReview(table, { existingEmailStates });
    assert.equal(result.rows[0].status, "duplicado");
    assert.ok(result.rows[0].reason.includes("Activo"));
    assert.equal(result.rows[0].selectable, false);
  });

  test("comparación de duplicados contra existentes es case/espacio-insensible", () => {
    const table = [["Nombre", "Email"], ["X", "  Existe@A.com  "]];
    const existingEmailStates = new Map([["existe@a.com", "Invitado"]]);
    const result = buildImportReview(table, { existingEmailStates });
    assert.equal(result.rows[0].status, "duplicado");
  });

  test("filas en blanco se ignoran (no cuentan para el límite ni generan filas vacías)", () => {
    const table = [
      ["Nombre", "Email"],
      ["", ""],
      ["Ana", "ana@a.com"],
      ["   ", "   "],
    ];
    const result = buildImportReview(table);
    assert.equal(result.rows.length, 1);
  });

  test("todas las filas en blanco tras la cabecera -> error no_data_rows", () => {
    const table = [["Nombre", "Email"], ["", ""]];
    assert.deepEqual(buildImportReview(table), { error: "no_data_rows" });
  });

  test("más filas que el límite -> error too_many_rows con el conteo real", () => {
    const table = [["Nombre", "Email"], ...Array.from({ length: 5 }, (_, i) => [`N${i}`, `n${i}@a.com`])];
    const result = buildImportReview(table, { maxRows: 3 });
    assert.equal(result.error, "too_many_rows");
    assert.equal(result.max, 3);
    assert.equal(result.received, 5);
  });

  test("exactamente en el límite -> no da error", () => {
    const table = [["Nombre", "Email"], ...Array.from({ length: 3 }, (_, i) => [`N${i}`, `n${i}@a.com`])];
    const result = buildImportReview(table, { maxRows: 3 });
    assert.equal(result.rows.length, 3);
  });

  test("mezcla de listo/email_invalido/duplicado en el mismo archivo, cada fila mantiene su propio estado", () => {
    const table = [
      ["Nombre", "Email"],
      ["Listo", "listo@a.com"],
      ["Invalido", "no-email"],
      ["YaExiste", "yaexiste@a.com"],
    ];
    const existingEmailStates = new Map([["yaexiste@a.com", "Archivado"]]);
    const result = buildImportReview(table, { existingEmailStates });
    assert.deepEqual(result.rows.map((r) => r.status), ["listo", "email_invalido", "duplicado"]);
  });
}
