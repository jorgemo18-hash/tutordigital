// Regla del punto 1 del encargo: la invitación de profesor de instituto
// exige al menos un grupo/clase; la de academia no tiene ese concepto y
// no debe exigirlo. admin-teachers/invite.routes.js usa esta misma
// función exportada — probarla aquí evita tener que montar un tenant real
// para verificar la condición.
export async function run({ test, assert }) {
  const { debeExigirGrupo } = await import("../server/lib/adminTeacherHelpers.js");

  test("tenant de academia -> no exige grupo", () => {
    assert.equal(debeExigirGrupo("academia"), false);
  });

  test("tenant standalone (instituto) -> exige grupo", () => {
    assert.equal(debeExigirGrupo("standalone"), true);
  });

  test("tenant integrado (instituto) -> exige grupo", () => {
    assert.equal(debeExigirGrupo("integrado"), true);
  });

  test("tipo desconocido/ausente -> por defecto exige grupo (fail-safe hacia el comportamiento de instituto)", () => {
    assert.equal(debeExigirGrupo(undefined), true);
    assert.equal(debeExigirGrupo(""), true);
  });
}
