import assert from "node:assert/strict";

// Mismo patrón que academia-lista-espera-routes-wiring.test.mjs: sin
// credenciales reales, solo comprueba que la ruta existe y está
// protegida. La lógica de cálculo se cubre a nivel de unidad en
// tests/academiaConfig/.
export async function run({ test }) {
  const { createApp } = await import("../server/app.js");

  test("GET /api/v1/academia/config/impacto-horario existe y exige sesión", async () => {
    const app = await createApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/academia/config/impacto-horario?franja_inicio=15:30&franja_fin=20:30&franja_duracion=60",
    });
    await app.close();

    assert.notEqual(res.statusCode, 404);
    assert.ok([400, 401, 403].includes(res.statusCode), `esperaba 4xx de auth/tenant, recibió ${res.statusCode}`);
  });
}
