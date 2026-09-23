// Dónde cae un ejercicio al soltarlo (ordenarArrastrando.js) y el texto del
// aviso de asignatura sin hojas (avisoDeAsignatura.js).
export async function run({ test, assert }) {
  const { destinoAlSoltar } = await import("../../../assets/teacher/js/recursos/ordenarArrastrando.js");
  const { textoDelAviso } = await import("../../../assets/teacher/js/recursos/avisoDeAsignatura.js");

  test("soltar encima o debajo de otra fila da la posición final correcta", () => {
    // Lista 0..3. Arrastrar el 0 y soltarlo debajo del 2: queda en el 2.
    assert.equal(destinoAlSoltar(0, 2, true), 2);
    // Arrastrar el 0 y soltarlo encima del 2: queda en el 1.
    assert.equal(destinoAlSoltar(0, 2, false), 1);
    // Arrastrar el 3 y soltarlo encima del 0: queda el primero.
    assert.equal(destinoAlSoltar(3, 0, false), 0);
    // Soltarlo sobre sí mismo no lo mueve.
    assert.equal(destinoAlSoltar(1, 1, false), 1);
    assert.equal(destinoAlSoltar(1, 1, true), 1);
  });

  test("el aviso de asignatura: solo si la asignatura no tiene hojas, y dice lo que sí hay", () => {
    const catalogo = { temas: [{ materia: "Matemáticas", curso: "1.º ESO", nombre: "Números enteros" }] };
    assert.equal(textoDelAviso({ asignatura: "Matematicas", catalogo }), null, "sin tildes también vale");
    assert.equal(textoDelAviso({ asignatura: "", catalogo }), null);
    const t = textoDelAviso({ asignatura: "Plástica", catalogo });
    assert.ok(t.includes("Plástica") && t.includes("Matemáticas de 1.º ESO (Números enteros)"));
  });
}
