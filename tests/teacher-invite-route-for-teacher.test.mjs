// Punto 2 del encargo: el canje de invitación de profesor debe redirigir
// al panel correcto según el tipo de tenant (antes era un literal fijo
// "/assets/teacher/" para todos). Mismo cálculo que
// assets/home/js/homeRouting.js#routeForTenant, aquí en el backend porque
// es lo que de verdad decide el location.href final (ver
// assets/invite/js/redeemInvite.js).
export async function run({ test, assert }) {
  const { routeForTeacher } = await import("../server/routes/v1/teacher.invites.routes.js");

  test("tenant de academia -> panel de profesor de academia", () => {
    assert.equal(routeForTeacher({ type: "academia" }), "/assets/academia/profesor/index.html");
  });

  test("tenant standalone (instituto) -> panel de profesor de instituto", () => {
    assert.equal(routeForTeacher({ type: "standalone" }), "/assets/teacher/index.html");
  });

  test("tenant integrado (instituto) -> panel de profesor de instituto", () => {
    assert.equal(routeForTeacher({ type: "integrado" }), "/assets/teacher/index.html");
  });

  test("tenant sin type / null -> por defecto panel de instituto", () => {
    assert.equal(routeForTeacher({}), "/assets/teacher/index.html");
    assert.equal(routeForTeacher(null), "/assets/teacher/index.html");
  });
}
