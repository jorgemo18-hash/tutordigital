import assert from "node:assert/strict";

// Mismo patrón que academia-profesores-routes-wiring.test.mjs: sin
// credenciales reales, solo comprueba que las rutas existen y están
// protegidas. El control de acceso fino (reglas de negocio de quién
// puede crear/revocar qué) se cubre a nivel de unidad en
// tests/academiaSustituciones/.
export async function run({ test }) {
  const { createApp } = await import("../server/app.js");

  const RUTAS_PROTEGIDAS = [
    { method: "GET", url: "/api/v1/academia/sustituciones/profesores" },
    { method: "GET", url: "/api/v1/academia/sustituciones" },
    { method: "POST", url: "/api/v1/academia/sustituciones" },
    { method: "POST", url: "/api/v1/academia/sustituciones/sustitucion-1/revocar" },
  ];

  for (const ruta of RUTAS_PROTEGIDAS) {
    test(`sustituciones wiring: ${ruta.method} ${ruta.url} existe y exige sesión`, async () => {
      const app = await createApp();
      const res = await app.inject({ method: ruta.method, url: ruta.url });
      await app.close();

      assert.notEqual(res.statusCode, 404);
      assert.ok([400, 401, 403].includes(res.statusCode), `esperaba 4xx de auth/tenant, recibió ${res.statusCode}`);
    });
  }
}
