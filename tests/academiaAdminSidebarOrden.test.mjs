// "Profesores" debe quedar justo debajo de "Alumnos" en el sidebar de
// admin-academia (antes estaba al final de la primera franja, junto a
// Ajustes) — test de regresión simple sobre el orden del array.
export async function run({ test, assert }) {
  const { SECTIONS } = await import("../assets/academia/admin/js/sidebar.js");

  test("Profesores aparece justo después de Alumnos", () => {
    const ids = SECTIONS.map((s) => s.id);
    const idxAlumnos = ids.indexOf("alumnos");
    const idxProfesores = ids.indexOf("profesores");
    assert.notEqual(idxAlumnos, -1);
    assert.notEqual(idxProfesores, -1);
    assert.equal(idxProfesores, idxAlumnos + 1);
  });
}
