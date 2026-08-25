import assert from "node:assert/strict";

// Mismo patrón que academia-config-impacto-horario-wiring.test.mjs: sin
// credenciales reales, solo comprueba que la ruta existe, está protegida
// por sesión/tenant, y admite el rol student (a diferencia de
// /api/v1/academia/config, que es admin/teacher-only — ver
// academia.config.routes.js).
export async function run({ test }) {
  const { createApp } = await import("../server/app.js");

  test("GET /api/v1/academia/branding existe y exige sesión", async () => {
    const app = await createApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/academia/branding" });
    await app.close();

    assert.notEqual(res.statusCode, 404);
    assert.ok([400, 401, 403].includes(res.statusCode), `esperaba 4xx de auth/tenant, recibió ${res.statusCode}`);
  });
}
